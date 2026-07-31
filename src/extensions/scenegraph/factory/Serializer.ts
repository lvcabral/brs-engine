import {
    BrsType,
    BrsInvalid,
    isUnboxable,
    FlexObject,
    RoAssociativeArray,
    BrsString,
    ValueKind,
    RoArray,
    RoList,
    RoByteArray,
    BrsComponent,
    BrsInterface,
    BrsBoolean,
    Int32,
    Int64,
    Float,
    Double,
    Uninitialized,
    isBrsType,
    BrsObjects,
    Callable,
    StdlibArgument,
    BrsDevice,
    Expr,
    resolveAnonymousCallable,
    toCallable,
    RoMessagePort,
} from "brs-engine";
import { createFlatNode } from "./NodeFactory";
import { ContentNode, Node, SGNodeType } from "../nodes";
import { FieldKind, ObservedField } from "../SGTypes";
import { sgRoot } from "../SGRoot";
import { RoSGNodeEvent } from "../events/RoSGNodeEvent";

/**
 * A `visited` view that forwards to a base set but can undo its own additions.
 *
 * Nodes normally stay in `visited` for a whole pass so a node reachable twice is deduped as a
 * `_circular_` stub. That is wrong for a node's script-scope `m` (`_m_`), which is an *extra* copy
 * of state that is usually also reachable from the enclosing pass — a Task's `m` serializes `m.top`
 * (emitting its `_m_`) before its own sibling entries, so those siblings would degrade to stubs the
 * receiver cannot resolve (`loadTaskData` rebuilds each entry with its own node map) and read back
 * as `invalid`. Serializing `_m_` through a scoped view keeps cycle detection intact for the `_m_`
 * subtree while leaving the enclosing pass free to serialize those values in full.
 */
class ScopedVisited {
    private readonly added: object[] = [];
    readonly [Symbol.toStringTag] = "WeakSet";

    constructor(private readonly base: WeakSet<object>) {}

    has(value: object): boolean {
        return this.base.has(value);
    }

    add(value: object): this {
        if (!this.base.has(value)) {
            this.added.push(value);
        }
        this.base.add(value);
        return this;
    }

    delete(value: object): boolean {
        const index = this.added.indexOf(value);
        if (index >= 0) {
            this.added.splice(index, 1);
        }
        return this.base.delete(value);
    }

    /** Removes everything this view added, restoring the base set to its pre-scope state. */
    rollback() {
        for (const value of this.added) {
            this.base.delete(value);
        }
        this.added.length = 0;
    }
}

/**
 * Converts a BrsType value to its representation as a JavaScript type.
 * @param {BrsType} value Some BrsType value.
 * @param {boolean} deep Whether to recursively convert nested structures. Defaults to true.
 * @param {Node} host Optional host node for observing context.
 * @param {WeakSet<object>} visited Optional set tracking visited nodes and containers for circular
 * reference detection. Nodes stay in the set for the whole pass (deduped as `_circular_` stubs);
 * arrays/AAs are tracked per-path (entered on descent, released on return) so a container referenced
 * twice still serializes both times, while a container reachable from itself serializes as `null`.
 * @return {any} The JavaScript representation of `x`.
 */
export function jsValueOf(value: BrsType, deep: boolean = true, host?: Node, visited?: WeakSet<object>): any {
    if (value?.kind === undefined) {
        return undefined;
    } else if (isUnboxable(value)) {
        value = value.unbox();
    }
    switch (value.kind) {
        case ValueKind.Invalid:
            return null;
        case ValueKind.Uninitialized:
            return undefined;
        case ValueKind.Boolean:
            return value.toBoolean();
        case ValueKind.String:
            return value.value;
        case ValueKind.Int32:
        case ValueKind.Float:
        case ValueKind.Double:
            return value.getValue();
        case ValueKind.Int64:
            return value.getValue().toNumber();
        case ValueKind.Interface:
        case ValueKind.Object:
            if (value instanceof RoArray || value instanceof RoList) {
                visited ??= new WeakSet<object>();
                if (visited.has(value)) {
                    warnCyclicContainer(value.getComponentName());
                    return null;
                }
                visited.add(value);
                try {
                    const elements = value.elements.map((el) => jsValueOf(el, deep, host, visited));
                    return elements;
                } finally {
                    visited.delete(value);
                }
            } else if (value instanceof RoByteArray) {
                return value.elements;
            } else if (value instanceof Node) {
                return fromSGNode(value, deep, host, visited);
            } else if (value instanceof RoAssociativeArray) {
                if (visited?.has(value)) {
                    warnCyclicContainer(value.getComponentName());
                    return null;
                }
                return fromAssociativeArray(value, deep, host, visited);
            } else if (value instanceof BrsComponent) {
                return { _component_: value.getComponentName() };
            } else if (value instanceof BrsInterface) {
                return { _interface_: value.getInterfaceName() };
            }
            break;
        case ValueKind.Callable: {
            const result: FlexObject = { _callable_: value.name ?? "" };
            // A user-defined function can be faithfully rebuilt on the receiving thread from its
            // source AST (BrightScript has no lexical closures — `m` binds to the receiver at call
            // time), so ship its source location for the AST lookup in `restoreCallable`.
            const location = value.isUserDefined() ? value.getLocation() : undefined;
            if (location) {
                result["_location_"] = {
                    file: location.file,
                    line: location.start.line,
                    column: location.start.column,
                };
            }
            return result;
        }
    }
}

/** One-shot warning when a cyclic container is dropped during cross-thread serialization. */
let warnedCyclicContainer = false;
function warnCyclicContainer(componentName: string) {
    if (!warnedCyclicContainer) {
        warnedCyclicContainer = true;
        BrsDevice.stderr.write(
            `warning,[sg] Dropped circular ${componentName} reference during cross-thread serialization`
        );
    }
}

/**
 * Converts a value to its representation as a BrsType. If no such
 * representation is possible, throws an Error.
 * @param {any} value Some value.
 * @param {boolean} cs Whether to return an AA as case sensitive.
 * @param {Map<string, Node>} nodeMap Optional map to track nodes by ID for resolving circular references.
 * @return {BrsType} The BrsType representation of `x`.
 * @throws {Error} If `x` cannot be represented as a BrsType.
 */
export function brsValueOf(value: any, cs?: boolean, nodeMap?: Map<string, Node>): BrsType {
    if (value === null || value === undefined) {
        return BrsInvalid.Instance;
    }
    const maxInt = 0x80000000;
    const t: string = typeof value;
    switch (t) {
        case "boolean":
            return BrsBoolean.from(value);
        case "string":
            return new BrsString(value, true, true);
        case "number":
            if (Number.isInteger(value)) {
                return value >= -maxInt && value < maxInt ? new Int32(value, true, true) : new Int64(value, true, true);
            } else if (Number.isNaN(value)) {
                return new Float(value, true, true);
            }
            return value >= -3.4e38 && value <= 3.4e38 ? new Float(value, true, true) : new Double(value, true, true);
        case "object":
            return fromObject(value, cs, nodeMap);
        case "undefined":
            return Uninitialized.Instance;
        default:
            throw new Error(`brsValueOf not implemented for: ${value} <${t}>`);
    }
}

/**
 * Converts a RoAssociativeArray to a JavaScript object, converting each property to the corresponding JavaScript type.
 * @param aa The RoAssociativeArray to convert.
 * @param deep Whether to recursively convert nested structures. Defaults to true.
 * @param host Optional host node for observing context.
 * @param visited Optional set tracking visited nodes and containers for circular reference detection.
 * @returns A JavaScript object with the converted properties.
 */
export function fromAssociativeArray(
    aa: RoAssociativeArray,
    deep: boolean = true,
    host?: Node,
    visited?: WeakSet<object>
): FlexObject {
    visited ??= new WeakSet<object>();
    if (visited.has(aa)) {
        warnCyclicContainer(aa.getComponentName());
        return {};
    }
    visited.add(aa);
    try {
        const result: FlexObject = {};
        for (const [key, value] of aa.elements) {
            result[key] = jsValueOf(value, deep, host, visited);
        }
        return result;
    } finally {
        visited.delete(aa);
    }
}

/**
 * Converts a JavaScript object or Map to a RoAssociativeArray, converting each property or entry to the corresponding BrightScript type.
 * @param input The JavaScript object or Map to convert.
 * @param {boolean} cs Whether to return an AA as case sensitive.
 * @param {Map<string, Node>} nodeMap Optional map to track nodes by ID for resolving circular references.
 * @returns A RoAssociativeArray with the converted properties or entries.
 */
export function toAssociativeArray(
    input: Map<string, any> | FlexObject,
    cs?: boolean,
    nodeMap?: Map<string, Node>
): RoAssociativeArray {
    const associativeArray = new RoAssociativeArray([], cs);
    if (input instanceof Map) {
        for (const [key, value] of input) {
            associativeArray.set(new BrsString(key), brsValueOf(value, cs, nodeMap), true);
        }
    } else if (typeof input === "object" && input !== null) {
        for (const key in input) {
            if (input.hasOwnProperty(key)) {
                associativeArray.set(new BrsString(key), brsValueOf(input[key], cs, nodeMap), true);
            }
        }
    } else {
        throw new Error(`Unsupported input type: ${typeof input}`);
    }
    return associativeArray;
}

/**
 * Converts a JavaScript object to a BrsType.
 * @param obj The JavaScript object to convert.
 * @param {boolean} cs Whether to return an AA as case sensitive.
 * @param {Map<string, Node>} nodeMap Optional map to track nodes by ID for resolving circular references.
 * @returns A BrsType with the converted object or Invalid if the object is not transferable.
 */
function fromObject(obj: any, cs?: boolean, nodeMap?: Map<string, Node>): BrsType {
    if (isBrsType(obj)) {
        return obj;
    } else if (obj === null) {
        return BrsInvalid.Instance;
    } else if (obj instanceof Uint8Array) {
        return new RoByteArray(obj);
    } else if (Array.isArray(obj)) {
        return new RoArray(
            obj.map(function (el: any) {
                return brsValueOf(el, cs, nodeMap);
            })
        );
    } else if (obj["_node_"] || obj["_circular_"]) {
        // Handle both regular nodes and circular references
        const nodeInfo = getSerializedNodeInfo(obj);
        if (nodeInfo) {
            const includeChildren = !(sgRoot.inTaskThread() && nodeInfo.type !== SGNodeType.ContentNode);
            return toSGNode(obj, nodeInfo.type, nodeInfo.subtype, includeChildren, nodeMap);
        }
        return BrsInvalid.Instance;
    } else if (obj["_component_"]) {
        const component = obj["_component_"];
        const ctor = BrsObjects.get(component);
        if (ctor) {
            try {
                return ctor();
            } catch (err) {
                return BrsInvalid.Instance;
            }
        }
        return BrsInvalid.Instance;
    } else if (obj["_interface_"]) {
        return BrsInvalid.Instance;
    } else if (obj["_callable_"]) {
        return restoreCallable(obj["_callable_"], obj["_location_"]);
    }
    return toAssociativeArray(obj, cs, nodeMap);
}

/** Serialized source position of a user-defined callable (see `jsValueOf`'s Callable case). */
interface SerializedCallableLocation {
    file: string;
    line: number;
    column: number;
}

/**
 * Restores a function value transferred from another thread. A serialized callable is only a name
 * plus (for user-defined functions) a source location, so resolution tries, in order:
 * 1. The anonymous-callable registry — covers a `$anon_N` round-tripping back to the thread that
 *    minted it (the registry is per-worker).
 * 2. Rebuilding from the component AST retained by `setupInterpreterWithSubEnvs`, located by the
 *    serialized file/line/column. BrightScript has no lexical closures (`m` binds to the receiver
 *    at call time), so the AST alone reproduces the function faithfully — matching a device, where
 *    a Task's copy of `m` keeps its function references callable.
 * 3. A stub that returns `uninitialized` (what the call site would see for a lost function), with
 *    a one-shot warning so the failure is never silent.
 * @param name The callable's name (`$anon_N` for anonymous functions).
 * @param location The serialized source location, when the function was user-defined.
 * @returns The restored (or stub) Callable.
 */
function restoreCallable(name: string, location?: SerializedCallableLocation): Callable {
    if (name.toLowerCase().startsWith("$anon_")) {
        const anon = resolveAnonymousCallable(name);
        // Each worker mints `$anon_N` names independently, so a registry hit may be a different
        // function that happens to share the name — trust it only when the source location agrees
        // (or when no location was serialized, the pre-existing name-only behavior).
        const anonLoc = anon?.getLocation();
        if (
            anon &&
            (!location ||
                (anonLoc?.file === location.file &&
                    anonLoc.start.line === location.line &&
                    anonLoc.start.column === location.column))
        ) {
            return anon;
        }
    }
    if (location) {
        const funcExpr = findFunctionExpression(location);
        if (funcExpr) {
            return toCallable(funcExpr, name);
        }
    }
    warnLostCallable(name);
    return new Callable(name, {
        signature: {
            args: [new StdlibArgument("arg", ValueKind.Dynamic, BrsInvalid.Instance)],
            variadic: true,
            returns: ValueKind.Void,
        },
        impl: (_: any, ..._arg: BrsType[]) => {
            return Uninitialized.Instance;
        },
    });
}

/** One-shot warning when a transferred function value cannot be restored on this thread. */
let warnedLostCallable = false;
function warnLostCallable(name: string) {
    if (!warnedLostCallable) {
        warnedLostCallable = true;
        BrsDevice.stderr.write(
            `warning,[sg] Unable to restore function "${name}" across threads; calls to it will return uninitialized`
        );
    }
}

/**
 * Locates a function expression in the retained component ASTs by its source position.
 * Results are memoized per position — a Task's `m` is re-serialized on every sync, so the same
 * function is looked up repeatedly.
 * @param location Source position captured when the callable was serialized.
 * @returns The matching function expression, or undefined when not found.
 */
function findFunctionExpression(location: SerializedCallableLocation): Expr.Function | undefined {
    const defMap = sgRoot.nodeDefMap;
    let cache = functionExprCache.get(defMap);
    if (!cache) {
        cache = new Map<string, Expr.Function | undefined>();
        functionExprCache.set(defMap, cache);
    }
    const key = `${location.file}:${location.line}:${location.column}`;
    if (cache.has(key)) {
        return cache.get(key);
    }
    let found: Expr.Function | undefined;
    const seen = new Set<any>();
    for (const def of defMap.values()) {
        if (!def.scopeStatements) {
            continue;
        }
        found = walkForFunction(def.scopeStatements, location, seen);
        if (found) {
            break;
        }
    }
    cache.set(key, found);
    return found;
}

// Memoized per nodeDefMap instance so a new app load (which replaces the map) can't serve stale ASTs.
const functionExprCache = new WeakMap<Map<string, any>, Map<string, Expr.Function | undefined>>();

/**
 * Depth-first search over AST nodes for an `Expr.Function` starting at the given position.
 * Walks own enumerable properties generically (the AST is a tree of plain objects/arrays), so it
 * finds functions nested in any statement or expression, including anonymous functions inside AA
 * literals. `seen` guards shared sub-trees across components (inherited/library statements are the
 * same object instances in every component that includes them).
 * @param value AST node, array of nodes, or leaf value to search.
 * @param location Source position to match against `Expr.Function.location.start`.
 * @param seen Object identity guard for already-visited AST nodes.
 * @returns The matching function expression, or undefined.
 */
function walkForFunction(value: any, location: SerializedCallableLocation, seen: Set<any>): Expr.Function | undefined {
    if (value === null || typeof value !== "object" || seen.has(value)) {
        return undefined;
    }
    seen.add(value);
    if (value instanceof Expr.Function) {
        const loc = value.location;
        if (loc.file === location.file && loc.start.line === location.line && loc.start.column === location.column) {
            return value;
        }
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = walkForFunction(item, location, seen);
            if (found) {
                return found;
            }
        }
        return undefined;
    }
    for (const propKey of Object.keys(value)) {
        const found = walkForFunction(value[propKey], location, seen);
        if (found) {
            return found;
        }
    }
    return undefined;
}

/**
 * Converts a JavaScript object to a RoSGNode, converting each field to the corresponding BrightScript type.
 * @param obj The JavaScript object to convert.
 * @param type The type of the node.
 * @param subtype The subtype of the node.
 * @param child Whether this node should deserialize its children.
 * @param nodeMap Optional map to track nodes by ID for resolving circular references.
 * @returns A RoSGNode with the converted fields and optionally its children.
 */
/**
 * Attributes a rebuilt node's `_observed_` port observations to the thread they came from.
 *
 * A node built inside a task and observed there with a port carries those observations across, but
 * the port itself cannot travel. Recording the originating thread against each field lets the render
 * thread fan later updates back to where the real port is waiting.
 * @param obj Serialized node data.
 * @param node The rebuilt node.
 */
function applyRemotePortObservers(obj: any, node: Node) {
    const observed = obj["_observed_"];
    const threadId = sgRoot.deserializingThread;
    if (threadId < 0 || !Array.isArray(observed)) {
        return;
    }
    for (const entry of observed) {
        if (typeof entry?.name === "string") {
            node.resolveField(entry.name.toLowerCase())?.addRemotePortObserver(threadId);
        }
    }
}

/**
 * Constructs a bare node of the given type, without running any render-side initialization.
 *
 * The `deserializing` guard keeps media nodes (Video/Audio) rebuilt as cross-thread copies from
 * running their render-init, which would hijack the singleton `sgRoot.video`/`audio` and reset the
 * real player. The prior value is restored so nested/recursive deserialization stays correct.
 * @param type Serialized node type.
 * @param subtype Serialized node subtype.
 * @returns The new node, falling back to a plain `Node` for an unknown type.
 */
function buildFlatNode(type: string, subtype: string): Node {
    const wasDeserializing = sgRoot.deserializing;
    sgRoot.deserializing = true;
    const created = createFlatNode(type, subtype);
    sgRoot.deserializing = wasDeserializing;
    return created instanceof BrsInvalid ? new Node([], subtype) : created;
}

export function toSGNode(obj: any, type: string, subtype: string, child?: boolean, nodeMap?: Map<string, Node>): Node {
    // Initialize nodeMap on first call
    nodeMap ??= new Map<string, Node>();

    // Check if this is a circular reference
    if (obj["_circular_"] && obj["_address_"]) {
        const existingNode = nodeMap.get(obj["_address_"]);
        if (existingNode) {
            return existingNode;
        }
        // The node this points at was not rebuilt on this thread: the pass reached it by a route
        // it does not restore locally — a runtime-appended child of the task node, say, whose
        // `_children_` the receiver does not replay. The owner still resolves the address (it was
        // registered when the full copy was written), so stand in an address-only proxy and let
        // reads rendezvous. Answering invalid here crashes the app's first dot access instead.
        const stub = buildFlatNode(type, subtype);
        stub.setAddress(obj["_address_"]);
        stub.setOwner(0);
        stub.setRemoteProxy(true);
        nodeMap.set(obj["_address_"], stub);
        sgRoot.registerCrossThreadNode(stub);
        return stub;
    }
    const newNode = buildFlatNode(type, subtype);
    // Store the node in the map using the original address for circular reference resolution
    // Use the address from serialized data if available, otherwise use the new node's address
    newNode.setAddress(obj["_address_"] || newNode.getAddress());
    newNode.setOwner(obj["_owner_"] ?? 0);
    // A bare reference carries no fields, so mark the rebuilt node as incomplete: a read of a field
    // it has not mirrored must rendezvous to the owner rather than answer invalid (see Node.get).
    if (obj["_proxy_"]) {
        newNode.setRemoteProxy(true);
    }
    nodeMap.set(newNode.getAddress(), newNode);
    sgRoot.registerCrossThreadNode(newNode);

    const fieldTypes = obj["_fieldtypes_"] ?? {};
    for (const key in obj) {
        if (key.startsWith("_") && key.endsWith("_") && key.length > 2) {
            continue;
        }
        const kind = FieldKind.fromString(fieldTypes[key] ?? "");
        newNode.setValueSilent(key, brsValueOf(obj[key], undefined, nodeMap), undefined, kind);
    }
    applyRemotePortObservers(obj, newNode);
    // Recreate fields whose `invalid`/uninitialized value was omitted by JSON serialization, using
    // the preserved declared type so they exist (as `invalid`) on the receiving thread.
    for (const key in fieldTypes) {
        if (!(key in obj)) {
            newNode.setValueSilent(key, BrsInvalid.Instance, undefined, FieldKind.fromString(fieldTypes[key]));
        }
    }
    restoreScriptScopeM(obj["_m_"], newNode, nodeMap);
    if (child && obj["_children_"]) {
        for (const child of obj["_children_"]) {
            const childInfo = getSerializedNodeInfo(child);
            if (childInfo) {
                const childNode = toSGNode(child, childInfo.type, childInfo.subtype, true, nodeMap);
                newNode.appendChildToParent(childNode);
            } else if (child["_invalid_"] !== undefined) {
                newNode.appendChildToParent(BrsInvalid.Instance);
            }
        }
    }
    return newNode;
}

/**
 * Serializes a custom component's script-scope `m` for a node that is changing owner.
 *
 * Node-valued entries are emitted as address references, not copies. Device-confirmed: `m` holds a
 * *live* reference — mutating the referenced node on the receiving thread is visible through `m` —
 * so a deep copy is both wrong (a detached snapshot that silently stops tracking) and expensive: a
 * component caching `m.scene`/`m.parentScreen` dragged the whole scene tree into every payload,
 * measured at 44 KB against 0.2 KB for the same node with scalar-only `m`.
 * @param node Node whose `m` is being serialized.
 * @param host Optional host node for observing context.
 * @param visited Visited set of the enclosing pass.
 * @returns The serialized `m` entries, excluding `top`/`global`.
 */
function serializeScriptScopeM(node: Node, host: Node | undefined, visited: WeakSet<object>): FlexObject {
    const mData: FlexObject = {};
    // Scoped so the values serialized here don't stay marked as visited: the enclosing pass may
    // reach the same values by another route and must serialize them in full (see ScopedVisited).
    const scoped = new ScopedVisited(visited);
    const scopedVisited = scoped as unknown as WeakSet<object>;
    try {
        for (const [key, value] of node.m.elements) {
            const lowerKey = key.toLowerCase();
            if (lowerKey === "top" || lowerKey === "global") {
                continue;
            }
            if (value instanceof Node) {
                sgRoot.registerCrossThreadNode(value);
                mData[key] = { _mref_: value.getAddress() };
                continue;
            }
            mData[key] = jsValueOf(value, true, host, scopedVisited);
        }
    } finally {
        scoped.rollback();
    }
    return mData;
}

/** One-shot warning when a script-scope node reference has no instance on the receiving thread. */
let warnedUnresolvedScriptScopeRef = false;

/**
 * Merges a serialized script-scope `m` (see fromSGNode's `_m_` entry) into a node's `m`,
 * preserving the locally built `top`/`global` entries. No-op for payloads without `_m_`.
 * @param serializedM The serialized `_m_` object, if present.
 * @param node Node whose `m` receives the entries.
 * @param nodeMap Optional map tracking nodes by address for resolving circular references.
 */
function restoreScriptScopeM(serializedM: any, node: Node, nodeMap?: Map<string, Node>) {
    if (!serializedM || typeof serializedM !== "object") {
        return;
    }
    for (const [key, value] of Object.entries(serializedM)) {
        const address: unknown = (value as FlexObject)?.["_mref_"];
        if (typeof address === "string") {
            // Resolve to this thread's own instance so `m` keeps referencing the live node.
            const live = nodeMap?.get(address) ?? sgRoot.resolveLiveNode(address);
            if (live) {
                node.m.set(new BrsString(key), live, true);
            } else if (!warnedUnresolvedScriptScopeRef) {
                warnedUnresolvedScriptScopeRef = true;
                BrsDevice.stderr.write(
                    `warning,[sg] Dropped script-scope reference "${key}": the node it points at has not crossed to this thread`
                );
            }
            continue;
        }
        node.m.set(new BrsString(key), brsValueOf(value, undefined, nodeMap), true);
    }
}

/**
 * Checks whether a node's `m` holds any script-scope entries beyond the automatic `top`/`global`.
 * @param node Node to inspect.
 * @returns True when `m` was populated (locally or by a previous restore).
 */
function hasScriptScopeM(node: Node): boolean {
    for (const key of node.m.elements.keys()) {
        const lowerKey = key.toLowerCase();
        if (lowerKey !== "top" && lowerKey !== "global") {
            return true;
        }
    }
    return false;
}

/**
 * Retrieves the serialized node type and subtype information from a serialized node object.
 * @param value The serialized node object.
 * @returns An object containing the type and subtype, or undefined if not found or invalid.
 */
export function getSerializedNodeInfo(value: any): { type: string; subtype: string } | undefined {
    if (!value || typeof value !== "object") {
        return undefined;
    }
    const descriptor = value["_node_"] ?? value["_circular_"];
    if (typeof descriptor !== "string") {
        return undefined;
    }
    const parts = descriptor.split(":");
    if (parts.length !== 2) {
        return undefined;
    }
    return { type: parts[0].trim(), subtype: parts[1].trim() };
}

/**
 * Updates an existing RoSGNode tree in-place by matching serialized addresses.
 * Falls back to creating a new node when it can't find a matching instance.
 * @param obj Serialized node representation (from fromSGNode).
 * @param targetNode Existing node instance to reconcile against.
 * @param nodeMap Optional address map containing existing nodes to be updated.
 * @returns The updated (or newly created) node instance.
 */
export function updateSGNode(obj: any, targetNode: Node, nodeMap?: Map<string, Node>): Node {
    nodeMap ??= new Map<string, Node>();
    // Handle circular references
    if (obj["_circular_"] && obj["_address_"]) {
        const existingCircular = nodeMap.get(obj["_address_"]);
        if (existingCircular) {
            return existingCircular;
        }
        // If we don't have the node yet, this might be a forward reference
        return targetNode;
    }
    // Update address and owner
    const serializedAddress: string | undefined = obj["_address_"];
    if (serializedAddress && serializedAddress !== targetNode.getAddress()) {
        const previousAddress = targetNode.getAddress();
        targetNode.setAddress(serializedAddress);
        nodeMap.delete(previousAddress);
    }
    targetNode.setOwner(obj["_owner_"] ?? targetNode.getOwner());
    // Register/update in nodeMap
    nodeMap.set(targetNode.getAddress(), targetNode);
    sgRoot.registerCrossThreadNode(targetNode);
    // Update fields
    const fieldTypes = obj["_fieldtypes_"] ?? {};
    for (const key in obj) {
        if (key.startsWith("_") && key.endsWith("_") && key.length > 2) {
            continue;
        }
        const fieldValue = obj[key];
        const fieldInfo = getSerializedNodeInfo(fieldValue);
        if (fieldInfo) {
            const serializedFieldAddress: string | undefined = fieldValue["_address_"];
            const existingFieldValue = targetNode.getValue(key);
            let nextNode: Node;
            if (
                existingFieldValue instanceof Node &&
                serializedFieldAddress &&
                existingFieldValue.getAddress() === serializedFieldAddress
            ) {
                nextNode = updateSGNode(fieldValue, existingFieldValue, nodeMap);
            } else {
                nextNode = toSGNode(fieldValue, fieldInfo.type, fieldInfo.subtype, true, nodeMap);
            }
            targetNode.setValueSilent(key, nextNode);
            continue;
        }
        const kind = FieldKind.fromString(fieldTypes[key] ?? "");
        targetNode.setValueSilent(key, brsValueOf(fieldValue, undefined, nodeMap), undefined, kind);
    }
    // Recreate fields whose `invalid`/uninitialized value was omitted by JSON serialization.
    for (const key in fieldTypes) {
        if (!(key in obj)) {
            targetNode.setValueSilent(key, BrsInvalid.Instance, undefined, FieldKind.fromString(fieldTypes[key]));
        }
    }
    // Populate script-scope `m` only when the target never had one (a flat-created cross-thread
    // copy holding just top/global): a locally populated `m` is authoritative and must not be
    // clobbered by a stale copy from the other thread.
    if (!hasScriptScopeM(targetNode)) {
        restoreScriptScopeM(obj["_m_"], targetNode, nodeMap);
    }
    // Update children
    const serializedChildren = obj["_children_"];
    if (Array.isArray(serializedChildren)) {
        const childrenList = targetNode.getNodeChildren();
        for (const child of childrenList) {
            if (child instanceof Node) {
                nodeMap.set(child.getAddress(), child);
            }
        }

        for (let index = 0; index < serializedChildren.length; index++) {
            const serializedChild = serializedChildren[index];
            const currentChild = childrenList[index];

            if (serializedChild && serializedChild["_invalid_"] !== undefined) {
                if (currentChild instanceof Node) {
                    targetNode.removeChildrenAtIndex(index, 1);
                }
                if (currentChild !== BrsInvalid.Instance) {
                    childrenList.splice(index, 0, BrsInvalid.Instance);
                    targetNode.changed = true;
                }
                continue;
            }

            const childInfo = getSerializedNodeInfo(serializedChild);
            if (!childInfo) {
                if (currentChild instanceof Node) {
                    targetNode.removeChildrenAtIndex(index, 1);
                }
                if (currentChild !== BrsInvalid.Instance) {
                    childrenList.splice(index, 0, BrsInvalid.Instance);
                    targetNode.changed = true;
                }
                continue;
            }

            const childAddress: string | undefined = serializedChild["_address_"];
            let childNode: Node | undefined = childAddress ? nodeMap.get(childAddress) : undefined;
            if (childNode instanceof Node) {
                childNode = updateSGNode(serializedChild, childNode, nodeMap);
            } else {
                childNode = toSGNode(serializedChild, childInfo.type, childInfo.subtype, true, nodeMap);
            }
            if (!(childNode instanceof Node)) {
                continue;
            }

            nodeMap.set(childNode.getAddress(), childNode);

            if (currentChild instanceof Node) {
                if (currentChild !== childNode) {
                    targetNode.replaceChildAtIndex(childNode, index);
                }
            } else if (currentChild === BrsInvalid.Instance) {
                targetNode.removeChildrenAtIndex(index, 1);
                targetNode.insertChildAtIndex(childNode, index);
            } else {
                targetNode.insertChildAtIndex(childNode, index);
            }
        }

        const excess = childrenList.length - serializedChildren.length;
        if (excess > 0) {
            targetNode.removeChildrenAtIndex(serializedChildren.length, excess);
        } else if (excess < 0) {
            for (let i = 0; i < Math.abs(excess); i++) {
                childrenList.push(BrsInvalid.Instance);
            }
        }
    }
    targetNode.changed = true;
    return targetNode;
}

/** Options controlling how a node is serialized for another thread. */
export interface SerializeOptions {
    /**
     * Include the node's script-scope `m` (`_m_`). Only correct for an ownership transfer — a node
     * keeping its owner is read back through a rendezvous to that owner, whose `m` is authoritative.
     */
    scriptScope?: boolean;
    /**
     * Emit this node's node-valued fields as address-only proxy references instead of recursing
     * into them. Applies to the node's own fields only, not to anything nested below them.
     */
    shallowRefs?: boolean;
}

/**
 * Serializes a node as an address-only reference: enough for the receiving thread to hold it and
 * rendezvous to the owner on access, without shipping its subtree.
 *
 * The stub is flagged `_proxy_` so the rebuilt node knows its field list is incomplete. Normally
 * the first read of the field holding it rendezvouses and replaces the stub with a full copy, but
 * in `fastFieldReads` mode that read can be served from the local cache and hand the stub itself
 * to the app — at which point a read of any field on it must still reach the owner rather than
 * answer `invalid`.
 * @param node Node to reference.
 * @returns A minimal serialized node stub: type, address, owner, and the proxy flag.
 */
export function proxyNodeRef(node: Node): FlexObject {
    // Keep it resolvable by address on the owner thread so the rendezvous read can find it.
    sgRoot.registerCrossThreadNode(node);
    return {
        _node_: `${node.nodeType}:${node.nodeSubtype}`,
        _address_: node.getAddress(),
        _owner_: node.getOwner(),
        _proxy_: true,
    };
}

/**
 * Serializes a Task node's script-scope `m` for launch, shipping the render-owned `global` node
 * with its node-valued fields as proxy references instead of deep copies.
 *
 * On a device `m.global` is shared; here every Task worker gets a copy, and apps keep most of their
 * state as node-valued global fields (managers, config, caches), so a deep copy made each Task
 * payload carry the whole global tree — a dominant memory cost when many tasks run at once. Those
 * fields rendezvous on read from a Task anyway (`Node.get`), which materializes the real value on
 * first access, so the launch payload only has to carry the reference. `m.top` and every other
 * entry stay deep: the task owns them and reads them locally.
 * @param m The Task node's script-scope `m`.
 * @param host The Task node (observer context for serialization).
 * @returns The serialized `m`, with `global` shallow-referenced.
 */
export function serializeTaskM(m: RoAssociativeArray, host: Node): FlexObject {
    const visited = new WeakSet<object>();
    const result: FlexObject = {};
    for (const [key, value] of m.elements) {
        if (key.toLowerCase() === "global" && value instanceof Node) {
            result[key] = fromSGNode(value, true, host, visited, { shallowRefs: true });
        } else {
            result[key] = jsValueOf(value, true, host, visited);
        }
    }
    return result;
}

/**
 * Converts a RoSGNode to a JavaScript object, converting each field to the corresponding JavaScript type.
 * @param node The RoSGNode to convert.
 * @param deep Whether to recursively convert child nodes. Defaults to true.
 * @param host Optional host node for observing context.
 * @param visited Optional WeakSet to track visited nodes and prevent circular references.
 * @returns A JavaScript object with the converted fields.
 */
export function fromSGNode(
    node: Node,
    deep: boolean = true,
    host?: Node,
    visited?: WeakSet<object>,
    options: SerializeOptions = {}
): FlexObject {
    const scriptScope = options.scriptScope ?? false;
    visited ??= new WeakSet<object>();
    if (visited.has(node)) {
        return {
            _circular_: `${node.nodeType}:${node.nodeSubtype}`,
            _address_: node.getAddress(),
        };
    }
    visited.add(node);
    // A serialized node's address may be used by the other thread to rendezvous back into this
    // one long after the local trees stopped referencing it — keep it resolvable by address.
    sgRoot.registerCrossThreadNode(node);

    const result: FlexObject = {};
    const fields = node.getNodeFields();
    const observed: ObservedField[] = [];
    const fieldTypes: FlexObject = {};

    result["_node_"] = `${node.nodeType}:${node.nodeSubtype}`;
    result["_address_"] = node.getAddress();
    result["_owner_"] = node.getOwner();

    for (const [name, field] of fields) {
        if (!field.isHidden()) {
            let fieldValue = field.getValue(false);
            if (isUnboxable(fieldValue)) {
                fieldValue = fieldValue.unbox();
            }
            if (host && field.isPortObserved(host)) {
                const observers = field.getObserversWithPort(host);
                const info = observers[0]?.eventParams.infoFields;
                if (info) {
                    observed.push({ name, info: jsValueOf(info) });
                } else {
                    observed.push({ name });
                }
            }
            if (fieldValue instanceof Node) {
                result[name] = options.shallowRefs
                    ? proxyNodeRef(fieldValue)
                    : fromSGNode(fieldValue, deep, host, visited, { scriptScope });
                continue;
            }
            const serialized = jsValueOf(fieldValue, deep, host, visited);
            result[name] = serialized;
            // A field holding `invalid` (or uninitialized) serializes to null/undefined, which loses
            // its declared type on the receiver. Capture the type so the field can be recreated.
            if (serialized === null || serialized === undefined) {
                fieldTypes[name] = field.getType();
            }
        }
    }
    if (Object.keys(fieldTypes).length) {
        result["_fieldtypes_"] = fieldTypes;
    }
    if (observed.length) {
        result["_observed_"] = observed;
    }
    // A custom component's script-scope `m` (populated by its init() on the owning thread) must
    // travel with the node: the receiving thread rebuilds the node without running init(), so a
    // callFunc there would otherwise read init()-set variables back as invalid. `top`/`global`
    // are excluded — the receiver rebuilds them locally, and serializing them here would re-walk
    // the node and ship the entire global tree.
    if (deep && scriptScope && sgRoot.nodeDefMap.has(node.nodeSubtype.toLowerCase())) {
        const mData = serializeScriptScopeM(node, host, visited);
        if (Object.keys(mData).length) {
            result["_m_"] = mData;
        }
    }
    const children = node.getNodeChildren();
    if (deep && children.length > 0 && node.serializesChildren()) {
        result["_children_"] = children.map((child: BrsType) => {
            if (child instanceof Node) {
                return fromSGNode(child, deep, host, visited, { scriptScope });
            }
            return { _invalid_: null };
        });
    }

    return result;
}

/** Serialized form of a roSGNodeEvent queued on a task's port before the task thread launched. */
export interface SerializedPortEvent {
    /** Address of the node the event originated from. */
    node: string;
    field: string;
    value: any;
    info?: any;
}

/**
 * Drains the roSGNodeEvents queued on message ports held directly by a task's `m` and serializes
 * them for the launching task thread. On a device the task's copied `m` references the same native
 * port, so events queued before `control = "RUN"` (e.g. a field set right before launch, observed
 * by the port in init()) are seen by the task function's wait(); the simulator must carry them
 * across explicitly or the task blocks forever on a wait for an event that already fired.
 * @param m The task node's script-scope `m`.
 * @param host The task node (observer context for value serialization).
 * @returns Events keyed by the `m` entry holding the port, or undefined when none are queued.
 */
export function collectPortNodeEvents(
    m: RoAssociativeArray,
    host: Node
): Record<string, SerializedPortEvent[]> | undefined {
    let result: Record<string, SerializedPortEvent[]> | undefined;
    for (const [key, value] of m.elements) {
        if (!(value instanceof RoMessagePort)) {
            continue;
        }
        const events = value.drainMessages((event) => event instanceof RoSGNodeEvent) as RoSGNodeEvent[];
        if (events.length === 0) {
            continue;
        }
        result ??= {};
        result[key] = events.map((event) => ({
            node: event.node.getAddress(),
            field: event.fieldName.getValue(),
            value: jsValueOf(event.fieldValue, true, host),
            info: event.infoFields ? fromAssociativeArray(event.infoFields, true, host) : undefined,
        }));
    }
    return result;
}

/**
 * Discards the node events queued on a task's render-side ports. While a task runs, field changes
 * reach it live (the render thread pushes to the observing task), yet the render-side copy of the
 * port keeps queueing the same events and nothing consumes them. Dropping them when the task stops
 * keeps a restart replaying only what was queued while it was stopped — otherwise a stop/run cycle
 * (the standard polling-task pattern) would replay the whole previous run's backlog at once.
 * @param m The task node's script-scope `m`.
 */
export function dropPortNodeEvents(m: RoAssociativeArray): void {
    for (const value of m.elements.values()) {
        if (value instanceof RoMessagePort) {
            value.drainMessages((event) => event instanceof RoSGNodeEvent);
        }
    }
}

/** One-shot warning when a pre-launch port event can't be re-targeted on the task thread. */
let warnedUnresolvedPortEvent = false;

/**
 * Replays pre-launch port events (see `collectPortNodeEvents`) into the task thread's restored
 * ports, re-targeting each event's node to its task-side instance. Events from nodes other than
 * the task node or the global node can't be resolved this early and are dropped with a warning.
 * @param portEvents Serialized events keyed by the `m` entry holding the port.
 * @param m The task-side `m` holding the restored ports.
 * @param taskNode The task node on the task thread.
 * @param globalNode The task thread's global node.
 */
export function replayPortNodeEvents(
    portEvents: Record<string, SerializedPortEvent[]>,
    m: RoAssociativeArray,
    taskNode: Node,
    globalNode: Node
): void {
    for (const [key, events] of Object.entries(portEvents)) {
        const port = m.get(new BrsString(key));
        if (!(port instanceof RoMessagePort)) {
            continue;
        }
        for (const event of events) {
            let target: Node | undefined;
            if (event.node === taskNode.getAddress()) {
                target = taskNode;
            } else if (event.node === globalNode.getAddress()) {
                target = globalNode;
            }
            if (!target) {
                if (!warnedUnresolvedPortEvent) {
                    warnedUnresolvedPortEvent = true;
                    BrsDevice.stderr.write(
                        `warning,[sg] Dropped pre-launch port event for field "${event.field}": source node not available on the task thread`
                    );
                }
                continue;
            }
            const info = event.info ? (brsValueOf(event.info) as RoAssociativeArray) : undefined;
            port.pushMessage(new RoSGNodeEvent(target, new BrsString(event.field), brsValueOf(event.value), info));
        }
    }
}

/**
 * Converts a roAssociativeArray to a ContentNode component
 * @param associativeArray The RoAssociativeArray to convert.
 * @returns A ContentNode object with the converted fields.
 */
export function toContentNode(associativeArray: RoAssociativeArray): ContentNode {
    const result: ContentNode = new ContentNode();

    for (const [key, value] of associativeArray.elements) {
        result.setValueSilent(key, value);
    }

    return result;
}

/**
 * Converts a ContentNode component into a roAssociativeArray
 * @param contentNode The content node to be converted
 * @returns An associative array with the converted data
 */
export function fromContentNode(contentNode: ContentNode): RoAssociativeArray {
    const result: RoAssociativeArray = new RoAssociativeArray([], true);

    for (const [key, value] of contentNode.getNodeFields()) {
        result.set(new BrsString(key), value.getValue(false));
    }

    return result;
}
