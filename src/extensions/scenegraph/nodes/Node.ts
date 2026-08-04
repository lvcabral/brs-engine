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
    RoInvalid,
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
import { convertHexColor } from "../SGUtil";

type ChangeOperation = "none" | "insert" | "add" | "remove" | "set" | "clear" | "move" | "setall" | "modify";

/** A `focusedChild` write held back until its focus transaction is fully committed. */
type StagedFocus = { node: Node; field: Field };

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
     * Stack of nodes whose `focusedChild` observers are currently dispatching, innermost last.
     * Read by `isFocusRequestDropped` to tell a focus-gain notification (whose observer may move
     * focus onward) from a focus-loss one (whose focus requests a Roku ignores).
     */
    private static readonly focusNotifyOwners: Node[] = [];
    /**
     * Set while a focus transaction stages its `focusedChild` writes: `setValue` applies the value
     * but routes the notification here instead of dispatching it — see `stageFocusedChild`.
     */
    private static focusStagingSink: StagedFocus[] | undefined;
    /** Field registry keyed by lowercase name. */
    protected readonly fields: Map<string, Field>;
    /** Alias definitions pointing to fields on child nodes. */
    protected readonly aliases: Map<string, FieldAlias>;
    /** Component definition metadata used for field and function resolution. */
    protected readonly componentDef?: ComponentDefinition;
    /** Set of function names defined on this component for quick lookup. */
    protected readonly funcNames: Set<string> = new Set();
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
            .sort()
            .map((field: Field) => field.getValue());
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
                    sink.push({ node: this, field });
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
        const clonedNode = createFlatNode(this.nodeType, this.nodeSubtype);
        if (!(clonedNode instanceof RoSGNode)) {
            return BrsInvalid.Instance;
        }
        visitedNodes.set(this, clonedNode);
        // Clone fields
        for (const [key, field] of this.fields) {
            if (this.aliases.has(key) && interpreter) {
                const parentType = subtypeHierarchy.get(this.nodeSubtype) ?? "Node";
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGNode.Clone: No such field ${parentType}::${key}: ${
                        interpreter?.formatLocation() ?? ""
                    }`
                );
                return BrsInvalid.Instance;
            }
            let fieldValue = field.getValue(false);
            if (fieldValue instanceof RoSGNode) {
                fieldValue = fieldValue.deepCopy();
            }
            const clonedField = new Field(
                field.getName(),
                fieldValue,
                field.getType(),
                field.isAlwaysNotify(),
                field.isSystem(),
                field.isHidden()
            );
            clonedNode.fields.set(key, clonedField);
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
     * Creates a deep copy of this node suitable for returning into BrightScript.
     * @param visitedNodes Graph cache preventing repeated copies of shared nodes.
     * @returns Deep copied node or invalid on failure.
     */
    deepCopy(visitedNodes?: WeakMap<Node, Node>): BrsType {
        visitedNodes ??= new WeakMap<Node, Node>();
        const copiedNode = createFlatNode(this.nodeType, this.nodeSubtype);
        if (!(copiedNode instanceof Node)) {
            return new RoInvalid();
        }
        copiedNode.address = this.address;
        visitedNodes.set(this, copiedNode);
        for (const [key, field] of this.fields) {
            let fieldObject = field;
            let fieldValue = field.getValue(false);
            if (fieldValue instanceof Node) {
                if (visitedNodes.has(fieldValue)) {
                    fieldValue = visitedNodes.get(fieldValue)!;
                } else {
                    fieldValue = fieldValue.deepCopy(visitedNodes);
                }
                fieldObject = new Field(
                    field.getName(),
                    fieldValue,
                    field.getType(),
                    field.isAlwaysNotify(),
                    field.isSystem(),
                    field.isHidden()
                );
            }
            copiedNode.fields.set(key, fieldObject);
        }
        for (const child of this.children) {
            let newChild: BrsType = BrsInvalid.Instance;
            if (child instanceof Node) {
                if (visitedNodes.has(child)) {
                    newChild = visitedNodes.get(child)!;
                } else {
                    newChild = child.deepCopy(visitedNodes);
                }
            }
            copiedNode.appendChildToParent(newChild);
        }
        return copiedNode;
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
            if (value instanceof RoArray || value instanceof RoAssociativeArray || value instanceof RoSGNode) {
                moved.push({ name: new BrsString(key), value: value.deepCopy() });
            } else if (isBoxable(value) && !(value instanceof Callable)) {
                moved.push({ name: new BrsString(key), value: value });
            } else if (isUnboxable(value) && !(value instanceof RoFunction)) {
                moved.push({ name: new BrsString(key), value: value.copy() });
            }
        }
        const refs = data.clearElements();
        field.setValue(new RoAssociativeArray(moved), true);
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
        Node.notifyStagedFocus(staged, true);
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
        sgRoot.renderPass = "layout";
        try {
            this.renderNode(interpreter, origin, angle, opacity);
        } finally {
            sgRoot.renderPass = previousPass;
        }
    }

    /**
     * Paint entry point: the per-frame render. Recomputes layout inline (as `renderNode` always
     * has), advances time-based state (spinner rotation, marquee scroll, cursor blink, seek
     * repeat), and draws through the required `IfDraw2D`.
     */
    paintNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D: IfDraw2D) {
        const previousPass = sgRoot.renderPass;
        sgRoot.renderPass = "paint";
        try {
            this.renderNode(interpreter, origin, angle, opacity, draw2D);
        } finally {
            sgRoot.renderPass = previousPass;
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
     * `resolveSubpart`. Per the Roku spec, when the sub part does not exist the node's own
     * bounding rectangle (in the requested coordinate space) is returned.
     * @param type Rectangle type: `local`, `toScene`, or any other value for parent space.
     * @param itemNumber Sub part identifier (e.g. "item3", "item4_11", "focusItem").
     * @param interpreter Interpreter used to refresh layout before measuring.
     * @returns Bounding rectangle of the sub part in the requested coordinate space.
     */
    getSubBoundingRect(type: string, itemNumber: string, interpreter?: Interpreter): Rect {
        // If a focus/scroll change is pending (e.g. a vertical row change just fired its
        // rowItemFocused observer before the next frame re-laid-out the grid), the cached item rects
        // are stale — the newly focused item still sits at its previous, pre-scroll position. Refresh
        // layout the same guarded way getBoundingRect does so subBoundingRect reports the settled
        // focus-band position, matching a real device where the observer fires post-layout. Only when
        // safe (not already inside a render) and only when actually needed (the dirty flag), so
        // steady-state queries still read the cached rect without re-rendering per call.
        if (interpreter && !sgRoot.rendering && this.needsSubBoundingRectRefresh()) {
            this.refreshLayoutFromRoot(interpreter);
        }
        const subpart = this.resolveSubpart(itemNumber);
        if (!subpart) {
            // No such sub part: return the node's own bounding rect, refreshing layout the same way
            // getBoundingRect does (guarded against re-entrant renders).
            return this.getBoundingRect(type, interpreter);
        }
        // A resolved sub part is an already-rendered item component carrying a valid rect from the last
        // frame. Do NOT force a full-tree re-render here (getBoundingRect): subBoundingRect is queried
        // on every focus/scroll change, so re-rendering the whole scene per query is prohibitively slow
        // AND can capture a transient, mid-layout size (an item briefly at the row's full itemSize
        // instead of its poster size). The cached rects are at most one frame old, matching a real
        // device (subBoundingRect reports the location at call time); for the fixed-focus lists that
        // drive a focused-item overlay from this, the focused item's position is constant, so the cached
        // value is exact. this.rect* are this node's own cached rects (it renders every frame), so they
        // are consistent with the sub part's scene rect.
        const subScene = subpart.rectToScene;
        if (type === "toScene") {
            return { ...subScene };
        }
        // The subpart rect is tracked in scene coordinates; re-express it relative to this
        // node's position in the requested space.
        const base = type === "local" ? this.rectLocal : this.rectToParent;
        return {
            x: base.x + (subScene.x - this.rectToScene.x),
            y: base.y + (subScene.y - this.rectToScene.y),
            width: subScene.width,
            height: subScene.height,
        };
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
        if (focusOn && Node.isFocusRequestDropped()) {
            // Device-measured: Roku ignores a focus request raised from a focus-LOSS notification
            // (see notifyStagedFocus). Report the request as not applied, so a subclass override
            // gated on `super.setNodeFocus(...)` skips its focus bookkeeping too (an ArrayGrid must
            // not move `itemFocused` for a grid that never took focus).
            return false;
        }
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

            // Get the focus chain, with lowest ancestor first.
            let newFocusChain = this.createPath();

            // Capture the previously focused node, then update the global focus
            // reference up front so any observers fired while we rewrite the
            // focusedChild fields below already see the new focus state
            // (hasFocus() === sgRoot.focused === this). Otherwise, clearing the old
            // focus chain flushes its observers synchronously while sgRoot.focused
            // still points at the node losing focus, making it (incorrectly) report
            // hasFocus() === true alongside the node gaining focus.
            const prevFocused = sgRoot.focused;
            sgRoot.setFocused(this);

            // Stage every focusedChild write first, then notify. A Roku commits the whole focus
            // transaction before it dispatches any focusedChild observer, so an observer always
            // reads the FINISHED chain — never a half-rewritten one (device-measured).
            const staged: StagedFocus[] = [];

            // If there was already a focused node somewhere, we need to remove focus
            // from it and its ancestors.
            if (prevFocused instanceof Node) {
                // Get the focus chain, with root-most ancestor first.
                let currFocusChain = this.createPath(prevFocused);

                // Find the lowest common ancestor (LCA) between the newly focused node
                // and the current focused node.
                let lcaIndex = 0;
                while (lcaIndex < newFocusChain.length && lcaIndex < currFocusChain.length) {
                    if (currFocusChain[lcaIndex] !== newFocusChain[lcaIndex]) break;
                    lcaIndex++;
                }

                // Unset all of the not-common ancestors of the current focused node.
                for (let i = lcaIndex; i < currFocusChain.length; i++) {
                    currFocusChain[i].stageFocusedChild(BrsInvalid.Instance, staged);
                }
            }

            // Set the focusedChild for each ancestor to the next node in the chain,
            // which is the current node's child.
            for (let i = 0; i < newFocusChain.length - 1; i++) {
                newFocusChain[i].stageFocusedChild(newFocusChain[i + 1], staged);
            }

            // Finally, set the focusedChild of the newly focused node to itself (to mimic RBI behavior).
            this.stageFocusedChild(this, staged);

            Node.notifyStagedFocus(staged, true);
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
            // we don't need to notify any ancestors.
            const staged: StagedFocus[] = [];
            this.stageFocusedChild(BrsInvalid.Instance, staged);
            Node.notifyStagedFocus(staged);
        }
        return this.isFocusable();
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
     * chain order (the subtree losing focus first, then the one gaining it).
     * @param staged Fields staged by `stageFocusedChild`.
     * @param gaining True when a node is taking focus, so a competing request raised from one of
     *   these callbacks can be classified — see `isFocusRequestDropped`. False for the unfocus
     *   paths: with no node taking focus there is nothing to defend, and dropping an observer's
     *   restore there would leave the app with no focused node at all.
     */
    private static notifyStagedFocus(staged: StagedFocus[], gaining = false) {
        // Marks these as an engine-initiated focus emission, so notifications raised during a
        // component's init() defer until init returns (see Field.enterInit).
        Field.enterFocusEmission();
        try {
            for (const entry of staged) {
                if (gaining) {
                    Node.focusNotifyOwners.push(entry.node);
                }
                try {
                    entry.field.notifyObservers();
                } finally {
                    if (gaining) {
                        Node.focusNotifyOwners.pop();
                    }
                }
            }
        } finally {
            Field.exitFocusEmission();
        }
    }

    /** Resets focus-dispatch state between app runs so nothing leaks across setups. */
    static resetFocusDispatch() {
        Node.focusNotifyOwners.length = 0;
    }

    /**
     * Whether a `setFocus(true)` issued right now must be ignored.
     *
     * Device-measured: a Roku honors a focus request raised from a `focusedChild` observer only when
     * the observed node is still in the focus chain — the "forward focus" pattern where a container
     * that just GAINED focus hands it to an inner widget. A request raised from the mirror-image
     * notification, by a node that just LOST focus, is dropped: the chain and the remote stay with
     * the node the in-flight transaction focused.
     *
     * That asymmetry is what makes an app which re-grabs focus from its own focus-loss observer
     * behave on a device and not here: the engine used to let the re-grab win the live focus while
     * the outer transaction still wrote its own chain, leaving `sgRoot.focused` and `focusedChild`
     * pointing at different nodes.
     * @returns True when the in-flight notification is a focus loss, so the request is ignored.
     */
    private static isFocusRequestDropped(): boolean {
        const owner = Node.focusNotifyOwners.at(-1);
        const focused = sgRoot.focused;
        if (!owner || !(focused instanceof Node)) {
            return false;
        }
        // Is the owner still in the focus chain? Cheap upward walk from the focused node, the same
        // shape restoreFocusChainOnAttach uses — an O(subtree) descent would be walked on every
        // focus request made from inside a notification.
        let ancestor: BrsType = focused;
        while (ancestor instanceof Node && ancestor !== owner) {
            ancestor = ancestor.parent;
        }
        return ancestor !== owner;
    }

    /**
     * Searches the subtree rooted at the provided node for a matching `id`.
     *
     * Per Roku's ifSGNodeDict spec, findNode is a BREADTH-FIRST search: every node at one depth
     * is tested before any deeper node. This matters when ids collide across depths — a
     * depth-first walk would descend into an earlier sibling's subtree (including a custom
     * component's internal children) and return a deep node whose id shadows a shallower
     * sibling's (e.g. a list container whose first child component internally names a node
     * "rowList" while the container's own sibling grid is "RowList" — breadth-first, matching a
     * device, resolves to the sibling).
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
        const queue: Node[] = [];
        if (ignoreRoot) {
            visited.add(node);
            for (const child of node.children) {
                if (child instanceof Node) {
                    queue.push(child);
                }
            }
        } else {
            queue.push(node);
        }
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
            for (const child of current.children) {
                if (child instanceof Node) {
                    queue.push(child);
                }
            }
        }
        // name was not found anywhere in tree
        return BrsInvalid.Instance;
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
        if (value.get(new BrsString("subtype")) instanceof BrsInvalid) {
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
     * @param functionArgs Arguments provided by BrightScript.
     * @returns Function return value or invalid when not callable.
     */
    protected callFunction(interpreter: Interpreter, functionName: BrsString, ...functionArgs: BrsType[]): BrsType {
        // We need to search the callee's environment for this function rather than the caller's.
        // Only allow public functions (defined in the interface) to be called.
        const name = functionName.getValue();
        if (this.componentDef && this.funcNames.has(name.toLowerCase())) {
            return interpreter.inSubEnv((subInterpreter) => {
                let functionToCall = subInterpreter.getCallableFunction(name);
                if (!(functionToCall instanceof Callable)) {
                    BrsDevice.stderr.write(`warning,Ignoring attempt to call non-implemented function ${name}`);
                    return BrsInvalid.Instance;
                }
                const originalLocation = interpreter.location;
                let addedToStack = false;
                subInterpreter.environment.setM(this.m);
                subInterpreter.environment.setRootM(this.m);
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
     * Records subtype hierarchy information for use with `isSubtype` checks.
     * @param nodeName Child node type.
     * @param parentType Parent type it extends.
     */
    protected setExtendsType(nodeName: string, parentType: SGNodeType) {
        const typeKey = nodeName.toLowerCase();
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
    protected shouldRendezvous(): boolean {
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
     * Helper to perform a rendezvous method call via the current task.
     * @param interpreter Current BrightScript interpreter.
     * @param method Name of the method to call.
     * @param args Arguments to pass to the remote method.
     * @returns Result of the remote method call, or undefined if not available.
     */
    protected rendezvousCall(interpreter: Interpreter, method: string, callArgs?: BrsType[]): BrsType | undefined {
        if (!this.shouldRendezvous()) {
            return undefined;
        }
        const task = sgRoot.getCurrentThreadTask();
        if (task?.active) {
            let host = this.address;
            const hostNode = interpreter.environment.hostNode;
            if (hostNode instanceof Node) {
                host = hostNode.getAddress();
            }
            const location = interpreter.location;
            const args = callArgs?.map((arg: BrsType) => {
                if (arg instanceof Node) {
                    arg.setOwner(0); // Node references sent to render thread will be owned by the render thread
                    // Pass the task as host so port-observed fields are flagged `_observed_`. A node
                    // built *inside* a task and observed there (the request/result node of a worker
                    // pool) is task-owned at `observeField` time, so that call never rendezvoused and
                    // the render thread would otherwise have no idea anyone is waiting on it.
                    return fromSGNode(arg, true, task);
                }
                return jsValueOf(arg);
            });
            const payload: MethodCallPayload = args ? { host, args, location } : { host, location };
            return task.requestMethodCall(this.syncType, this.address, method, payload);
        }
        return undefined;
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
