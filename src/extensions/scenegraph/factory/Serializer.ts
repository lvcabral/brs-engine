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
} from "brs-engine";
import { createFlatNode } from "./NodeFactory";
import { ContentNode, Node, SGNodeType } from "../nodes";
import { FieldKind, ObservedField } from "../SGTypes";
import { sgRoot } from "../SGRoot";

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
export function toSGNode(obj: any, type: string, subtype: string, child?: boolean, nodeMap?: Map<string, Node>): Node {
    // Initialize nodeMap on first call
    nodeMap ??= new Map<string, Node>();

    // Check if this is a circular reference
    if (obj["_circular_"] && obj["_address_"]) {
        const existingNode = nodeMap.get(obj["_address_"]);
        if (existingNode) {
            return existingNode;
        }
        // If we don't have the node yet, this might be a forward reference
        // Return invalid for now (should not happen in valid serialized data)
        return BrsInvalid.Instance as any;
    }
    // Guard the construction so media nodes (Video/Audio) rebuilt as cross-thread proxies do not run
    // their render-init (which would hijack the singleton sgRoot.video/audio and reset the real
    // player). Restore the prior value to stay correct under nested/recursive deserialization.
    const wasDeserializing = sgRoot.deserializing;
    sgRoot.deserializing = true;
    let newNode = createFlatNode(type, subtype);
    sgRoot.deserializing = wasDeserializing;
    if (newNode instanceof BrsInvalid) {
        newNode = new Node([], subtype);
    }
    // Store the node in the map using the original address for circular reference resolution
    // Use the address from serialized data if available, otherwise use the new node's address
    newNode.setAddress(obj["_address_"] || newNode.getAddress());
    newNode.setOwner(obj["_owner_"] ?? 0);
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
    // Recreate fields whose `invalid`/uninitialized value was omitted by JSON serialization, using
    // the preserved declared type so they exist (as `invalid`) on the receiving thread.
    for (const key in fieldTypes) {
        if (!(key in obj)) {
            newNode.setValueSilent(key, BrsInvalid.Instance, undefined, FieldKind.fromString(fieldTypes[key]));
        }
    }
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

/**
 * Converts a RoSGNode to a JavaScript object, converting each field to the corresponding JavaScript type.
 * @param node The RoSGNode to convert.
 * @param deep Whether to recursively convert child nodes. Defaults to true.
 * @param host Optional host node for observing context.
 * @param visited Optional WeakSet to track visited nodes and prevent circular references.
 * @returns A JavaScript object with the converted fields.
 */
export function fromSGNode(node: Node, deep: boolean = true, host?: Node, visited?: WeakSet<object>): FlexObject {
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
                result[name] = fromSGNode(fieldValue, deep, host, visited);
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
    const children = node.getNodeChildren();
    if (deep && children.length > 0) {
        result["_children_"] = children.map((child: BrsType) => {
            if (child instanceof Node) {
                return fromSGNode(child, deep, host, visited);
            }
            return { _invalid_: null };
        });
    }

    return result;
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
