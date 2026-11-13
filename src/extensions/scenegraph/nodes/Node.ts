import {
    AAMember,
    BrsBoolean,
    BrsEvent,
    BrsInvalid,
    BrsString,
    BrsType,
    BrsValue,
    FlexObject,
    getTextureManager,
    isBoxable,
    isBrsString,
    isInvalid,
    isUnboxable,
    RoArray,
    RoAssociativeArray,
    RoFunction,
    RoMessagePort,
    Uninitialized,
    ValueKind,
    genHexAddress,
    generateArgumentMismatchError,
    Rect,
    IfDraw2D,
    Stmt,
    Callable,
    Interpreter,
    BrsDevice,
    RuntimeError,
    BrsError,
    SyncType,
} from "brs-engine";
import {
    FieldAlias,
    FieldEntry,
    FieldKind,
    FieldModel,
    FreshFieldBudget,
    FreshFieldWindowMS,
    FreshFieldState,
    ObserverScope,
    FieldAliasTarget,
    isTaskLike,
    MethodCallPayload,
} from "../SGTypes";
import { RoSGNode } from "../components/RoSGNode";
import { createFlatNode, createNode, getBrsValueFromFieldType, subtypeHierarchy } from "../factory/NodeFactory";
import { Field } from "../nodes/Field";
import { toAssociativeArray, jsValueOf, fromSGNode } from "../factory/Serializer";
import { sgRoot } from "../SGRoot";
import { SGNodeType } from ".";
import { ComponentDefinition } from "../parser/ComponentDefinition";
import { convertHexColor, IDENTITY_SCENE_MAP } from "../SGUtil";
import type { Task } from "./Task";

type ChangeOperation = "none" | "insert" | "add" | "remove" | "set" | "clear" | "move" | "setall" | "modify";

/** The field of a `focusedChild` write held back until its focus transaction is fully committed. */
type StagedFocus = Field;

/** Reads the RSGPalette `colors` set held directly on `node` (an RSGPalette in its `palette` field). */
function paletteColorsOf(node: Node): RoAssociativeArray | undefined {
    const palette = node.getValue("palette");
    if (palette instanceof Node) {
        const colors = palette.getValue("colors");
        if (colors instanceof RoAssociativeArray) {
            return colors;
        }
    }
    return undefined;
}

/**
 * Base implementation for a SceneGraph node used by custom Roku components.
 * Handles BrightScript-facing field management, child lists, focus, observers, and rendering plumbing.
 */
export class Node extends RoSGNode implements BrsValue {
    /**
     * Per-node-class registry of `hidden` default fields (name → model), shared across all
     * instances of a class. Hidden default fields are metadata that is already excluded from
     * getFields/serialization, so they are NOT materialized as `Field` objects up front — they
     * live only in this spec and `resolveField` builds a real `Field` the first time one is read
     * or written. A ContentNode has 103 hidden defaults but a program typically touches ~4, so
     * this avoids ~100 `Field` allocations per node — critical for large content trees (EPG grids).
     */
    private static readonly hiddenSpecCache = new WeakMap<Function, Map<string, FieldModel>>();
    /** Reference to this instance's class spec (see hiddenSpecCache). */
    private hiddenFieldSpec?: Map<string, FieldModel>;
    /**
     * Set while a focus transaction stages its `focusedChild` writes: `setValue` applies the value
     * but routes the notification here instead of dispatching it — see `stageFocusedChild`.
     */
    private static focusStagingSink: StagedFocus[] | undefined;
    /**
     * The `focusedChild` notifications of the focus transaction dispatching now. A `setFocus` raised from
     * one of them appends its own to this round instead of dispatching them (see `notifyStagedFocus`).
     */
    private static focusRound: { queue: StagedFocus[]; fields: Set<Field> } | undefined;
    /** Field registry keyed by lowercase name. */
    protected readonly fields: Map<string, Field>;
    /** Alias definitions pointing to fields on child nodes. */
    protected readonly aliases: Map<string, FieldAlias>;
    /** Component definition metadata used for field and function resolution. */
    protected readonly componentDef?: ComponentDefinition;
    /** Set of function names defined on this component for quick lookup. */
    protected readonly funcNames: Set<string> = new Set();
    /** Custom component whose XML `<children>` created this node, if any (see `findNodeById`). */
    componentOwner?: Node;
    /** Ordered list of child nodes retained as BrightScript values. */
    protected readonly children: (Node | BrsInvalid)[];
    /** Guards initial focus hand-off so it only runs once. */
    protected triedInitFocus: boolean = false;
    /** Tracks whether the most recent field mutation triggered observers. */
    protected notified: boolean = false;
    /** Tracks recently synchronized fields to avoid redundant rendezvous calls. */
    protected readonly freshFields: Map<string, FreshFieldState> = new Map();

    /** Parent node reference or invalid when detached. */
    protected parent: Node | BrsInvalid;
    /** Thread identifier that owns the node instance. */
    protected owner: number;
    /**
     * Marks this instance as an address-only stand-in for a node owned by another thread: it was
     * rebuilt from a reference carrying no fields, so its field list is *incomplete* and a miss
     * means "not mirrored yet", not "does not exist". Reads of an unknown field therefore have to
     * rendezvous to the owner instead of answering `invalid` locally (see `get`).
     */
    protected remoteProxy: boolean = false;
    /** Sync domain used for remote field and method requests. */
    protected syncType: SyncType;
    /** Hex-like identifier exposed via introspection APIs. */
    protected address: string;
    /** Flags whether structural or field state changed since last render. */
    changed: boolean = false;
    /**
     * True when this node or anything below it changed since its subtree last completed a layout
     * pass. Set by `makeDirty()` (the funnel for every field write and child-list mutation) and
     * propagated UP the parent chain, so a pruned layout refresh (`sgRoot.pruneLayout`) can skip
     * settled subtrees. Cleared at the START of a node's layout pass — BrightScript running
     * inside the pass (an item component's init(), a field observer) re-marks it and that mark
     * must survive for the next refresh. Starts true so everything lays out on first pass.
     */
    subtreeStale: boolean = true;
    /**
     * True when this node or anything below it was WRITTEN since its subtree last completed any
     * layout pass — a full one or a scoped mid-render measurement. Set alongside `subtreeStale` by
     * `markSubtreeStale()`, but cleared independently, because the two answer different questions:
     *
     * - `subtreeStale` — "may a pruned full refresh skip this subtree?" A scoped measurement at
     *   origin [0,0] must LEAVE it set (`markSubtreeStaleDeep`), since it clobbered the subtree's
     *   `rectToScene` with origin-less values that only a full refresh can re-establish.
     * - `measureStale` — "would re-measuring this subtree produce a different size?" Sizes are
     *   translation-invariant, so the scoped measurement fully answers it and CLEARS this flag.
     *
     * Sharing one flag forced a bad trade: keyed on `subtreeStale`, every repeat mid-render query
     * re-rendered the subtree (the deep mark it just set made itself look stale again); keyed on a
     * degenerate rect alone, a repeat query returned a stale cached size after the app changed
     * something. This flag lets a changed subtree re-measure while an unchanged repeat hits the cache.
     */
    measureStale: boolean = true;

    /** Node bounds in local coordinates. */
    rectLocal: Rect = { x: 0, y: 0, width: 0, height: 0 };
    /** Node bounds relative to its parent. */
    rectToParent: Rect = { x: 0, y: 0, width: 0, height: 0 };
    /** Node bounds in the scene coordinate space. */
    rectToScene: Rect = { x: 0, y: 0, width: 0, height: 0 };

    /** Built-in fields automatically registered for every node. */
    readonly defaultFields: FieldModel[] = [
        { name: "id", type: FieldKind.String },
        { name: "focusable", type: FieldKind.Boolean },
        { name: "focusedChild", type: FieldKind.Node, alwaysNotify: true },
        { name: "change", type: FieldKind.AssocArray },
    ];

    /**
     * Creates a new node instance, registering default and initial fields.
     * @param initializedFields Associative-array style entries coming from XML attributes.
     * @param nodeSubtype Concrete subtype identifier used for serialization and debugging.
     * @param nodeType Optional explicit node type to map in inheritance hierarchy.
     */
    constructor(
        initializedFields: AAMember[] = [],
        readonly nodeSubtype: string = SGNodeType.Node,
        nodeType?: SGNodeType
    ) {
        super([], nodeSubtype);
        this.syncType = "node";
        this.address = genHexAddress();
        this.fields = new Map();
        this.aliases = new Map();
        this.children = [];
        this.parent = BrsInvalid.Instance;
        this.owner = sgRoot.threadId;
        if (nodeType) {
            this.setExtendsType(nodeSubtype, nodeType);
        }

        // All nodes start have some built-in fields when created.
        this.registerDefaultFields(this.defaultFields);

        // After registering default fields, then register fields instantiated with initial values.
        this.registerInitializedFields(initializedFields);

        this.setValueSilent("change", toAssociativeArray({ Index1: 0, Index2: 0, Operation: "none" }));
        this.componentDef = sgRoot.nodeDefMap.get(this.nodeSubtype.toLowerCase());
        this.funcNames = new Set(Object.keys(this.componentDef?.functions ?? {}).map((name) => name.toLowerCase()));
    }

    /**
     * Formats the node and its visible fields similar to Roku's inspector output.
     * @param parent Optional parent BrightScript value to mimic RBI formatting rules.
     * @returns String representation of the node.
     */
    toString(parent?: BrsType): string {
        const componentName = `${this.getComponentName()}:${this.nodeSubtype}`;
        if (parent) {
            return `<Component: ${componentName}>`;
        }
        const systemFields: FieldEntry[] = [];
        const otherFields: FieldEntry[] = [];
        for (const [key, field] of this.fields.entries()) {
            if (field.isHidden()) {
                continue;
            }
            const alias = this.aliases.get(key);
            const name = alias ? alias.aliasName : field.getName();
            if (field.isSystem() && !this.aliases.has(key)) {
                systemFields.push({ name, field });
                continue;
            }
            otherFields.push({ name, field });
        }
        otherFields.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        const allFields = [...systemFields, ...otherFields];
        return [
            `<Component: ${componentName}> =`,
            "{",
            ...allFields.map(({ name, field }) => `    ${name}: ${field.toString(this)}`),
            "}",
        ].join("\n");
    }

    /**
     * Returns the names of all registered fields sorted alphabetically.
     * @returns Array of BrightScript strings.
     */
    getElements() {
        const fieldNames: string[] = [];
        for (const [key, field] of this.fields.entries()) {
            const alias = this.aliases.get(key);
            const name = alias ? alias.aliasName : field.getName();
            if (name) {
                fieldNames.push(name);
            }
        }
        return fieldNames
            .toSorted((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
            .map((name) => new BrsString(name));
    }

    /**
     * Returns the current values of all registered fields sorted by field name.
     * @returns Array of BrightScript field values.
     */
    getValues() {
        return Array.from(this.fields.values())
            .map((field: Field) => ({ field, name: field.getName().toLowerCase() }))
            .toSorted((a, b) => a.name.localeCompare(b.name))
            .map(({ field }) => field.getValue());
    }

    /**
     * Provides direct access to the internal field map. Used by serialization helpers.
     * @returns Map keyed by lowercase field names.
     */
    getNodeFields() {
        return this.fields;
    }

    /**
     * Converts the current field map into an associative array, omitting hidden fields.
     * @returns BrightScript AA mirroring the node's public field values.
     */
    protected getNodeFieldsAsAA(): RoAssociativeArray {
        const packagedFields: AAMember[] = [];
        for (const [key, field] of this.fields.entries()) {
            if (field.isHidden()) {
                continue;
            }
            const alias = this.aliases.get(key);
            const fieldName = alias ? alias.aliasName : field.getName();
            if (fieldName) {
                packagedFields.push({ name: new BrsString(fieldName), value: field.getValue() });
            }
        }
        return new RoAssociativeArray(packagedFields);
    }

    /**
     * Converts the node's field type metadata into an associative array.
     * @returns BrightScript AA with field names mapped to type strings.
     */
    protected getNodeFieldTypes(): RoAssociativeArray {
        const packagedFields: AAMember[] = [];
        for (const [key, field] of this.fields.entries()) {
            if (field.isHidden()) {
                continue;
            }
            const alias = this.aliases.get(key);
            const fieldName = alias ? alias.aliasName : field.getName();
            if (fieldName) {
                packagedFields.push({ name: new BrsString(fieldName), value: new BrsString(field.getType()) });
            }
        }
        return new RoAssociativeArray(packagedFields);
    }

    /**
     * Checks if the node currently defines a field by the provided name.
     * @param fieldName Field name in any casing.
     * @returns True when the field exists.
     */
    hasNodeField(fieldName: string): boolean {
        const mapKey = fieldName.toLowerCase();
        // A not-yet-materialized hidden default field still exists.
        return this.fields.has(mapKey) || (this.hiddenFieldSpec?.has(mapKey) ?? false);
    }

    /**
     * Validates whether the specified field can accept the supplied value.
     * @param fieldName Field to validate against.
     * @param value BrightScript value candidate.
     * @returns True if the value passes validation.
     */
    protected canAcceptValue(fieldName: string, value: BrsType): boolean {
        const field = this.resolveField(fieldName.toLowerCase());
        if (!field?.canAcceptValue(value)) {
            return false;
        }
        return true;
    }

    /**
     * Removes all removable fields from the node, clearing dynamic state.
     */
    protected clearNodeFields() {
        for (const [name, _] of this.fields) {
            this.removeFieldEntry(name);
        }
    }

    /**
     * Returns the raw child collection used by SceneGraph for rendering.
     * @returns Array of child BrightScript values.
     */
    getNodeChildren(): BrsType[] {
        return this.children;
    }

    /**
     * Whether this node's children should be included in cross-thread serialization.
     *
     * Most nodes serialize their children so a Task thread sees the full subtree. But a
     * built-in composite node (e.g. Video) builds its visible children internally in its
     * constructor and keeps private references to them (`this.trickPlayBar`, the spinner,
     * the header labels, …), updating those references every frame (`showUI`). If such a
     * node's children are serialized, a Task's reconciliation (`updateSGNode`) replaces
     * the render-thread children with fresh deserialized copies while the private field
     * references keep pointing at the originals — so per-frame updates land on nodes that
     * are no longer in the render tree and the overlay silently stops appearing. These
     * nodes override this to opt out; their children never need to cross a thread because a
     * Task never renders them.
     * @returns True when children participate in cross-thread serialization.
     */
    serializesChildren(): boolean {
        return true;
    }

    /**
     * Looks up a field or method by name, mimicking BrightScript associative-array semantics.
     * @param index Field or method name as a BrightScript string value.
     * @throws Error when an unsupported index type is provided.
     * @returns Field value, method, or invalid when missing.
     */
    get(index: BrsType): BrsType {
        if (!isBrsString(index)) {
            throw new Error("Node indexes must be strings");
        }
        const key = index.toString().toLowerCase();
        if (this.shouldRendezvous()) {
            // An address-only proxy knows none of the owner's fields, so an unknown key there means
            // "not mirrored yet" and must still rendezvous — otherwise every field the owner added
            // at runtime (addField/addFields, or a subclass's own XML interface) reads back invalid
            // without ever asking the owner. Methods resolve locally either way.
            const mirrored = this.hasNodeField(key);
            if (!mirrored && !this.remoteProxy) {
                return this.getMethod(key) || BrsInvalid.Instance;
            }
            if (!mirrored) {
                const method = this.getMethod(key);
                if (method) {
                    return method;
                }
            }
            const task = sgRoot.getCurrentThreadTask();
            // By default every read of a render-owned field rendezvouses, matching real Roku
            // behavior ("each dot represents a distinct rendezvous"). The freshFields read-cache
            // is only consulted in the opt-in `fastFieldReads` performance mode.
            if (task?.active && !(sgRoot.fastFieldReads && this.consumeFreshField(key))) {
                task.requestFieldValue(this.syncType, this.address, key);
            }
        }
        const field = this.resolveField(key);
        if (field) {
            const value = field.getValue();
            if (value instanceof RoAssociativeArray || value instanceof RoArray) {
                // Reading an `assocarray`/`array` field hands back a copy of the *container* (Roku
                // does not let the app mutate the stored value in place), but any node inside stays
                // the same node — apps stash component handles in such a field and `callFunc` them
                // after reading it back, which a clone (empty script scope) would break.
                return value.deepCopy(true);
            } else if (isUnboxable(value)) {
                return value.copy();
            } else if (sgRoot.inTaskThread() && value instanceof Node) {
                value.setOwner(this.owner);
            }
            return value;
        }
        return this.getMethod(key) || BrsInvalid.Instance;
    }

    /**
     * Retrieves a field's BrightScript value or `invalid` if the field is unknown.
     * @param fieldName Name of the field to fetch.
     * @returns Stored BrightScript value.
     */
    getValue(fieldName: string) {
        const field = this.resolveField(fieldName.toLowerCase());
        return field ? field.getValue() : BrsInvalid.Instance;
    }

    /**
     * Retrieves a plain JavaScript representation of a field's value, if possible.
     * @param fieldName Name of the field to fetch.
     * @returns Native JS value or undefined.
     */
    getValueJS(fieldName: string) {
        const field = this.resolveField(fieldName.toLowerCase());
        const value = field?.getValue();
        return field && value ? jsValueOf(value) : undefined;
    }

    /**
     * Sets or aliases a field value, performing type validation and notification.
     * @param index Field name to update.
     * @param value New BrightScript value.
     * @param alwaysNotify When provided, controls observer notification behavior for new fields.
     * @param kind Optional explicit field kind used when creating new dynamic fields.
     * @param sync Optional flag indicating whether to synchronize this field change with other threads.
     */
    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind, sync: boolean = true) {
        // A device COPIES an assigned assocarray/array into the field — `setRef` exists to opt out
        // (probe S3.1) — so mutating the caller's container afterwards cannot rewrite the field. This
        // sits at the app-facing funnel, which every app write reaches (`node.f = x`, `setField`,
        // `setFields`, `addFields`, `update`), INCLUDING the new-field branch below that builds its
        // `Field` directly. Keeping it out of `Field.setValue` leaves the storage primitive free for
        // engine-internal writes (`setValueSilent`, cross-thread mirrors) and for `moveIntoField`,
        // which `ifSGNodeField` defines as the no-copy path. Nodes inside are carried, not cloned.
        if (value instanceof RoAssociativeArray || value instanceof RoArray) {
            value = value.deepCopy();
        }
        const mapKey = index.toLowerCase();
        const fieldType = kind ?? FieldKind.fromBrsType(value);
        let field = this.resolveField(mapKey);
        if (field && field.getType() !== FieldKind.String && isBrsString(value)) {
            value = getBrsValueFromFieldType(field.getType(), value.getValue(), field.getValue());
        }
        let errorMsg = "";
        try {
            if (!field) {
                if (fieldType && alwaysNotify !== undefined) {
                    field = new Field(index, value, fieldType, alwaysNotify);
                    this.fields.set(mapKey, field);
                    this.notified = true;
                    this.makeDirty();
                } else if (BrsDevice.isDevMode && fieldType !== undefined) {
                    errorMsg = `BRIGHTSCRIPT: ERROR: roSGNode.Set: Tried to set nonexistent field "${index}" of a "${this.nodeSubtype}" node:`;
                }
            } else if (field.canAcceptValue(value)) {
                // A `focusedChild` write made while a focus transaction is staging is applied now
                // but notified later, once the whole chain is committed — see stageFocusedChild.
                const sink = mapKey === "focusedchild" ? Node.focusStagingSink : undefined;
                this.notified = field.setValue(value, sink === undefined);
                if (sink) {
                    sink.push(field);
                }
                this.fields.set(mapKey, field);
                const alias = this.aliases.get(mapKey);
                if (alias) {
                    for (const target of alias.targets) {
                        const child = this.findNodeById(this, target.nodeId, true);
                        if (child instanceof Node) {
                            child.setValue(target.fieldName, value);
                        }
                    }
                }
                this.makeDirty();
            } else if (!isInvalid(value)) {
                errorMsg = `BRIGHTSCRIPT: ERROR: roSGNode.AddReplace: "${this.nodeSubtype}.${index}": Type mismatch!`;
            }
        } catch (err: any) {
            if (err instanceof BrsError) {
                throw err;
            }
            errorMsg = `WARNING: roSGNode.Set (unhandled exception): "${this.nodeSubtype}.${index}": ${err.message}`;
            throw new BrsError(errorMsg);
        }
        if (errorMsg.length > 0) {
            BrsDevice.stderr.write(`warning,${errorMsg} ${this.location || "(internal)"}`);
        }
        this.markFieldFresh(mapKey);
        field?.setContainer(this);
        if (field && sync && this.syncType !== "task") {
            this.rendezvousSet(mapKey, field);
        }
    }

    /**
     * Writes a field value bypassing validation and observer notification.
     * @param fieldName Field name to mutate.
     * @param value Value to assign.
     * @param hidden Optional hidden flag override applied when creating the field.
     */
    setValueSilent(fieldName: string, value: BrsType, hidden?: boolean, kind?: FieldKind) {
        const mapKey = fieldName.toLowerCase();
        let field = this.resolveField(mapKey);
        if (field) {
            field.setValue(value, false);
            if (hidden !== undefined) {
                field.setHidden(hidden);
            }
        } else {
            // Prefer the value-inferred kind; fall back to the explicit kind (e.g. from serialized
            // field metadata) so fields holding `invalid` are still created with their declared type.
            const fieldType = FieldKind.fromBrsType(value) ?? kind;
            if (fieldType) {
                field = new Field(fieldName, value, fieldType, false, false, hidden ?? false);
            }
        }
        if (field) {
            this.fields.set(mapKey, field);
            field.setContainer(this);
            this.makeDirty();
        }
        this.markFieldFresh(mapKey);
    }

    /**
     * Returns the node's `id` field or the subtype if unset.
     * @returns Node identifier string.
     */
    getId(): string {
        return this.getValueJS("id") ?? this.nodeSubtype;
    }

    /**
     * Implements BrightScript's `clone` semantics for SceneGraph nodes.
     * @param isDeepCopy When true child nodes are recursively duplicated.
     * @param interpreter Interpreter context for error reporting.
     * @param visitedNodes Graph cache preventing infinite recursion.
     * @returns Cloned node or invalid on error.
     */
    protected cloneNode(
        isDeepCopy: boolean,
        interpreter?: Interpreter,
        visitedNodes?: WeakMap<RoSGNode, RoSGNode>
    ): BrsType {
        visitedNodes ??= new WeakMap<RoSGNode, RoSGNode>();
        if (visitedNodes.has(this)) {
            return visitedNodes.get(this)!;
        }
        // Device quirk (probe `clone-basetype-probe`, D0 vs D1-D4): a custom component whose ROOT
        // built-in base is `Node` clones to a BARE `Node` — subtype, fields, functions and script scope
        // all dropped. Any other root preserves everything. `nodeType` is the root (`getNodeType` walks
        // the chain), so a `Node`-rooted custom-extends-custom chain also bare-clones — inferred from
        // the rule, not measured. Do NOT generalise; see `.claude/docs/scenegraph-invariants.md`.
        const bareClone = this.nodeType === SGNodeType.Node && this.componentDef !== undefined;
        const clonedNode = createFlatNode(this.nodeType, bareClone ? this.nodeType : this.nodeSubtype);
        if (!(clonedNode instanceof RoSGNode)) {
            return BrsInvalid.Instance;
        }
        visitedNodes.set(this, clonedNode);
        if (this.componentOwner && clonedNode instanceof Node) {
            // Owners are cloned before their internals, so a deep-cloned component keeps owning its copies.
            const owner = visitedNodes.get(this.componentOwner);
            clonedNode.componentOwner = owner instanceof Node ? owner : this.componentOwner;
        }
        // Clone fields
        for (const [key, field] of this.fields) {
            // Before the alias check: a bare clone drops this key entirely, so an aliased field must
            // not abort the clone with "No such field" — a device still returns the bare `Node`.
            if (bareClone && !clonedNode.fields.has(key)) {
                continue;
            }
            if (this.aliases.has(key) && interpreter) {
                const parentType = subtypeHierarchy.get(this.nodeSubtype) ?? "Node";
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGNode.Clone: No such field ${parentType}::${key}: ${
                        interpreter?.formatLocation() ?? ""
                    }`
                );
                return BrsInvalid.Instance;
            }
            // Own `Field` per key so a write through the clone cannot reach the original, but a
            // node-valued field keeps pointing at the SAME node — device-confirmed (probe S10):
            // `clone.nodeField` is `isSameNode` with the original's, its script scope is intact, and
            // a write through it lands on the shared node. Only CHILDREN are duplicated, below.
            clonedNode.fields.set(key, field.copy());
        }
        // Clone children if deep copy param is set
        if (isDeepCopy) {
            for (const child of this.children) {
                let newChild: BrsType = BrsInvalid.Instance;
                if (child instanceof RoSGNode) {
                    newChild = child.cloneNode(true, interpreter, visitedNodes);
                }
                clonedNode.appendChildToParent(newChild);
            }
        }
        return clonedNode;
    }

    /**
     * Transfers associative array contents into a field, copying complex values.
     * @param fieldName Destination field.
     * @param data Source associative array.
     * @returns Result metadata mirroring Roku behavior.
     */
    protected moveObjectIntoField(fieldName: string, data: RoAssociativeArray) {
        const field = this.resolveField(fieldName.toLowerCase());
        if (field === undefined) {
            return { code: -1, msg: `Could not find field '"${fieldName}"'` };
        } else if (field.getType() !== FieldKind.AssocArray) {
            return { code: -1, msg: `Field has wrong field type` };
        }
        const moved: AAMember[] = [];
        for (const [key, value] of data.elements) {
            if (value instanceof RoSGNode) {
                // A node is moved, not duplicated — device-confirmed (probe S9): the moved value is the
                // same node, script scope included. Listed explicitly because a node is neither boxable
                // nor unboxable, so it would otherwise fall through and be dropped.
                moved.push({ name: new BrsString(key), value });
            } else if (value instanceof RoArray || value instanceof RoAssociativeArray) {
                // `ifSGNodeField`: a nested object holding external references is "preserved by copying
                // it instead" of moved. This is the only copy on this path — `Field.setValue` is the
                // storage primitive and does not copy — and it is pinned by the device-derived
                // `node.aa.bar` expectation in `test/e2e/resources/components/roUtils.brs`.
                moved.push({ name: new BrsString(key), value: value.deepCopy() });
            } else if (isBoxable(value) && !(value instanceof Callable)) {
                moved.push({ name: new BrsString(key), value });
            } else if (isUnboxable(value) && !(value instanceof RoFunction)) {
                moved.push({ name: new BrsString(key), value: value.copy() });
            }
        }
        const refs = data.clearElements();
        field.setValue(new RoAssociativeArray(moved, data.isCaseSensitive()), true);
        this.makeDirty();
        return { code: refs };
    }

    /**
     * Moves the contents of an associative-array field into a return value.
     * @param fieldName Field to clear and return.
     * @returns The moved value or an error string.
     */
    protected moveObjectFromField(fieldName: string): BrsType | string {
        const field = this.resolveField(fieldName.toLowerCase());
        if (field === undefined) {
            return `Could not find field '"${fieldName}"'`;
        } else if (field.getType() !== FieldKind.AssocArray) {
            return `cannot moveFromField on non-assocarray fields`;
        }
        const value = field.getValue();
        field.setValue(BrsInvalid.Instance, true);
        this.makeDirty();
        return value;
    }

    /**
     * Adds a new dynamic field if it does not already exist.
     * @param fieldName Name of the field to create.
     * @param type Roku field type string.
     * @param alwaysNotify Whether observers should always fire for the field.
     * @param sync Whether the field update should be synchronized with other threads.
     * @param silent When true the field is created without notifying observers or rendezvousing
     *        (used to mirror a field already added authoritatively on the owning thread).
     */
    addNodeField(fieldName: string, type: string, alwaysNotify: boolean, sync?: boolean, silent = false) {
        let defaultValue = getBrsValueFromFieldType(type);
        let fieldKind = FieldKind.fromString(type);

        if (defaultValue !== Uninitialized.Instance && !this.hasNodeField(fieldName.toLowerCase())) {
            if (silent) {
                this.setValueSilent(fieldName, defaultValue, undefined, fieldKind);
            } else {
                this.setValue(fieldName, defaultValue, alwaysNotify, fieldKind, sync);
            }
            this.makeDirty();
        }
    }

    /**
     * Registers a field alias pointing to one or more child node fields.
     * @param aliasName Local alias name.
     * @param targets Array of target fields with their node IDs and field names.
     * @param sharedField Field instance representing the alias.
     */
    addNodeFieldAlias(aliasName: string, targets: FieldAliasTarget[], sharedField: Field) {
        // Use the first target's field as the primary field for type checking and reading
        if (targets.length > 0) {
            this.fields.set(aliasName.toLowerCase(), sharedField);
            this.aliases.set(aliasName.toLowerCase(), { aliasName, targets });
        }
    }

    /**
     * Appends field definitions from another node or associative array.
     * @param fieldsToAppend Field source.
     */
    protected appendNodeFields(fieldsToAppend: BrsType) {
        if (fieldsToAppend instanceof RoAssociativeArray) {
            for (const [key, value] of fieldsToAppend.elements) {
                this.setValueSilent(key, value);
            }
        } else if (fieldsToAppend instanceof Node) {
            for (const [key, value] of fieldsToAppend.getNodeFields()) {
                this.fields.set(key, value);
                this.makeDirty();
            }
        }
    }

    /**
     * Sets one or more fields from an associative array.
     * @param fieldsToSet Data source.
     * @param addFields If true, missing fields are created.
     * @param silent When true the fields are set without notifying observers or rendezvousing
     *        (used to mirror fields already added authoritatively on the owning thread).
     */
    protected setNodeFields(fieldsToSet: RoAssociativeArray, addFields: boolean, silent = false) {
        for (const [key, value] of fieldsToSet.elements) {
            if (addFields || (!addFields && this.hasNodeField(key.toLowerCase()))) {
                if (silent) {
                    this.setValueSilent(key, value);
                } else {
                    this.setValue(key, value, false);
                }
                this.makeDirty();
            }
        }
    }

    /**
     * Applies associative-array or array content to this node or its children.
     * @param interpreter Active interpreter for logging.
     * @param content AA or array describing fields/children.
     * @param createFields Whether to create missing fields.
     */
    protected updateFields(interpreter: Interpreter, content: BrsType, createFields: boolean) {
        if (content instanceof RoAssociativeArray) {
            this.populateNodeFromAA(interpreter, this, content, createFields, this.nodeSubtype);
        } else if (content instanceof RoArray) {
            this.updateChildrenFromArray(interpreter, this, content, createFields, this.nodeSubtype);
        }
    }

    /**
     * Copies an associative array by reference into a field when allowed.
     * @param fieldName Destination field.
     * @param data Source AA.
     * @returns Roku-style status code.
     */
    protected setFieldByRef(fieldName: string, data: RoAssociativeArray): number {
        const field = this.resolveField(fieldName.toLowerCase());
        if (!field) {
            return -1;
        } else if (field.getType() === FieldKind.AssocArray) {
            field.setValue(data, false, true);
            return 1;
        }
        return 0;
    }

    /**
     * Checks whether `getFieldByRef` is allowed for a field.
     * @param fieldName Field to inspect.
     * @returns True when the field can be returned by reference.
     */
    protected canGetFieldByRef(fieldName: string): boolean {
        const field = this.resolveField(fieldName.toLowerCase());
        return !!field && field.getType() === FieldKind.AssocArray && field.isValueRef();
    }

    /**
     * Returns an associative array field by reference when permitted.
     * @param fieldName Field to fetch.
     * @returns The AA reference or an error string.
     */
    protected getFieldByRef(fieldName: string): RoAssociativeArray | string {
        const field = this.resolveField(fieldName.toLowerCase());
        if (field === undefined) {
            return `Could not find field '"${fieldName}"'`;
        } else if (field.getType() === FieldKind.AssocArray && field.isValueRef()) {
            const value = field.getValue();
            if (value instanceof RoAssociativeArray) {
                return value;
            }
        }
        return "";
    }

    /**
     * Returns the parent node or invalid when unattached.
     * @returns Parent node reference or BrsInvalid.
     */
    getNodeParent() {
        return this.parent;
    }

    /**
     * Resolves the RSGPalette color set that themes this node.
     *
     * On Roku, palette colors cascade down the scene graph: a node is themed by the nearest
     * `palette` (an RSGPalette node holding a `colors` assocarray) found by walking up from itself
     * through its ancestors — its own `palette` field first, then each parent up to the Scene. This
     * is the resolution documented for the DynamicKeyGrid, but it is a general capability every node
     * shares (Scene, StandardDialog, the dynamic keyboards, …). Returns the matched `colors`
     * assocarray, or `undefined` when no node in the chain sets a palette.
     */
    resolvePaletteColors(): RoAssociativeArray | undefined {
        // Check this node first, then walk up through its ancestors.
        const own = paletteColorsOf(this);
        if (own) {
            return own;
        }
        let ancestor: Node | BrsInvalid = this.getNodeParent();
        while (ancestor instanceof Node) {
            const colors = paletteColorsOf(ancestor);
            if (colors) {
                return colors;
            }
            ancestor = ancestor.getNodeParent();
        }
        return undefined;
    }

    /**
     * Resolves a single named palette color (as an `0xRRGGBBAA` integer) for this node, returning
     * `fallback` when no ancestor palette is set or it lacks the named color. Palette color values
     * may be stored as integers or as hex-string colors (e.g. "0xRRGGBBAA" / "#RRGGBBAA"); both are
     * accepted so an app-supplied RSGPalette works regardless of how its colors were written.
     */
    resolvePaletteColor(name: string, fallback: number): number {
        const colors = this.resolvePaletteColors();
        if (colors) {
            const color = colors.get(new BrsString(name));
            if (isBrsString(color)) {
                // convertHexColor returns a signed 32-bit int, so a high-alpha color like
                // "0xE13100FF" parses negative, and opaque white collides with its -1 invalid
                // sentinel — validate the hex digits here instead of gating on the parsed sign.
                const hex = color
                    .getValue()
                    .trim()
                    .replace(/^(#|0x|&h)/i, "");
                if (/^[0-9a-f]{1,8}$/i.test(hex)) {
                    return convertHexColor(hex);
                }
            } else {
                const value = jsValueOf(color);
                if (typeof value === "number") {
                    return value;
                }
            }
        }
        return fallback;
    }

    /**
     * Assigns a new parent reference.
     * @param parent Node that is adopting this node.
     */
    setNodeParent(parent: Node) {
        this.parent = parent;
        this.restoreFocusChainOnAttach();
    }

    /**
     * Repairs the `focusedChild` ancestry after this node gains a parent.
     *
     * When focus is set on a node before it is attached to its parent — e.g. a custom component
     * calling `m.top.setFocus(true)` in `init()`, which runs before the node is appended — the
     * focus chain built at that moment only reaches the still-parentless node, so the ancestors
     * above it never get their `focusedChild` pointers set. Now that a parent exists, re-establish
     * the chain from the root down to the focused node so `focusedChild` stays consistent with the
     * live focus, as it is on a real device.
     */
    private restoreFocusChainOnAttach() {
        const focused = sgRoot.focused;
        if (!(focused instanceof Node)) {
            return;
        }
        // Only act when the live focus is this node or one of its descendants (cheap upward walk).
        let ancestor: BrsType = focused;
        while (ancestor instanceof Node && ancestor !== this) {
            ancestor = ancestor.parent;
        }
        if (ancestor !== this) {
            return;
        }
        const chain = this.createPath(focused); // [root, ..., focused]
        // Repairing the chain is a focus transaction like any other: stage every write, then notify,
        // so an observer never reads a half-repaired chain (see stageFocusedChild).
        const staged: StagedFocus[] = [];
        for (let i = 0; i < chain.length - 1; i++) {
            if (chain[i].getValue("focusedchild") !== chain[i + 1]) {
                chain[i].stageFocusedChild(chain[i + 1], staged);
            }
        }
        Node.notifyStagedFocus(staged);
    }

    /**
     * Clears the parent reference, marking the node as detached.
     */
    removeParent() {
        this.parent = BrsInvalid.Instance;
    }

    /**
     * Performs a depth-first search to determine if any descendant currently has focus.
     * @returns True when a focused child exists.
     */
    protected isChildrenFocused(): boolean {
        if (this.children.length === 0) {
            return false;
        }
        for (const childNode of this.children) {
            if (!(childNode instanceof Node)) {
                continue;
            }
            if (sgRoot.focused === childNode || childNode.isChildrenFocused()) {
                return true;
            }
        }
        return false;
    }

    /**
     * Indicates whether the node can accept focus, based on its `focusable` field.
     * @returns True when focusable.
     */
    isFocusable() {
        return (this.getValueJS("focusable") as boolean) ?? false;
    }

    /**
     * Base render entry point that simply delegates to child nodes.
     * @param interpreter Active interpreter.
     * @param origin Parent-space translation.
     * @param angle Accumulated rotation.
     * @param opacity Accumulated opacity.
     * @param draw2D Drawing interface (optional in headless flows).
     */
    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        this.renderChildren(interpreter, origin, angle, opacity, draw2D);
    }

    /**
     * Layout entry point: computes bounding rects for this node's subtree without drawing,
     * advancing time-based state, or producing any other side effect. Must be idempotent —
     * calling it twice with the same inputs and an unchanged tree yields identical rects.
     * Default implementation runs `renderNode` with no draw target (today's measurement pass)
     * under a `layout` render-pass context; node types with time-based render state gate that
     * state on `isPaintPass`. See `docs/scenegraph-layout-passes.md`.
     */
    layoutNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number) {
        const previousPass = sgRoot.renderPass;
        // `paintSuppressed` must be cleared as well as `renderPass`, or a layout pass STARTED from inside
        // a suppressed paint inherits it and every node reads `isLayoutPass()` as false. Reachable on every
        // fade: `getBoundingRect`'s mid-render fallback and `LayoutGroup.measureUnsizedChildren` both call
        // this from within the paint traversal (app observers and item `init()` measuring mid-frame).
        const previousSuppressed = sgRoot.paintSuppressed;
        // A scoped measurement runs at origin [0,0] with no ancestor scale, even when it starts from
        // inside a scaled subtree's paint.
        const previousSceneMap = sgRoot.sceneMap;
        sgRoot.renderPass = "layout";
        sgRoot.paintSuppressed = false;
        sgRoot.sceneMap = IDENTITY_SCENE_MAP;
        try {
            this.renderNode(interpreter, origin, angle, opacity);
        } finally {
            sgRoot.renderPass = previousPass;
            sgRoot.paintSuppressed = previousSuppressed;
            sgRoot.sceneMap = previousSceneMap;
        }
    }

    /**
     * Paint entry point: the per-frame render. Recomputes layout inline (as `renderNode` always
     * has), advances time-based state (spinner rotation, marquee scroll, cursor blink, seek
     * repeat), and draws through the required `IfDraw2D`.
     */
    paintNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D: IfDraw2D) {
        const previousPass = sgRoot.renderPass;
        const previousSceneMap = sgRoot.sceneMap;
        sgRoot.renderPass = "paint";
        sgRoot.sceneMap = IDENTITY_SCENE_MAP;
        try {
            this.renderNode(interpreter, origin, angle, opacity, draw2D);
        } finally {
            sgRoot.renderPass = previousPass;
            sgRoot.sceneMap = previousSceneMap;
        }
    }

    /**
     * Whether the current traversal may advance time-based state and emit render side effects.
     * True on paint passes and on direct `renderNode` calls with a draw target; false inside
     * `layoutNode` traversals. The `draw2D` check keeps direct `renderNode(..., draw2D)` calls
     * (external node registrations, tests) behaving as paint regardless of context.
     */
    protected isPaintPass(draw2D?: IfDraw2D): boolean {
        return draw2D !== undefined || sgRoot.renderPass === "paint";
    }

    /**
     * Whether this traversal is a LAYOUT pass, as opposed to a paint frame whose drawing was suppressed
     * because the subtree is fully transparent. Both look like `draw2D === undefined` from inside a node,
     * so ask this — never a bare `!draw2D` — before doing work that is legitimate ONLY on a layout pass.
     *
     * **NOT the negation of `isPaintPass`**, and the two must not be collapsed: that one is deliberately
     * true for a direct `renderNode(..., draw2D)` regardless of context, and stays true inside a
     * suppressed subtree. The two families of check, and which sites belong to each, are in
     * `.claude/docs/scenegraph-invariants.md`.
     */
    protected isLayoutPass(draw2D?: IfDraw2D): boolean {
        return draw2D === undefined && !sgRoot.paintSuppressed;
    }

    /**
     * Iterates through child nodes, invoking their render methods in order.
     * @param interpreter Active interpreter.
     * @param origin Parent-space translation.
     * @param angle Accumulated rotation.
     * @param opacity Accumulated opacity.
     * @param draw2D Drawing interface.
     */
    renderChildren(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        for (const node of this.children) {
            if (!(node instanceof Node)) {
                continue;
            }
            node.renderNode(interpreter, origin, angle, opacity, draw2D);
        }
        this.changed = false;
    }

    /**
     * Refreshes layout by rendering the whole tree from the root, guarding against re-entrant
     * renders. Mark this refresh as an active render: BrightScript that runs inside it (an item
     * component's init() or a field observer measuring a Label) must not start another full-tree
     * refresh, or the passes recurse until the JS stack overflows — the same guard RoSGScreen
     * applies around frame renders, extended to refreshes initiated by a bounding-rect query.
     * Nested queries return the rects this pass computes. Callers must first check `!sgRoot.rendering`.
     */
    private refreshLayoutFromRoot(interpreter: Interpreter) {
        const root = this.createPath()[0];
        sgRoot.rendering = true;
        try {
            // Prune settled subtrees (sound because layout passes are pure). Only this
            // full-tree refresh prunes — scoped subtree measurements never do.
            sgRoot.pruneLayout = !sgRoot.pruneDisabled;
            try {
                root.layoutNode(interpreter, [0, 0], 0, 1);
            } finally {
                sgRoot.pruneLayout = false;
            }
        } finally {
            sgRoot.rendering = false;
        }
    }

    /**
     * Whether a `subBoundingRect` query must refresh layout before reading the cached sub-part rect.
     * Overridden by ArrayGrid-derived nodes: after a focus/scroll change the newly focused item's
     * cached rect is stale (it still sits at its previous, pre-scroll position) until the next frame
     * re-lays-out the grid — but an app's `rowItemFocused` observer measures it synchronously before
     * that frame. Refreshing then makes the query report the settled focus-band position, matching a
     * real device (where the observer fires after the render thread laid out the new focus). Default
     * false so non-grid nodes keep returning their cached, at-most-one-frame-old sub-part rects.
     */
    protected needsSubBoundingRectRefresh(): boolean {
        return false;
    }

    /**
     * Forces a render pass and returns the requested bounding rectangle.
     * @param type Rectangle type: `local`, `toScene`, or any other value for parent space.
     * @param interpreter Interpreter used to render the root path.
     * @returns Bounding rectangle in the requested coordinate space.
     */
    getBoundingRect(type: string, interpreter?: Interpreter): Rect {
        // A bounding-rect query refreshes layout by rendering the tree, then returns a cached rect.
        // When called from BrightScript that runs *during* a render (an observer or a freshly created
        // item component's init() measuring a Label), a full refresh would re-enter rendering and
        // overflow the stack, so it is skipped while a render is in progress.
        if (interpreter && !sgRoot.rendering) {
            this.refreshLayoutFromRoot(interpreter);
        } else if (
            interpreter &&
            sgRoot.rendering &&
            !sgRoot.measuring &&
            (this.rectLocal.width <= 0 || this.rectLocal.height <= 0 || this.measureStale)
        ) {
            // Mid-render query on a node this pass hasn't laid out yet (its local rect is degenerate),
            // or one whose subtree was written since its last measurement (`measureStale`).
            // A full refresh is unavailable (it would re-enter the owning grid's item creation and
            // recurse), so render just this node's own subtree to populate its rects. Either dimension
            // zero signals "not measured" — a label first measured with empty text caches width 0 but
            // a non-zero line height, so requiring both zero would skip the refresh and return a stale
            // width. Measuring at origin [0,0] is fine: width/height are translation-invariant and the
            // true origin is recomputed when the pass reaches the node. `measuring` bounds nested queries.
            //
            // `measureStale` is what makes REPEATED mid-render queries correct. A degenerate-rect test
            // alone measures only the FIRST query of a render: once a rect is cached, every later query
            // in that same render returns it verbatim, even after the app changed something. Apps size a
            // background from a measured child in exactly that shape — set an icon, measure, set the
            // text, measure again — and the second measurement silently returned the pre-text size, so
            // the background fit the icon alone and the text overflowed it. The mark is set by
            // `makeDirty()` (every field write), so this re-measures only when something actually
            // changed; it is cleared below, so an unchanged repeat query still hits the cache.
            //
            // The subtree render's updateParentRects would union this child into its parent's cached
            // bounds, but the parent hasn't been laid out this pass — unioning one child pollutes it
            // with a partial rect (e.g. a button measured from its content group before its larger
            // background sibling renders), making a later query on the parent skip its own fallback and
            // return the too-small rect. Snapshot/restore the parent's rects so it stays degenerate and
            // re-measures its full subtree when queried.
            const parent = this.parent instanceof Node ? this.parent : undefined;
            const savedLocal = parent ? { ...parent.rectLocal } : undefined;
            const savedToParent = parent ? { ...parent.rectToParent } : undefined;
            const savedToScene = parent ? { ...parent.rectToScene } : undefined;
            sgRoot.measuring = true;
            // A scoped subtree measurement never prunes (it can run nested inside a pruned
            // full-tree refresh — e.g. item creation measuring a label): it measures at origin
            // [0,0], so cached last-layout contexts from tree positions do not apply.
            const wasPruning = sgRoot.pruneLayout;
            sgRoot.pruneLayout = false;
            try {
                this.layoutNode(interpreter, [0, 0], 0, 1);
            } finally {
                sgRoot.measuring = false;
                sgRoot.pruneLayout = wasPruning;
                if (parent && savedLocal && savedToParent && savedToScene) {
                    parent.rectLocal = savedLocal;
                    parent.rectToParent = savedToParent;
                    parent.rectToScene = savedToScene;
                }
                // The [0,0] measurement clobbered this subtree's rectToScene with origin-less
                // values; deep-mark it so the next pruned refresh re-descends and re-establishes
                // in-tree rects instead of skipping the settled subtree.
                this.markSubtreeStaleDeep();
                // ...but the SIZES this pass just computed are current (width/height are
                // translation-invariant), so clear the measurement mark that the deep mark above
                // re-set. Without this, the flag the fallback keys on is left set by the very pass
                // meant to satisfy it, and every repeat query re-renders the subtree.
                this.clearSubtreeMeasureStale();
            }
        }
        switch (type) {
            case "local":
                return this.rectLocal;
            case "toScene":
                return this.rectToScene;
            default:
                return this.rectToParent;
        }
    }

    /**
     * Returns the bounding rectangle of an identified sub part (ifSGNodeBoundingRect's
     * subBoundingRect/localSubBoundingRect/sceneSubBoundingRect). Sub parts (`itemX`, `itemX_Y`,
     * `focusItem`, `focusIndicator`) only exist on ArrayGrid-derived nodes, which override
     * `resolveSubpart`. A missing sub part is answered by `missingSubpartRect`.
     *
     * DEVICE-MEASURED (OS 16.0, `test/simulator/probes/subrect-space-probe`), for every grid type:
     *  - `toScene`: the sub part in scene coordinates.
     *  - `toParent`: the sub part in THIS node's coordinate system, measured from its translation
     *    origin (item 1 of a grid with 20px spacing is `{120,0}` wherever the grid sits), in unscaled
     *    units. Despite the spec's wording it is not the grid's parent space.
     *  - `local`: the sub part in its own coordinate system, `{0,0,w,h}`.
     * `ancestor` is internal: the sub part in this node's parent space, which `ancestorSubBoundingRect`
     * walks up from.
     * @param type Rectangle type: `local`, `toScene`, `ancestor`, or any other value for `toParent`.
     * @param itemNumber Sub part identifier (e.g. "item3", "item4_11", "focusItem").
     * @param interpreter Interpreter used to refresh layout before measuring.
     * @returns Bounding rectangle of the sub part in the requested coordinate space.
     */
    getSubBoundingRect(type: string, itemNumber: string, interpreter?: Interpreter): Rect {
        // A pending focus/scroll change leaves the cached item rects at their pre-scroll positions, so
        // refresh layout first (only when needed and never inside a render), the way getBoundingRect does.
        if (interpreter && !sgRoot.rendering && this.needsSubBoundingRectRefresh()) {
            this.refreshLayoutFromRoot(interpreter);
        }
        const rect = this.resolveSubpart(itemNumber)?.rectToScene;
        if (!rect) {
            return this.missingSubpartRect(type, interpreter);
        }
        // Sub part rects are the components' cached scene rects from the last frame: re-rendering the
        // scene per query would be too slow and could catch a transient mid-layout size.
        if (type === "toScene") {
            return { ...rect };
        }
        const ancestor = type === "ancestor";
        const [kx, ky] = this.sceneUnitsTo(!ancestor);
        const size = { width: rect.width * Math.abs(kx), height: rect.height * Math.abs(ky) };
        if (type === "local") {
            return { x: 0, y: 0, ...size };
        }
        // `rectLocal`/`rectToParent` and `rectToScene` carry this node's own outset identically, so it
        // cancels out of the offset below.
        const base = ancestor ? this.rectToParent : this.rectLocal;
        return {
            x: base.x + (rect.x - this.rectToScene.x) * kx,
            y: base.y + (rect.y - this.rectToScene.y) * ky,
            ...size,
        };
    }

    /**
     * How many units of this node's local (or parent) space one scene unit spans. A plain node
     * applies no scale; a Group overrides it with its ancestors' and own scale.
     * @param _local Whether the target is this node's local space rather than its parent's.
     * @returns The x and y factors.
     */
    protected sceneUnitsTo(_local: boolean): [number, number] {
        return [1, 1];
    }

    /**
     * Resolves a bounding-rect sub part identifier to a node. Only ArrayGrid-derived nodes
     * have sub parts; the base implementation reports "no such sub part".
     * @param _itemNumber Sub part identifier.
     * @returns The sub part node, or undefined when the node has no such sub part.
     */
    protected resolveSubpart(_itemNumber: string): Node | undefined {
        return undefined;
    }

    /**
     * The rect reported for a sub part this node does not have. Per the spec, and DEVICE-MEASURED for a
     * non-grid node (`subrect-space-probe`), that is the node's own bounding rect.
     * @param type Rectangle type, as for `getSubBoundingRect`.
     * @param interpreter Interpreter used to refresh layout before measuring.
     * @returns The rect to report.
     */
    protected missingSubpartRect(type: string, interpreter?: Interpreter): Rect {
        return this.getBoundingRect(type === "ancestor" ? "toParent" : type, interpreter);
    }

    /**
     * Registers a field observer callback or message port.
     * @param interpreter Active interpreter owning the observer.
     * @param scope Observer lifetime scope.
     * @param fieldName Field to observe.
     * @param funcOrPort Callable name or message port.
     * @param infoFields Optional list of info fields written into the event AA.
     * @returns BrightScript boolean indicating registration success.
     */
    addObserver(
        interpreter: Interpreter,
        scope: ObserverScope,
        fieldName: BrsString,
        funcOrPort: BrsString | RoMessagePort,
        infoFields?: BrsType
    ) {
        let result = BrsBoolean.False;
        const name = fieldName.getValue();
        const field = this.resolveField(name.toLowerCase());
        if (field instanceof Field) {
            const host = interpreter.environment.hostNode;
            const alias = this.aliases.get(name.toLowerCase());
            const obsFieldName = new BrsString(alias?.aliasName ?? field.getName());
            const infoArray = infoFields instanceof RoArray ? infoFields : undefined;
            let observer: Callable | RoMessagePort | BrsInvalid = BrsInvalid.Instance;
            if (isBrsString(funcOrPort)) {
                if (!(host instanceof Node)) {
                    const location = interpreter.formatLocation();
                    const target = `"${this.nodeSubtype}.${name}"`;
                    BrsDevice.stderr.write(
                        `warning,BRIGHTSCRIPT: ERROR: roSGNode.ObserveField: ${target} no active host node: ${location}`
                    );
                    return result;
                }
                observer = interpreter.getCallableFunction(funcOrPort.getValue());
            } else if (funcOrPort instanceof RoMessagePort) {
                if (isTaskLike(host)) {
                    funcOrPort.registerCallback(host.nodeSubtype, host.getNewEvents.bind(host));
                }
                observer = funcOrPort;
            }
            if (!(observer instanceof BrsInvalid)) {
                field.addObserver(scope, interpreter, observer, this, obsFieldName, infoArray);
                result = BrsBoolean.True;
            }
        }
        return result;
    }

    /**
     * Removes observers from a field, scoped to the provided node when applicable.
     * @param fieldName Field whose observers should be removed.
     * @param node Optional node used for scoped observer cleanup.
     */
    protected removeObserver(fieldName: string, node?: Node) {
        const field = this.fields.get(fieldName.toLowerCase());
        if (field instanceof Field) {
            if (node instanceof RoSGNode) {
                field.removeScopedObservers(node);
            } else {
                field.removeUnscopedObservers();
            }
        }
    }

    /**
     * Sets or removes focus for this node, updating ancestry chains to mirror Roku behavior.
     * @param interpreter Interpreter performing the focus mutation.
     * @param focusOn When true focus is obtained, otherwise removed.
     * @returns Whether the node is focusable.
     */
    setNodeFocus(focusOn: boolean): boolean {
        if (focusOn) {
            if (!this.triedInitFocus) {
                // Only try initial focus once
                this.triedInitFocus = true;
                if (this.componentDef?.initialFocus) {
                    const childToFocus = this.findNodeById(this, this.componentDef.initialFocus);
                    if (childToFocus instanceof Node) {
                        childToFocus.setNodeFocus(true);
                        return this.isFocusable();
                    }
                }
            }
            if (!this.isFocusable() && this.isChildrenFocused()) {
                return false;
            }

            const path = this.createPath();
            const staged: StagedFocus[] = [];
            if (Node.focusRound) {
                this.applyNestedFocus(path, staged);
            } else if (this.holdsLiveFocus(path)) {
                Node.restageChain(sgRoot.focused as Node, staged);
            } else {
                this.applyFocus(path, staged);
            }
            Node.notifyStagedFocus(staged);
        } else if (sgRoot.focused === this) {
            // If we're unsetting focus on ourself, we need to unset it on all ancestors as well.
            const currFocusedNode = sgRoot.focused;
            sgRoot.setFocused();
            // Get the focus chain, with root-most ancestor first.
            let currFocusChain = this.createPath(currFocusedNode as Node);
            const staged: StagedFocus[] = [];
            for (const node of currFocusChain) {
                node.stageFocusedChild(BrsInvalid.Instance, staged);
            }
            Node.notifyStagedFocus(staged);
        } else {
            // If the node doesn't have focus already, and it's not gaining focus,
            // we don't need to notify any ancestors. Its own link to itself goes, so hasFocus() turns false.
            if (sgRoot.chainOwner === this) {
                sgRoot.setChainOwner();
            } else if (sgRoot.chainExtension === this) {
                sgRoot.setChainExtension();
            }
            const staged: StagedFocus[] = [];
            this.stageFocusedChild(BrsInvalid.Instance, staged);
            Node.notifyStagedFocus(staged);
        }
        // `setFocus(true)` returns the node's `focusable` value, wherever an observer moved the focus
        // (DEVICE-MEASURED, setfocus-return-probe). Overrides that need the landing check `sgRoot.focused`.
        return this.isFocusable();
    }

    /**
     * A top-level `setFocus(true)` (DEVICE-MEASURED, focus-probe, focus-probe2, focus-flag-probe): unsets the
     * chain owner's path below the common ancestor, clearing only the links that still point along it (a
     * stale link elsewhere stays, and so does its node's hasFocus()), then writes this node's whole path
     * and becomes the chain owner. The live focus moves up front, so observers already read the new state.
     * @param path This node's path, root first.
     * @param staged Accumulator for the staged writes.
     * @param selfLink Whether to write this node's link to itself; a PanelSet move that already wrote it
     *   (`completePanelFocus`) leaves it, so the node isn't notified a second time.
     */
    private applyFocus(path: Node[], staged: StagedFocus[], selfLink: boolean = true) {
        const previous = sgRoot.chainExtension ?? sgRoot.chainOwner ?? sgRoot.focused;
        sgRoot.setFocused(this);
        sgRoot.setChainOwner(this);
        Node.unsetPathBelow(previous, path, staged);
        for (let i = 0; i < path.length - 1; i++) {
            path[i].stageFocusedChild(path[i + 1], staged);
        }
        if (selfLink) {
            this.stageFocusedChild(this, staged);
        }
    }

    /**
     * A `setFocus(true)` raised during a focus notification (DEVICE-MEASURED, same probes). It writes this
     * node's path only below its common ancestor with the last call's target (`lastFocusTarget`): a node
     * re-grabbing the focus it is losing writes just its own link, which leaves the chain where the
     * transaction put it, while a forward to a sibling or to an overlay beside the container writes up to
     * the Scene. Replacing the Scene's link also unsets the chain owner's path and takes it over. The
     * live focus follows only when the chain from the root now leads to this node.
     * @param path This node's path, root first.
     * @param staged Accumulator for the staged writes.
     */
    private applyNestedFocus(path: Node[], staged: StagedFocus[]) {
        const root = path[0];
        const wasFocused = this.getValue("focusedchild") === this;
        let start = 0;
        const last = sgRoot.lastFocusTarget;
        if (last instanceof Node) {
            const lastPath = last.createPath();
            if (lastPath[0] === root) {
                start = Node.commonLength(path, lastPath) - 1;
            }
        }
        // Replacing the root's link (the Scene's) takes over the chain, but only of this tree: a detached
        // subtree focusing itself leaves the scene's chain alone. So does redirecting, lower down, the link
        // the chain owner hangs below: a panel forwarding to a grid in a sibling panel moves the PanelSet's
        // link off it, and leaving it the owner would have the next setFocus unset its stale self-link and
        // notify it again, long after it handed the focus on.
        const owner = sgRoot.chainOwner;
        const ownerPath = owner instanceof Node ? owner.createPath() : undefined;
        const ownerTree = ownerPath ? ownerPath[0] : root;
        const anchor = path[start];
        const next = path[start + 1];
        const anchorIndex = ownerPath ? ownerPath.indexOf(anchor) : -1;
        const redirectsOwner =
            ownerPath !== undefined &&
            anchorIndex >= 0 &&
            anchorIndex < ownerPath.length - 1 &&
            ownerPath[anchorIndex + 1] !== next;
        if (
            next !== undefined &&
            ownerTree === root &&
            anchor.getValue("focusedchild") !== next &&
            (start === 0 || redirectsOwner)
        ) {
            // Through a node the owner forwarded to, like a top-level call (`applyFocus`).
            Node.unsetPathBelow(sgRoot.chainExtension ?? owner, path, staged);
            sgRoot.setChainOwner(this);
        }
        for (let i = start; i < path.length - 1; i++) {
            path[i].stageFocusedChild(path[i + 1], staged);
        }
        this.stageFocusedChild(this, staged);
        if (Node.chainLeaf(root) === this) {
            sgRoot.setFocused(this);
            // A forward that newly focuses a node below the chain owner extends the owner's chain: the next
            // transaction unsets through it (nested-forward-focus-probe). Re-writing links that were
            // already there extends nothing (focus-flag-probe D).
            const owner = sgRoot.chainOwner;
            if (!wasFocused && owner instanceof Node && owner !== this && path.includes(owner)) {
                sgRoot.setChainExtension(this);
            }
        }
    }

    /**
     * Whether this node sits on the live chain strictly between the chain owner and the focused node, which
     * a forward extended below the owner: the chain owner is a proper ancestor, the focus a proper descendant.
     * @param path This node's path, root first.
     */
    private holdsLiveFocus(path: Node[]): boolean {
        const focused = sgRoot.focused;
        const owner = sgRoot.chainOwner;
        return (
            focused instanceof Node &&
            focused !== this &&
            owner instanceof Node &&
            owner !== this &&
            path.includes(owner) &&
            Node.chainLeaf(path[0]) === focused &&
            focused.createPath().includes(this)
        );
    }

    /**
     * First phase of a PanelSet key move onto a plain panel (DEVICE-MEASURED, panelset-bounce-focus-probe):
     * the firmware writes only the panel's self-link and notifies it, while the rest of the chain still
     * leads to the panel being left. A `setFocus` the panel's observers make runs as a nested call, so a
     * panel that bounces the focus back to the menu (nothing to focus yet) lands it on the intact old chain.
     * @returns False when the move must take the ordinary path: the panel has an `initialFocus` still to
     *   apply, or a focus round is already dispatching (an observer set `goBack`), where this notification
     *   would only be queued and the second phase would run before the panel's observers.
     */
    announcePanelFocus(): boolean {
        if (Node.focusRound || (!this.triedInitFocus && this.componentDef?.initialFocus)) {
            return false;
        }
        const staged: StagedFocus[] = [];
        this.stageFocusedChild(this, staged);
        // The panel already reports isInFocusChain() while it is notified (DEVICE-MEASURED, the probe's
        // chainGate case), though the live focus is still on the panel being left.
        sgRoot.setPendingPanelFocus(this);
        try {
            Node.notifyStagedFocus(staged);
        } finally {
            sgRoot.setPendingPanelFocus();
        }
        return true;
    }

    /**
     * Second phase of a PanelSet key move, run only when the panel still links to itself after its
     * observers ran: unsets the old chain and links the path down to the panel, which takes the focus. Its
     * self-link is already in place, so its own observers aren't notified a second time.
     */
    completePanelFocus() {
        const staged: StagedFocus[] = [];
        this.applyFocus(this.createPath(), staged, false);
        Node.notifyStagedFocus(staged);
    }

    /**
     * A top-level `setFocus(true)` on a node between the chain owner and the focus keeps the chain
     * (DEVICE-MEASURED, nested-forward-focus-probe): every link stays, and the chain is notified again from
     * the focused node up to the root, so a container's observer sees it doesn't hold the focus itself.
     * Focusing the chain owner itself rewrites the chain as usual (container-redirect scenario 2).
     * @param focused The focused node.
     * @param staged Accumulator for the staged writes.
     */
    private static restageChain(focused: Node, staged: StagedFocus[]) {
        const chain = focused.createPath();
        for (let i = chain.length - 1; i >= 0; i--) {
            chain[i].stageFocusedChild(chain[i].getValue("focusedchild"), staged);
        }
    }

    /** How many leading nodes two paths (root first) share. */
    private static commonLength(a: Node[], b: Node[]): number {
        let common = 0;
        while (common < a.length && common < b.length && a[common] === b[common]) {
            common++;
        }
        return common;
    }

    /**
     * Stages the unset of `previous`'s path below its common ancestor with `path`: each link that still
     * points at the next node of that path (and `previous`'s link to itself) is cleared. Nothing to unset
     * when there is no previous node, or it is the node being focused.
     * @param previous The node whose path is unset.
     * @param path The path being focused, root first, ending at the node taking the focus.
     * @param staged Accumulator for the staged writes.
     */
    private static unsetPathBelow(previous: RoSGNode | undefined, path: Node[], staged: StagedFocus[]) {
        if (!(previous instanceof Node) || previous === path.at(-1)) {
            return;
        }
        const old = previous.createPath();
        for (let i = Node.commonLength(path, old); i < old.length; i++) {
            const node = old[i];
            const next = old[i + 1] ?? node;
            if (node.getValue("focusedchild") === next) {
                node.stageFocusedChild(BrsInvalid.Instance, staged);
            }
        }
    }

    /**
     * Follows `focusedChild` links down from `root` to the node that links to itself.
     * @param root Node to start from.
     * @returns That node, or undefined when the links break off first.
     */
    private static chainLeaf(root: Node): Node | undefined {
        let node = root;
        for (let depth = 0; depth < 1000; depth++) {
            const next = node.getValue("focusedchild");
            if (next === node) {
                return node;
            }
            if (!(next instanceof Node)) {
                return undefined;
            }
            node = next;
        }
        return undefined;
    }

    /**
     * Writes this node's `focusedChild` WITHOUT notifying, recording the field in `staged` so the
     * caller can dispatch it once the whole focus transaction is committed.
     *
     * The write goes through the regular (virtual) `setValue`, so subclass overrides still run —
     * `Group` marks itself dirty so focus visuals repaint, `ScrollableText` tracks its focused
     * state. Only the notification is held back, via `focusStagingSink`.
     * @param value The new focusedChild value.
     * @param staged Accumulator the caller later hands to `notifyStagedFocus`.
     */
    private stageFocusedChild(value: BrsType, staged: StagedFocus[]) {
        const previousSink = Node.focusStagingSink;
        Node.focusStagingSink = staged;
        try {
            this.setValue("focusedchild", value, false);
        } finally {
            Node.focusStagingSink = previousSink;
        }
    }

    /**
     * Dispatches the staged `focusedChild` notifications for a committed focus transaction, in
     * chain order (the subtree losing focus first, then the one gaining it). A transaction raised from
     * one of them appends its own notifications to this round, each field once per round, and returns
     * before they dispatch (DEVICE-MEASURED, focus-flag-probe A1: the forwarded node's observer runs after
     * the forward's `setFocus` call returned).
     * @param staged Fields staged by `stageFocusedChild`.
     */
    private static notifyStagedFocus(staged: StagedFocus[]) {
        const round = Node.focusRound;
        if (round) {
            for (const field of staged) {
                if (!round.fields.has(field)) {
                    round.fields.add(field);
                    round.queue.push(field);
                }
            }
            return;
        }
        const queue = [...staged];
        Node.focusRound = { queue, fields: new Set(queue) };
        // Marks these as an engine-initiated focus emission, so notifications raised during a
        // component's init() defer until init returns (see Field.enterInit).
        Field.enterFocusEmission();
        try {
            // The array iterator also visits the entries nested transactions append while this runs.
            for (const field of queue) {
                field.notifyObservers();
            }
        } finally {
            Field.exitFocusEmission();
            Node.focusRound = undefined;
        }
    }

    /** Resets focus-dispatch state between app runs so nothing leaks across setups. */
    static resetFocusDispatch() {
        Node.focusRound = undefined;
        sgRoot.setChainOwner();
        sgRoot.setLastFocusTarget();
        sgRoot.setPendingPanelFocus();
    }

    /**
     * Searches the subtree rooted at the provided node for a matching `id`.
     *
     * Per Roku's ifSGNodeDict spec, findNode is a BREADTH-FIRST search: every node at one depth
     * is tested before any deeper node. Matching a device, it also searches in two passes: the
     * search scope's own nodes come first, at any depth, and only then the internal (XML
     * `<children>`) nodes of the other custom components inside it. A shallow internal node of a
     * sibling component therefore never shadows a deeper node of the scope's own, while an id that
     * exists only inside a component's internals is still found.
     * @param node Root to inspect.
     * @param id Identifier to seek (case-insensitive).
     * @param ignoreRoot Whether to ignore the root node in the search.
     * @param visited Set of previously visited nodes to prevent infinite recursion.
     * @returns The matching node or BrsInvalid when not found.
     */
    findNodeById(
        node: Node,
        id: string,
        ignoreRoot?: boolean,
        visited: WeakSet<Node> = new WeakSet()
    ): Node | BrsInvalid {
        const target = id.toLowerCase();
        // The scope is the component the root belongs to: itself when it is a custom component,
        // otherwise the component whose XML created it (none for a node built at runtime).
        const scope = node.componentDef ? node : node.componentOwner;
        const queue: Node[] = [];
        // Subtrees created by another component's XML, searched in the second pass.
        const deferred: Node[] = [];
        if (ignoreRoot) {
            visited.add(node);
            Node.enqueueChildren(node, scope, queue, deferred);
        } else {
            queue.push(node);
        }
        return (
            Node.scanForId(queue, target, scope, visited, deferred) ??
            Node.scanForId(deferred, target, scope, visited) ??
            BrsInvalid.Instance
        );
    }

    /**
     * Breadth-first scan of `queue` (extended in place) for a node whose id matches `target`.
     * Children another component's XML created go to `deferred` when given, or are scanned too.
     */
    private static scanForId(
        queue: Node[],
        target: string,
        scope: Node | undefined,
        visited: WeakSet<Node>,
        deferred?: Node[]
    ): Node | undefined {
        let head = 0;
        while (head < queue.length) {
            const current = queue[head];
            head++;
            if (visited.has(current)) {
                continue;
            }
            visited.add(current);
            const myId = current.getValue("id");
            if (myId?.toString().toLowerCase() === target) {
                return current;
            }
            Node.enqueueChildren(current, scope, queue, deferred);
        }
        return undefined;
    }

    /**
     * Queues a node's children for `findNodeById`, diverting those another component's XML created
     * into `deferred` (when given) instead of `queue`.
     */
    private static enqueueChildren(parent: Node, scope: Node | undefined, queue: Node[], deferred?: Node[]) {
        for (const child of parent.children) {
            if (!(child instanceof Node)) {
                continue;
            }
            const owner = child.componentOwner;
            if (deferred && owner !== undefined && owner !== scope) {
                deferred.push(child);
            } else {
                queue.push(child);
            }
        }
    }

    /**
     * Searches the subtree rooted at the provided node for a matching address.
     * @param root Root to inspect.
     * @param address Address to seek.
     * @param searchFields Whether to also search fields for node references.
     * @param visited Set of previously visited nodes to prevent infinite recursion.
     * @returns The matching node or undefined when not found.
     */
    findNodeByAddress(
        root: Node | undefined,
        address: string,
        searchFields: boolean = false,
        visited: WeakSet<Node> = new WeakSet()
    ): Node | undefined {
        if (!root || visited.has(root)) {
            return undefined;
        }
        visited.add(root);
        if (root.address === address) {
            return root;
        }

        // Helper to search through a collection of potential nodes
        const searchCollection = (items: Iterable<BrsType>): Node | undefined => {
            for (const item of items) {
                if (item instanceof Node) {
                    const match = this.findNodeByAddress(item, address, searchFields, visited);
                    if (match) return match;
                }
            }
            return undefined;
        };

        // Search fields if requested
        if (searchFields) {
            for (const [_, field] of root.fields) {
                const value = field.getValue();
                if (value instanceof Node) {
                    const match = this.findNodeByAddress(value, address, searchFields, visited);
                    if (match) return match;
                } else if (value instanceof RoAssociativeArray) {
                    const match = searchCollection(value.elements.values());
                    if (match) return match;
                } else if (value instanceof RoArray) {
                    const match = searchCollection(value.getElements());
                    if (match) return match;
                }
            }
        }

        // Search children
        const match = searchCollection(root.getNodeChildren());
        if (match) return match;

        return undefined;
    }

    /**
     * Resolves a bitmap referenced by one of this node's fields.
     * @param fieldName Field that stores a URI.
     * @returns Bitmap texture or undefined.
     */
    getBitmap(fieldName: string) {
        const uri = this.getValueJS(fieldName) as string;
        return this.loadBitmap(uri);
    }

    /**
     * Loads a bitmap for the provided URI, applying Scene `subSearch/subReplace` when configured.
     * @param uri Image URI.
     * @returns Loaded texture or undefined when the URI is blank.
     */
    protected loadBitmap(uri: string) {
        if (!uri?.trim()) {
            return undefined;
        }
        if (sgRoot.autoSub.search) {
            // Replace the configured token with the resolution-specific string. An empty replacement
            // is valid (it removes the token), so only the search string needs to be configured.
            const escapedSearch = sgRoot.autoSub.search.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
            const searchPattern = new RegExp(escapedSearch, "gi");
            uri = uri.replaceAll(searchPattern, () => sgRoot.autoSub.replace);
        }
        return getTextureManager().loadTexture(uri, this.httpAgent.customHeaders);
    }

    /**
     * Calculates the max width/height of bitmaps referenced by the supplied field names.
     * @param fields List of field names that store URIs.
     * @returns Tuple `[width, height]` of the largest bitmap.
     */
    getIconSize(fields: string[]) {
        let width = 0;
        let height = 0;
        for (const uri of fields) {
            const bmp = this.getBitmap(uri);
            if (bmp) {
                width = Math.max(width, bmp.width);
                height = Math.max(height, bmp.height);
            }
        }
        return [width, height];
    }

    /**
     * Copies a field value from this node onto a child field.
     * @param node Child node receiving the value.
     * @param fieldName Destination field.
     * @param thisField Optional source field override.
     * @returns The copied value.
     */
    protected copyField(node: Node, fieldName: string, thisField?: string) {
        const value = this.getValue(thisField ?? fieldName);
        node.setValue(fieldName, value);
        return value;
    }

    /**
     * Shares a field reference from another node, creating a live link.
     * @param node Node that owns the source field.
     * @param fieldName Source field on the provided node.
     * @param thisField Optional destination field name.
     * @returns Linked field metadata or undefined.
     */
    protected linkField(node: Node, fieldName: string, thisField?: string) {
        // resolveField materializes a hidden default on the source node so it can be linked, matching
        // the pre-lazy behavior where every default field was already a live Field.
        const field = node.resolveField(fieldName.toLowerCase());
        if (field) {
            this.fields.set((thisField ?? fieldName).toLowerCase(), field);
        }
        return field;
    }

    /**
     * Attempts to remove a non-system field from this node.
     * @param fieldName Field name to remove.
     * @returns True when the field or alias was removed.
     */
    protected removeFieldEntry(fieldName: string): boolean {
        const fieldKey = fieldName.toLowerCase();
        const field = this.fields.get(fieldKey);
        if (!field || (field.isSystem() && !this.aliases.has(fieldKey))) {
            return false;
        }
        field.clearObservers();
        const removedField = this.fields.delete(fieldKey);
        const removedAlias = this.aliases.delete(fieldKey);
        const removed = removedField || removedAlias;
        if (removed) {
            this.makeDirty();
        }
        return removed;
    }

    /**
     * Creates child nodes from an array description.
     * @param interpreter Interpreter for logging.
     * @param node Parent node receiving new children.
     * @param childrenArray Array describing children.
     * @param createFields Whether fields should be created when missing.
     * @param subtype Default subtype fallback.
     */
    private updateChildrenFromArray(
        interpreter: Interpreter,
        node: Node,
        childrenArray: RoArray,
        createFields: boolean,
        subtype: string
    ) {
        // Iterate over the array and create children nodes
        const elements = childrenArray.getElements();
        for (const element of elements) {
            if (element instanceof RoAssociativeArray) {
                // Create a new child node based on the subtype
                const childSubtype = jsValueOf(element.get(new BrsString("subtype"))) ?? subtype;
                const childNode = createNode(childSubtype, interpreter);
                if (childNode instanceof RoSGNode) {
                    this.populateNodeFromAA(interpreter, childNode, element, createFields, childSubtype);
                    node.appendChildToParent(childNode);
                }
            } else if (element instanceof RoSGNode) {
                node.appendChildToParent(element);
            } else {
                const location = interpreter.formatLocation();
                BrsDevice.stderr.write(
                    `warning,Warning calling update() on ${
                        this.nodeSubtype
                    } object expected to be convertible to Node is ${ValueKind.toString(element.kind)}: ${location}`
                );
            }
        }
    }

    /**
     * Populates a node from an associative array, recursively converting nested children arrays.
     * @param interpreter Interpreter for diagnostics.
     * @param node Node to mutate.
     * @param aa Associative array containing field data.
     * @param createFields Whether new fields may be created.
     * @param subtype Default subtype for nested children.
     */
    private populateNodeFromAA(
        interpreter: Interpreter,
        node: Node,
        aa: RoAssociativeArray,
        createFields: boolean,
        subtype: string
    ) {
        for (const [key, value] of aa.getValue()) {
            const fieldName = key.toLowerCase();
            // If this AA has a "children" field with an array, recursively create child nodes
            if (fieldName === "children" && value instanceof RoArray) {
                this.updateChildrenFromArray(interpreter, node, value, createFields, subtype);
                this.makeDirty();
            } else if (fieldName === "subtype") {
                // Skip the "subtype" field, already handled
                continue;
            } else if (
                value instanceof RoAssociativeArray &&
                this.isNodeCreationDirective(node, fieldName, value, createFields)
            ) {
                // A nested AA carrying a "subtype" key is a node-creation directive on real Roku
                // for ANY field - not just "children" array elements - as long as the target
                // field either doesn't exist yet (createFields) or is already typed as Node; a
                // field declared with another type keeps the AA as a literal value (see below).
                const childSubtype = jsValueOf(value.get(new BrsString("subtype"))) ?? subtype;
                const childNode = createNode(childSubtype, interpreter);
                if (childNode instanceof RoSGNode) {
                    this.populateNodeFromAA(interpreter, childNode, value, createFields, childSubtype);
                    node.setValue(key, childNode, false, FieldKind.Node);
                } else {
                    // Unknown/invalid subtype: the field is still typed as Node (matching Roku),
                    // but its value is Invalid since no node could be created.
                    node.setValue(key, BrsInvalid.Instance, false, FieldKind.Node);
                }
                this.makeDirty();
            }
            // Set all other fields, respecting the createFields parameter
            else if (node.hasNodeField(fieldName) || (createFields && !isInvalid(value))) {
                node.setValue(key, value, false);
                this.makeDirty();
            }
        }
    }

    /**
     * Checks whether a nested AA value (from an update()/populateNodeFromAA call) carrying a
     * `subtype` key should be treated as a node-creation directive for `fieldName` on `node`,
     * matching Roku's behavior: this applies to any field, but only when the target field either
     * doesn't exist yet (and will be freshly created) or already has FieldKind.Node - a field
     * declared with another type (e.g. assocarray) is left storing the AA as a literal value.
     * @param node Node the field belongs to.
     * @param fieldName Lowercased field name being set.
     * @param value Candidate AA value for the field.
     * @param createFields Whether new fields may be created by this update() call.
     * @returns True when `value` should be converted into a real node instead of stored as-is.
     */
    private isNodeCreationDirective(
        node: Node,
        fieldName: string,
        value: RoAssociativeArray,
        createFields: boolean
    ): boolean {
        if (isInvalid(value.get(new BrsString("subtype")))) {
            return false;
        }
        const field = node.resolveField(fieldName);
        return field ? field.getType() === FieldKind.Node : createFields;
    }

    /**
     * Message callback invoked by RoMessagePort observers. Overridden by Task nodes.
     * @param _interpreter Interpreter handling the callback.
     * @param _wait Requested wait time in milliseconds.
     * @returns Array of generated events (empty by default).
     */
    protected getNewEvents(_interpreter: Interpreter, _wait: number) {
        // To be overridden by the Task class
        return new Array<BrsEvent>();
    }

    /**
     * Removes a child node by reference, updating focus bookkeeping.
     * @param child Child to remove.
     * @returns True when removal occurred.
     */
    protected removeChildByReference(child: BrsType): boolean {
        if (child instanceof Node) {
            const spliceIndex = this.children.indexOf(child);
            if (spliceIndex >= 0) {
                child.removeParent();
                this.children.splice(spliceIndex, 1);
                this.recordChildChange("remove", spliceIndex);
                this.makeDirty();
                return true;
            }
        }
        return false;
    }

    /**
     * Detaches a child from its current parent before attaching it elsewhere.
     * Roku nodes have exactly one parent: appendChild/insertChild/replaceChild reparent implicitly.
     * @param child Child about to be attached to this node.
     */
    protected detachFromCurrentParent(child: Node) {
        const oldParent = child.getNodeParent();
        if (oldParent instanceof RoSGNode && oldParent !== this) {
            oldParent.removeChildByReference(child);
        }
    }

    /**
     * Removes a contiguous range of children starting at the provided index.
     * @param index Start index.
     * @param count Number of children to remove.
     * @returns True when at least one child was removed.
     */
    removeChildrenAtIndex(index: number, count: number): boolean {
        if (count > 0 && index >= 0 && index < this.children.length) {
            const removedChildren = this.children.splice(index, count);
            for (const node of removedChildren.filter((n): n is Node => n instanceof Node)) {
                node.removeParent();
            }
            if (removedChildren.length > 0) {
                this.recordChildChange("remove", index, index + removedChildren.length - 1);
            }
            this.makeDirty();
            return true;
        }
        return false;
    }

    /**
     * Appends a child node to this node's children collection. Appending a node that is
     * already a child MOVES it to the end (matching a real device): apps reorder a list by
     * re-appending an existing child — e.g. "move this menu entry after the one just added".
     * @param child Child to append.
     * @returns True when the child was appended.
     */
    appendChildToParent(child: BrsType): boolean {
        if (child instanceof Node) {
            const existingIndex = this.children.indexOf(child);
            if (existingIndex >= 0) {
                if (existingIndex === this.children.length - 1) {
                    return true;
                }
                this.children.splice(existingIndex, 1);
                this.recordChildChange("remove", existingIndex, existingIndex);
                this.children.push(child);
                this.makeDirty();
                this.recordChildChange("add", this.children.length - 1);
                return true;
            }
            this.detachFromCurrentParent(child);
            const insertionIndex = this.children.length;
            this.children.push(child);
            child.setNodeParent(this);
            this.makeDirty();
            this.recordChildChange("add", insertionIndex);
            return true;
        }
        return false;
    }

    /**
     * Replaces the child at the provided index with a new node.
     * @param newChild Node to insert.
     * @param index index indicating the desired position.
     * @returns True when replacement succeeded.
     */
    replaceChildAtIndex(newChild: Node, index: number): boolean {
        if (index < 0 || index >= this.children.length) {
            return false;
        }
        const existingIndex = this.children.indexOf(newChild);
        if (existingIndex >= 0) {
            this.children.splice(existingIndex, 1);
            if (existingIndex < index) {
                index -= 1;
            }
        }
        if (this.children.length === 0) {
            index = 0;
        } else if (index >= this.children.length) {
            index = this.children.length - 1;
        }
        const oldChild = this.children[index];
        if (oldChild instanceof Node) {
            oldChild.removeParent();
        }
        this.detachFromCurrentParent(newChild);
        newChild.setNodeParent(this);
        this.children.splice(index, 1, newChild);
        this.makeDirty();
        this.recordChildChange("set", index);
        return true;
    }

    /**
     * Inserts a child node at the specified index, shifting subsequent entries.
     * @param child Node to insert.
     * @param index Target index.
     * @returns True when insertion occurred.
     */
    insertChildAtIndex(child: BrsType, index: number): boolean {
        if (!(child instanceof Node)) {
            return false;
        }
        const childrenSize = this.children.length;
        if (index < 0) {
            index = childrenSize;
        } else if (index > childrenSize) {
            index = childrenSize;
        }
        const existingIndex = this.children.indexOf(child);
        if (existingIndex >= 0) {
            if (existingIndex === index) {
                return true;
            }
            this.children.splice(existingIndex, 1);
            this.recordChildChange("remove", existingIndex, existingIndex);
            if (existingIndex < index) {
                index -= 1;
            }
            this.children.splice(index, 0, child);
            this.makeDirty();
            this.recordChildChange("insert", index, index);
            return true;
        }
        this.detachFromCurrentParent(child);
        child.setNodeParent(this);
        this.children.splice(index, 0, child);
        this.makeDirty();
        this.recordChildChange("insert", index);
        return true;
    }

    /**
     * Writes a change record into the `change` field for observer delivery.
     * @param operation Operation identifier (add/remove/etc.).
     * @param index1 Primary index.
     * @param index2 Optional secondary index.
     * @returns void
     */
    protected recordChildChange(operation: ChangeOperation, index1: number, index2?: number) {
        const mapKey = "change";
        const changeField = this.fields.get(mapKey);
        if (!(changeField instanceof Field) || !changeField.isObserved()) {
            return;
        }

        const startIndex = Math.max(0, Math.trunc(index1));
        const endIndex = Math.max(0, Math.trunc(index2 ?? index1));

        changeField.setValue(
            toAssociativeArray({
                Index1: startIndex,
                Index2: endIndex,
                Operation: operation,
            }),
            true
        );
    }

    /**
     * Starting with a leaf node, traverses upward through the parents until it reaches
     * a node without a parent (root node).
     * @param start Leaf node used to build the path.
     * @param reverse When true (default) returns the path root-first.
     * @returns Parent chain starting with the root-most ancestor.
     */
    protected createPath(start?: Node, reverse: boolean = true): Node[] {
        let node: Node = start ?? this;
        let path: Node[] = [node];

        while (node.parent instanceof Node) {
            path.push(node.parent);
            node = node.parent;
        }

        return reverse ? path.reverse() : path;
    }

    /**
     * Finds the root ancestor either from the provided node or from this node.
     * @param start Optional starting node.
     * @returns Root-most ancestor.
     */
    protected findRootNode(start?: Node): Node {
        let root: Node = start ?? this;
        // Walk through getNodeParent() rather than the raw field so a node whose parent link is
        // resolved on demand participates — the global node reports the Scene as its parent.
        let parent = root.getNodeParent();
        while (parent instanceof Node) {
            root = parent;
            parent = root.getNodeParent();
        }
        return root;
    }

    /**
     * Invokes a public BrightScript function defined on this component's script.
     * @param interpreter Calling interpreter.
     * @param functionName Name of the function to call.
     * @param mOverride `m` to run the function with instead of `this.m`, or `undefined` to use
     *   `this.m` (see `.claude/docs/threading-and-rendezvous.md`).
     * @param functionArgs Arguments provided by BrightScript.
     * @returns Function return value or invalid when not callable.
     */
    protected callFunction(
        interpreter: Interpreter,
        functionName: BrsString,
        mOverride: RoAssociativeArray | undefined,
        ...functionArgs: BrsType[]
    ): BrsType {
        // We need to search the callee's environment for this function rather than the caller's.
        // Only allow public functions (defined in the interface) to be called.
        const name = functionName.getValue();
        if (this.componentDef && this.funcNames.has(name.toLowerCase())) {
            const m = mOverride ?? this.m;
            return interpreter.inSubEnv((subInterpreter) => {
                let functionToCall = subInterpreter.getCallableFunction(name);
                if (!(functionToCall instanceof Callable)) {
                    BrsDevice.stderr.write(`warning,Ignoring attempt to call non-implemented function ${name}`);
                    return BrsInvalid.Instance;
                }
                const originalLocation = interpreter.location;
                let addedToStack = false;
                subInterpreter.environment.setM(m);
                subInterpreter.environment.setRootM(m);
                subInterpreter.environment.hostNode = this;

                try {
                    // Determine whether the function should get arguments or not.
                    let satisfiedSignature = functionToCall.getFirstSatisfiedSignature(functionArgs);
                    const args = satisfiedSignature ? functionArgs : [];
                    satisfiedSignature ??= functionToCall.getFirstSatisfiedSignature([]);
                    if (satisfiedSignature) {
                        const funcLoc = functionToCall.getLocation() ?? originalLocation;
                        interpreter.addToStack({
                            functionName: name,
                            functionLocation: funcLoc,
                            callLocation: originalLocation,
                            signature: satisfiedSignature.signature,
                        });
                        addedToStack = true;
                        const boxedArgs = args.map((arg) => {
                            if (arg instanceof RoArray || arg instanceof RoAssociativeArray) {
                                arg.boxLiterals();
                            } else if (isBoxable(arg)) {
                                return arg.box();
                            }
                            return arg;
                        });
                        const returnValue = functionToCall.call(subInterpreter, ...boxedArgs);
                        interpreter.popFromStack();
                        interpreter.location = originalLocation;
                        return returnValue;
                    } else {
                        return interpreter.addError(
                            generateArgumentMismatchError(
                                functionToCall,
                                functionArgs,
                                interpreter.stackCopy.at(-1)?.functionLocation!
                            )
                        );
                    }
                } catch (reason) {
                    if (reason instanceof RuntimeError) {
                        interpreter.checkCrashDebug(reason);
                    }
                    if (!interpreter.inExitMode() && addedToStack) {
                        interpreter.popFromStack();
                        interpreter.location = originalLocation;
                    }
                    if (!(reason instanceof Stmt.ReturnValue)) {
                        // re-throw interpreter errors
                        throw reason;
                    }
                    return reason.value ?? BrsInvalid.Instance;
                }
            }, this.componentDef.environment);
        }

        BrsDevice.stderr.write(
            `warning,Warning calling function in ${this.nodeSubtype}: no function interface specified for ${name}`
        );
        return BrsInvalid.Instance;
    }

    /**
     * Records built-in subtype hierarchy information for use with `isSubtype` checks.
     *
     * Every built-in class calls this with its OWN canonical type as `nodeName` (e.g. RowList's
     * constructor always does `setExtendsType(SGNodeType.RowList, SGNodeType.ArrayGrid)`) - never
     * the `name` threaded through `super([], name)`, which may be a subclass's own default, or a
     * custom XML component's name when this class is constructed as that component's built-in
     * base. Two reasons:
     *
     * 1. `name` is the SAME string at every level of a single construction's constructor chain
     *    (base first, since each `super()` call runs before the rest of its own constructor body).
     *    A RowList's chain would call Group's `setExtendsType(name, Node)`, then ArrayGrid's
     *    `setExtendsType(name, Group)`, then RowList's own `setExtendsType(name, ArrayGrid)`, all
     *    under the SAME key - collapsing every built-in node straight to "Node" (only the first
     *    write survived) or, if made to overwrite instead, straight to its immediate built-in
     *    parent but skipping "ArrayGrid" as a queryable link entirely, since "arraygrid" itself was
     *    never a key unless something separately constructed a bare ArrayGrid. Keying by each
     *    class's own canonical type instead means every level writes its OWN entry
     *    (RowList->ArrayGrid, ArrayGrid->Group, Group->Node), so the chain is always walkable.
     * 2. A custom XML component's `extends` relationship is registered separately, by
     *    `updateTypeDefHierarchy()`, BEFORE the underlying built-in class is constructed (see
     *    `initializeNode`). If this method used the threaded `name` here too, the built-in
     *    constructor chain running afterward would silently overwrite that correct
     *    "myComponent -> RowList" entry with "myComponent -> ArrayGrid" (RowList's own, unrelated
     *    fact) - breaking `isSubtype("RowList")` for any component whose `extends` is a
     *    multi-level built-in type.
     * @param nodeName The class's own canonical node type (its `SGNodeType`), not `name`/`nodeSubtype`.
     * @param parentType Parent type it extends.
     */
    protected setExtendsType(nodeName: string, parentType: SGNodeType) {
        const typeKey = nodeName.toLowerCase();
        // Every class now writes its own key with a fixed, unchanging value (see above), so the
        // first write for a key is always correct - skip the redundant re-write on every later
        // instance of the same class.
        if (!subtypeHierarchy.has(typeKey) && typeKey !== parentType.toLowerCase()) {
            subtypeHierarchy.set(typeKey, parentType);
        }
    }

    /**
     * Registers built-in fields declared by the component definition.
     * @param fields Field definitions including defaults.
     */
    protected registerDefaultFields(fields: FieldModel[]) {
        // The class spec is keyed by the concrete class and shared across instances. This runs
        // more than once per node (base fields during the Node ctor, then the subclass fields),
        // all with the same `this.constructor`, so accumulate rather than rebuild.
        const nodeClass = this.constructor;
        let spec = Node.hiddenSpecCache.get(nodeClass);
        if (!spec) {
            spec = new Map();
            Node.hiddenSpecCache.set(nodeClass, spec);
        }
        for (const field of fields) {
            const fieldType = FieldKind.fromString(field.type);
            if (!fieldType) {
                continue;
            }
            const mapKey = field.name.toLowerCase();
            if (field.hidden) {
                // Defer materialization: keep only the model in the shared spec. resolveField()
                // creates the Field lazily on first access (matching Roku, where an untouched
                // metadata field is absent from getFields until read/written).
                if (!spec.has(mapKey)) {
                    spec.set(mapKey, field);
                }
            } else {
                const value = getBrsValueFromFieldType(field.type, field.value);
                this.fields.set(mapKey, new Field(field.name, value, fieldType, !!field.alwaysNotify, true, false));
            }
        }
        this.hiddenFieldSpec = spec;
    }

    /**
     * Resolves a field by (lowercase) name, lazily materializing a `hidden` default field from the
     * class spec on first access. Use this instead of `this.fields.get(...)` wherever a field is
     * looked up by name, so hidden default fields behave as if they were always present.
     * @param mapKey Lowercase field name.
     * @returns The field, or undefined when no such field/default exists.
     */
    resolveField(mapKey: string): Field | undefined {
        const existing = this.fields.get(mapKey);
        if (existing) {
            return existing;
        }
        const model = this.hiddenFieldSpec?.get(mapKey);
        if (!model) {
            return undefined;
        }
        const fieldType = FieldKind.fromString(model.type);
        if (!fieldType) {
            return undefined;
        }
        const value = getBrsValueFromFieldType(model.type, model.value);
        // Materialize with the model's real flags (system + hidden), reproducing exactly the eager
        // `Field` the constructor used to create. The field's own getValue/setValue/addObserver clear
        // `hidden` on first real access, just as before — so a type-check-only resolve (canAcceptValue)
        // leaves it hidden and it stays out of getFields until genuinely read or written.
        const field = new Field(model.name, value, fieldType, !!model.alwaysNotify, true, !!model.hidden);
        this.fields.set(mapKey, field);
        return field;
    }

    /**
     * Registers preset fields provided during instantiation.
     * TODO: filter out any non-allowed members. For example, if we instantiate a Node like this:
     *      <Node thisisnotanodefield="fakevalue" />
     * then Roku logs an error, because Node does not have a property called "thisisnotanodefield".
     * @param fields Associative-array style entries from XML.
     */
    protected registerInitializedFields(fields: AAMember[]) {
        for (const field of fields) {
            const fieldType = FieldKind.fromBrsType(field.value);
            if (fieldType) {
                const fieldName = field.name.value;
                this.fields.set(fieldName.toLowerCase(), new Field(fieldName, field.value, fieldType, false));
            }
        }
    }

    /**
     * Compares nodes by subtype and address for equality checks.
     * @param other Node to compare with.
     * @returns True when nodes are equivalent.
     */
    protected compareNodes(other: Node): boolean {
        return this.nodeSubtype === other.nodeSubtype && this.address === other.address;
    }

    /**
     * Marks this node as dirty and notifies the SceneGraph root.
     */
    protected makeDirty() {
        this.changed = true;
        this.markSubtreeStale();
        if (sgRoot.inTaskThread() && this.parent instanceof Node) {
            const root = this.findRootNode();
            root.changed = true;
        }
        sgRoot.makeDirty();
    }

    /**
     * Marks this node and every ancestor stale for the pruned layout refresh. Walks the FULL
     * parent chain (O(depth), trivial next to the cost of the setValue that got us here) rather
     * than early-exiting at the first stale ancestor: a node whose own pass never runs (a
     * hard-skipped invisible leaf, an off-screen grid item) keeps its stale mark while its
     * ancestors' marks are cleared by their passes, so "this node is stale" does not imply the
     * chain above it still is — an early exit would strand the write in a skipped subtree.
     */
    markSubtreeStale() {
        this.subtreeStale = true;
        this.measureStale = true;
        let ancestor = this.parent instanceof Node ? this.parent : undefined;
        while (ancestor) {
            ancestor.subtreeStale = true;
            ancestor.measureStale = true;
            ancestor = ancestor.parent instanceof Node ? ancestor.parent : undefined;
        }
    }

    /**
     * Marks this node, every descendant, AND the ancestor chain stale. Required after a scoped
     * measurement rendered this subtree at origin [0,0] (`measureUnsizedChildren`,
     * `getBoundingRect`'s mid-render fallback): that pass overwrites every descendant's
     * `rectToScene` with origin-less values, relying on "the true origin is recomputed when the
     * next pass reaches the node" — which a pruned refresh would skip. The deep mark forces the
     * next refresh to re-descend and re-establish in-tree rects; the up-mark makes sure the
     * refresh actually reaches this subtree.
     */
    markSubtreeStaleDeep() {
        this.markSubtreeStale();
        const stack: Node[] = [this];
        while (stack.length > 0) {
            const node = stack.pop()!;
            node.subtreeStale = true;
            for (const child of node.children) {
                if (child instanceof Node) {
                    stack.push(child);
                }
            }
        }
    }

    /**
     * Clears `measureStale` on this node and every descendant after a scoped measurement pass
     * computed their sizes. Only the sizes are guaranteed current — `subtreeStale` deliberately
     * stays set, because the pass ran at origin [0,0] and left the subtree's scene-space origins
     * wrong for anything but a full refresh. Ancestors are NOT cleared: they were not measured, so
     * a later query on one must still re-measure to pick this subtree's new size up.
     */
    private clearSubtreeMeasureStale() {
        const stack: Node[] = [this];
        while (stack.length > 0) {
            const node = stack.pop()!;
            node.measureStale = false;
            for (const child of node.children) {
                if (child instanceof Node) {
                    stack.push(child);
                }
            }
        }
    }

    /**
     * Marks this instance as an address-only stand-in for a node owned by another thread, so reads
     * of fields it has not mirrored yet rendezvous to the owner instead of answering `invalid`.
     * @param isProxy Whether the node was rebuilt from a bare reference.
     */
    public setRemoteProxy(isProxy: boolean) {
        this.remoteProxy = isProxy;
    }

    /**
     * Whether this instance is an address-only stand-in for a node owned by another thread.
     * @returns True when the node was rebuilt from a bare reference.
     */
    public isRemoteProxy(): boolean {
        return this.remoteProxy;
    }

    /**
     * Sets the owning thread identifier for this node.
     * @param threadId Thread identifier.
     */
    public setOwner(threadId: number) {
        if (this.owner === threadId) {
            return;
        }
        this.owner = threadId;
        // replace ownership on node fields
        for (const field of this.fields.values()) {
            if (field.getType() === FieldKind.Node) {
                const fieldValue = field.getValue();
                if (fieldValue instanceof Node) {
                    fieldValue.setOwner(threadId);
                }
            }
        }
        // replace ownership on children
        for (const child of this.children) {
            if (child instanceof Node) {
                child.setOwner(threadId);
            }
        }
    }

    /**
     * Gets the owning thread identifier for this node.
     * @returns Thread identifier.
     */
    public getOwner() {
        return this.owner;
    }

    /**
     * Whether a detached port observer still stands for a live port on this node's thread (only a
     * running Task holds one; see `Task.launchedPorts`).
     * @param _port The detached port registered as an observer.
     */
    holdsLaunchedPort(_port: RoMessagePort) {
        return false;
    }

    /** Sets the unique address for this node.
     * @param address Node address.
     */
    public setAddress(address: string) {
        this.address = address;
    }

    /**
     * Gets the unique address for this node.
     * @returns Node address.
     */
    public getAddress() {
        return this.address;
    }

    /**
     * Marks a field as fresh, allowing it to be synchronized without delay.
     * @param fieldName Field to mark as fresh.
     */
    public markFieldFresh(fieldName: string) {
        const mapKey = fieldName.toLowerCase();
        this.freshFields.set(mapKey, { remaining: FreshFieldBudget, timestamp: Date.now() });
    }

    /**
     * Checks if the node should perform a rendezvous through the task thread.
     * @returns True if the node is owned by another thread and we are in a task thread.
     */
    shouldRendezvous(): boolean {
        return sgRoot.inTaskThread() && this.owner !== sgRoot.threadId;
    }

    /**
     * Helper to perform a rendezvous field set via the current task.
     * @param fieldName Name of the field being set.
     * @param field Field object for the field being set.
     */
    protected rendezvousSet(fieldName: string, field: Field) {
        if (!this.changed) {
            return undefined;
        }
        const value = field.getValue(false);
        if (this.shouldRendezvous()) {
            const task = sgRoot.getCurrentThreadTask();
            task?.syncRemoteField(fieldName, value, this.syncType, this.address);
            this.changed = false;
        } else if (!sgRoot.inTaskThread()) {
            this.fanOutFieldToObservingTasks(fieldName);
        }
    }

    /**
     * Fans a field value out (from the render thread) to every Task thread observing it via a port.
     * Used both for the render thread's own field sets and to propagate a set the render applied on
     * behalf of a Task to the *other* observing tasks (cross-task propagation).
     * @param fieldName Field whose current value should be delivered.
     * @param excludeThreadIds Task thread ids to skip — the originating task, plus any thread the
     *   caller has already delivered to by another route (which would otherwise double-fire).
     */
    fanOutFieldToObservingTasks(fieldName: string, ...excludeThreadIds: number[]) {
        if (sgRoot.inTaskThread()) {
            return;
        }
        const field = this.fields.get(fieldName.toLowerCase());
        if (!field) {
            return;
        }
        const value = field.getValue(false);
        for (const task of sgRoot.threadTasks) {
            // Deliver only to the threads that actually registered a port observer. `isPortObserved`
            // cannot distinguish them (see `Field.remotePortObservers`) — using it here broadcast
            // every update to every active task, which swamped the single-slot fan-out buffers.
            if (
                task.active &&
                !excludeThreadIds.includes(task.threadId) &&
                (field.isPortObserved(task) || field.hasRemotePortObserver(task.threadId))
            ) {
                task.syncRemoteField(fieldName, value, this.syncType, this.address);
            }
        }
    }

    /**
     * Builds the payload for a rendezvous method call, serializing arguments for cross-thread
     * transfer and optionally re-owning any Node argument to render.
     * @param interpreter Current BrightScript interpreter.
     * @param task Task instance whose channel the call travels over (used to flag port-observed
     *   fields on any Node argument via `fromSGNode`'s host parameter).
     * @param callArgs Arguments to pass to the remote method.
     * @param reownToRender Whether a Node argument should be re-owned to render (see
     *   `.claude/docs/threading-and-rendezvous.md` for when this is/isn't correct).
     * @returns The serialized call payload.
     */
    private buildMethodCallPayload(
        interpreter: Interpreter,
        task: Task,
        callArgs: BrsType[] | undefined,
        reownToRender: boolean
    ): MethodCallPayload {
        let host = this.address;
        const hostNode = interpreter.environment.hostNode;
        if (hostNode instanceof Node) {
            host = hostNode.getAddress();
        }
        const location = interpreter.location;
        const args = callArgs?.map((arg: BrsType) => {
            if (arg instanceof Node) {
                if (reownToRender) {
                    arg.setOwner(0);
                }
                // Flag port-observed fields for the receiving task via fromSGNode's host param.
                return fromSGNode(arg, true, task);
            }
            return jsValueOf(arg);
        });
        return args ? { host, args, location } : { host, location };
    }

    /**
     * Helper to perform a rendezvous method call via the current task.
     * @param interpreter Current BrightScript interpreter.
     * @param method Name of the method to call.
     * @param args Arguments to pass to the remote method.
     * @param reownToRender Whether a Node argument should be re-owned to render (see
     *   `buildMethodCallPayload`). Defaults to `true`.
     * @returns Result of the remote method call, or undefined if not available.
     */
    protected rendezvousCall(
        interpreter: Interpreter,
        method: string,
        callArgs?: BrsType[],
        reownToRender: boolean = true
    ): BrsType | undefined {
        if (!this.shouldRendezvous()) {
            return undefined;
        }
        const task = sgRoot.getCurrentThreadTask();
        if (task?.active) {
            const payload = this.buildMethodCallPayload(interpreter, task, callArgs, reownToRender);
            return task.requestMethodCall(this.syncType, this.address, method, payload);
        }
        return undefined;
    }

    /**
     * Thread this node's callable interface functions actually run on, when that differs from
     * ordinary field-owner routing (`shouldRendezvous`'s `owner` check). `Task` overrides this
     * with its own `threadId`; this base case routes to whichever thread owns the node, if that
     * thread has an active, registered Task to dispatch through — see
     * `.claude/docs/threading-and-rendezvous.md` for why this isn't gated on the caller the way
     * `shouldRendezvous()` is.
     * @returns The thread id, or undefined when not applicable (routes through the owner-based path).
     */
    protected callFuncThread(): number | undefined {
        if (this.owner <= 0) {
            return undefined;
        }
        const task = sgRoot.getThreadTask(this.owner);
        return task?.active ? this.owner : undefined;
    }

    /**
     * Consumes (and clears) a one-shot override for the `m` the *next* `callFunction` dispatch on
     * this node should run with, if one is currently pending. Only `Task` overrides this — see
     * `.claude/docs/threading-and-rendezvous.md`.
     * @returns The `m` to use instead of `this.m` for the next dispatch, or undefined.
     */
    protected consumeCallFuncMOverride(): RoAssociativeArray | undefined {
        return undefined;
    }

    /**
     * `callFunc`-specific rendezvous entry point — see `.claude/docs/threading-and-rendezvous.md`.
     * @param interpreter Current BrightScript interpreter.
     * @param functionName Name of the function being called.
     * @param callArgs Arguments to pass to the remote function.
     * @returns Result of the remote call, or undefined when it should run locally.
     */
    protected rendezvousCallFunc(
        interpreter: Interpreter,
        functionName: BrsString,
        callArgs: BrsType[]
    ): BrsType | undefined {
        const targetThread = this.callFuncThread();
        if (targetThread === undefined) {
            return this.rendezvousCall(interpreter, "callFunc", [functionName, ...callArgs], false);
        }
        if (targetThread === sgRoot.threadId) {
            // Avoid a self-rendezvous loop when handleMethodCallRequest re-dispatches here.
            return undefined;
        }
        const task = sgRoot.getThreadTask(targetThread);
        if (!task?.active || task.inThread) {
            return undefined;
        }
        const payload = this.buildMethodCallPayload(interpreter, task, [functionName, ...callArgs], false);
        return task.requestTaskMethodCall(this.syncType, this.address, "callFunc", payload);
    }

    /**
     * Consumes a fresh field allowance when applicable.
     * @param fieldName Field to consume.
     * @returns True when the field is still fresh.
     */
    protected consumeFreshField(fieldName: string): boolean {
        const mapKey = fieldName.toLowerCase();
        const entry = this.freshFields.get(mapKey);
        if (!entry) {
            return false;
        }
        if (Date.now() - entry.timestamp > FreshFieldWindowMS) {
            this.freshFields.delete(mapKey);
            return false;
        }
        entry.remaining--;
        if (entry.remaining <= 0) {
            this.freshFields.delete(mapKey);
        }
        return true;
    }

    /**
     * Builds an associative array describing the node's threading context.
     * @returns Associative array describing thread state.
     */
    protected getThreadInfo() {
        const threadData: FlexObject = {
            currentThread: sgRoot.getCurrentThreadInfo(),
            node: {
                address: this.address,
                id: this.getId(),
                type: this.nodeSubtype,
                owningThread: sgRoot.getThreadInfo(this.owner),
                willRendezvousFromCurrentThread: this.owner === sgRoot.threadId ? "No" : "Yes",
            },
            renderThread: sgRoot.getRenderThreadInfo(),
        };
        return toAssociativeArray(threadData);
    }
}
