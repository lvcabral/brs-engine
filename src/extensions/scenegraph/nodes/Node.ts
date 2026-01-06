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
    ThreadUpdate,
    generateArgumentMismatchError,
    Rect,
    IfDraw2D,
    Stmt,
    Callable,
    Interpreter,
    BrsDevice,
} from "brs-engine";
import { RoSGNode } from "../components/RoSGNode";
import { createNodeByType, getBrsValueFromFieldType, subtypeHierarchy } from "../factory/NodeFactory";
import { Field } from "../nodes/Field";
import { FieldAlias, FieldEntry, FieldKind, FieldModel } from "../SGTypes";
import { toAssociativeArray, jsValueOf, fromSGNode } from "../factory/Serializer";
import { sgRoot } from "../SGRoot";
import { SGNodeType } from ".";
import { ComponentDefinition } from "../parser/ComponentDefinition";

type ChangeOperation = "none" | "insert" | "add" | "remove" | "set" | "clear" | "move" | "setall" | "modify";

/**
 * Base implementation for a SceneGraph node used by custom Roku components.
 * Handles BrightScript-facing field management, child lists, focus, observers, and rendering plumbing.
 */
export class Node extends RoSGNode implements BrsValue {
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

    /** Parent node reference or invalid when detached. */
    protected parent: Node | BrsInvalid;
    /** Hex-like identifier exposed via introspection APIs. */
    address: string;
    /** Thread identifier that owns the node instance. */
    owner: number;
    /** Flags whether structural or field state changed since last render. */
    changed: boolean = false;

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
     */
    constructor(initializedFields: AAMember[] = [], readonly nodeSubtype: string = SGNodeType.Node) {
        super([], nodeSubtype);
        this.address = genHexAddress();
        this.fields = new Map();
        this.aliases = new Map();
        this.children = [];
        this.parent = BrsInvalid.Instance;
        this.owner = sgRoot.taskId;

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
    protected hasNodeField(fieldName: string): boolean {
        return this.fields.has(fieldName.toLowerCase());
    }

    /**
     * Validates whether the specified field can accept the supplied value.
     * @param fieldName Field to validate against.
     * @param value BrightScript value candidate.
     * @returns True if the value passes validation.
     */
    protected canAcceptValue(fieldName: string, value: BrsType): boolean {
        const field = this.fields.get(fieldName.toLowerCase());
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
     * Looks up a field or method by name, mimicking BrightScript associative-array semantics.
     * @param index Field or method name as a BrightScript string value.
     * @throws Error when an unsupported index type is provided.
     * @returns Field value, method, or invalid when missing.
     */
    get(index: BrsType): BrsType {
        if (!isBrsString(index)) {
            throw new Error("Node indexes must be strings");
        }
        // TODO: this works for now, in that a property with the same name as a method essentially
        // overwrites the method. The only reason this doesn't work is that getting a method from an
        // associative array and _not_ calling it returns `invalid`, but calling it returns the
        // function itself. I'm not entirely sure why yet, but it's gotta have something to do with
        // how methods are implemented within RBI.
        //
        // Are they stored separately from elements, like they are here? Or does
        // `Interpreter#visitCall` need to check for `invalid` in its callable, then try to find a
        // method with the desired name separately? That last bit would work but it's pretty gross.
        // That'd allow roArrays to have methods with the methods not accessible via `arr["count"]`.
        // Same with RoAssociativeArrays I guess.
        const field = this.fields.get(index.getValue().toLowerCase());
        if (field) {
            const value = field.getValue();
            if (value instanceof RoAssociativeArray || value instanceof RoArray) {
                return value.deepCopy();
            } else if (isUnboxable(value)) {
                return value.copy();
            }
            return value;
        }
        return (this as any).getMethod(index.getValue()) || BrsInvalid.Instance;
    }

    /**
     * Retrieves a field's BrightScript value or `invalid` if the field is unknown.
     * @param fieldName Name of the field to fetch.
     * @returns Stored BrightScript value.
     */
    getValue(fieldName: string) {
        const field = this.fields.get(fieldName.toLowerCase());
        return field ? field.getValue() : BrsInvalid.Instance;
    }

    /**
     * Retrieves a plain JavaScript representation of a field's value, if possible.
     * @param fieldName Name of the field to fetch.
     * @returns Native JS value or undefined.
     */
    getValueJS(fieldName: string) {
        const field = this.fields.get(fieldName.toLowerCase());
        return field ? jsValueOf(field.getValue()) : undefined;
    }

    /**
     * Sets or aliases a field value, performing type validation and notification.
     * @param index Field name to update.
     * @param value New BrightScript value.
     * @param alwaysNotify When provided, controls observer notification behavior for new fields.
     * @param kind Optional explicit field kind used when creating new dynamic fields.
     */
    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const mapKey = index.toLowerCase();
        const fieldType = kind ?? FieldKind.fromBrsType(value);
        const alias = this.aliases.get(mapKey);
        let field = this.fields.get(mapKey);
        if (field && field.getType() !== FieldKind.String && isBrsString(value)) {
            // If the field is not a string, but the value is a string, convert it.
            value = getBrsValueFromFieldType(field.getType(), value.getValue());
        }
        let errorMsg = "";
        if (!field) {
            // RBI does not create a new field if the value isn't valid.
            if (fieldType && alwaysNotify !== undefined) {
                field = new Field(index, value, fieldType, alwaysNotify);
                this.fields.set(mapKey, field);
                this.notified = true;
                this.changed = true;
            } else {
                errorMsg = `BRIGHTSCRIPT: ERROR: roSGNode.Set: Tried to set nonexistent field "${index}" of a "${this.nodeSubtype}" node:`;
            }
        } else if (alias) {
            const child = this.findNodeById(this, alias.nodeId);
            if (child instanceof Node) {
                child.setValue(alias.fieldName, value, alwaysNotify);
                this.changed = true;
            } else {
                errorMsg = `BRIGHTSCRIPT: ERROR: roSGNode.Set: "${index}": Alias "${alias.nodeId}.${alias.fieldName}" not found!`;
            }
        } else if (field.canAcceptValue(value)) {
            // Fields are not overwritten if they haven't the same type.
            // Except Numbers and Booleans that can be converted to string fields.
            this.notified = field.setValue(value, true);
            this.fields.set(mapKey, field);
            this.changed = true;
        } else if (!isInvalid(value)) {
            errorMsg = `BRIGHTSCRIPT: ERROR: roSGNode.AddReplace: "${index}": Type mismatch!`;
        }
        if (errorMsg.length > 0) {
            BrsDevice.stderr.write(`warning,${errorMsg} ${this.location}`);
        }
    }

    /**
     * Writes a field value bypassing validation and observer notification.
     * @param fieldName Field name to mutate.
     * @param value Value to assign.
     * @param hidden Optional hidden flag override applied when creating the field.
     */
    setValueSilent(fieldName: string, value: BrsType, hidden?: boolean) {
        const mapKey = fieldName.toLowerCase();
        let field = this.fields.get(mapKey);
        if (field) {
            field.setValue(value, false);
            if (hidden !== undefined) {
                field.setHidden(hidden);
            }
        } else {
            const fieldType = FieldKind.fromBrsType(value);
            if (fieldType) {
                field = new Field(fieldName, value, fieldType, false, false, hidden ?? false);
            }
        }
        if (field) {
            this.fields.set(mapKey, field);
            this.changed = true;
        }
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
        const clonedNode = createNodeByType(this.nodeSubtype);
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
        const copiedNode = createNodeByType(this.nodeSubtype);
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
        const field = this.fields.get(fieldName.toLowerCase());
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
        this.changed = true;
        return { code: refs };
    }

    /**
     * Moves the contents of an associative-array field into a return value.
     * @param fieldName Field to clear and return.
     * @returns The moved value or an error string.
     */
    protected moveObjectFromField(fieldName: string): BrsType | string {
        const field = this.fields.get(fieldName.toLowerCase());
        if (field === undefined) {
            return `Could not find field '"${fieldName}"'`;
        } else if (field.getType() !== FieldKind.AssocArray) {
            return `cannot moveFromField on non-assocarray fields`;
        }
        const value = field.getValue();
        field.setValue(BrsInvalid.Instance, true);
        this.changed = true;
        return value;
    }

    /**
     * Adds a new dynamic field if it does not already exist.
     * @param fieldName Name of the field to create.
     * @param type Roku field type string.
     * @param alwaysNotify Whether observers should always fire for the field.
     */
    addNodeField(fieldName: string, type: string, alwaysNotify: boolean) {
        let defaultValue = getBrsValueFromFieldType(type);
        let fieldKind = FieldKind.fromString(type);

        if (defaultValue !== Uninitialized.Instance && !this.fields.has(fieldName.toLowerCase())) {
            this.setValue(fieldName, defaultValue, alwaysNotify, fieldKind);
            this.changed = true;
        }
    }

    /**
     * Registers a field alias pointing to a child node's field.
     * @param fieldName Local alias name.
     * @param field Backing field metadata.
     * @param childNode Target child id.
     * @param childField Name on the child node.
     */
    addNodeFieldAlias(fieldName: string, field: Field, childNode: string, childField: string) {
        this.fields.set(fieldName.toLowerCase(), field);
        this.aliases.set(fieldName.toLowerCase(), { nodeId: childNode, fieldName: childField, aliasName: fieldName });
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
                this.changed = true;
            }
        }
    }

    /**
     * Sets one or more fields from an associative array.
     * @param fieldsToSet Data source.
     * @param addFields If true, missing fields are created.
     */
    protected setNodeFields(fieldsToSet: RoAssociativeArray, addFields: boolean) {
        for (const [key, value] of fieldsToSet.elements) {
            if (addFields || (!addFields && this.fields.has(key.toLowerCase()))) {
                this.setValue(key, value, false);
                this.changed = true;
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
        const field = this.fields.get(fieldName.toLowerCase());
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
        const field = this.fields.get(fieldName.toLowerCase());
        return !!field && field.getType() === FieldKind.AssocArray && field.isValueRef();
    }

    /**
     * Returns an associative array field by reference when permitted.
     * @param fieldName Field to fetch.
     * @returns The AA reference or an error string.
     */
    protected getFieldByRef(fieldName: string): RoAssociativeArray | string {
        const field = this.fields.get(fieldName.toLowerCase());
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
     * Assigns a new parent reference.
     * @param parent Node that is adopting this node.
     */
    setNodeParent(parent: Node) {
        this.parent = parent;
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
     * Forces a render pass and returns the requested bounding rectangle.
     * @param interpreter Interpreter used to render the root path.
     * @param type Rectangle type: `local`, `toScene`, or any other value for parent space.
     * @returns Bounding rectangle in the requested coordinate space.
     */
    getBoundingRect(interpreter: Interpreter, type: string): Rect {
        const root = this.createPath(this)[0];
        root.renderNode(interpreter, [0, 0], 0, 1);
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
        scope: "permanent" | "scoped" | "unscoped",
        fieldName: BrsString,
        funcOrPort: BrsString | RoMessagePort,
        infoFields?: RoArray
    ) {
        let result = BrsBoolean.False;
        const name = fieldName.getValue();
        const field = this.fields.get(name.toLowerCase());
        if (field instanceof Field) {
            let callableOrPort: Callable | RoMessagePort | BrsInvalid = BrsInvalid.Instance;
            if (!interpreter.environment.hostNode) {
                const location = interpreter.formatLocation();
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGNode.ObserveField: "${this.nodeSubtype}.${name}" no active host node: ${location}`
                );
            } else if (funcOrPort instanceof BrsString) {
                callableOrPort = interpreter.getCallableFunction(funcOrPort.getValue());
            } else if (funcOrPort instanceof RoMessagePort) {
                const host = interpreter.environment.hostNode as Node;
                funcOrPort.registerCallback(host.nodeSubtype, host.getNewEvents.bind(host));
                callableOrPort = funcOrPort;
            }
            if (!(callableOrPort instanceof BrsInvalid)) {
                if (this.aliases.has(name.toLowerCase())) {
                    fieldName = new BrsString(this.aliases.get(name.toLowerCase())!.fieldName);
                } else {
                    fieldName = new BrsString(field.getName());
                }
                field.addObserver(scope, interpreter, callableOrPort, this, fieldName, infoFields);
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
    protected setNodeFocus(interpreter: Interpreter, focusOn: boolean): boolean {
        const focusedChild = "focusedchild";
        if (focusOn) {
            if (!this.triedInitFocus) {
                // Only try initial focus once
                this.triedInitFocus = true;
                if (this.componentDef?.initialFocus) {
                    const childToFocus = this.findNodeById(this, this.componentDef.initialFocus);
                    if (childToFocus instanceof Node) {
                        childToFocus.setNodeFocus(interpreter, true);
                        return this.isFocusable();
                    }
                }
            }
            if (!this.isFocusable() && this.isChildrenFocused()) {
                return false;
            }

            sgRoot.setFocused(this);

            // Get the focus chain, with lowest ancestor first.
            let newFocusChain = this.createPath(this);

            // If there's already a focused node somewhere, we need to remove focus
            // from it and its ancestors.
            if (sgRoot.focused instanceof Node) {
                // Get the focus chain, with root-most ancestor first.
                let currFocusChain = this.createPath(sgRoot.focused);

                // Find the lowest common ancestor (LCA) between the newly focused node
                // and the current focused node.
                let lcaIndex = 0;
                while (lcaIndex < newFocusChain.length && lcaIndex < currFocusChain.length) {
                    if (currFocusChain[lcaIndex] !== newFocusChain[lcaIndex]) break;
                    lcaIndex++;
                }

                // Unset all of the not-common ancestors of the current focused node.
                for (let i = lcaIndex; i < currFocusChain.length; i++) {
                    currFocusChain[i].setValue(focusedChild, BrsInvalid.Instance, false);
                }
            }

            // Set the focusedChild for each ancestor to the next node in the chain,
            // which is the current node's child.
            for (let i = 0; i < newFocusChain.length - 1; i++) {
                newFocusChain[i].setValue(focusedChild, newFocusChain[i + 1], false);
            }

            // Finally, set the focusedChild of the newly focused node to itself (to mimic RBI behavior).
            this.setValue(focusedChild, this, false);
        } else if (sgRoot.focused === this) {
            // If we're unsetting focus on ourself, we need to unset it on all ancestors as well.
            const currFocusedNode = sgRoot.focused;
            sgRoot.setFocused();
            // Get the focus chain, with root-most ancestor first.
            let currFocusChain = this.createPath(currFocusedNode as Node);
            for (const node of currFocusChain) {
                node.setValue(focusedChild, BrsInvalid.Instance, false);
            }
        } else {
            // If the node doesn't have focus already, and it's not gaining focus,
            // we don't need to notify any ancestors.
            this.setValue(focusedChild, BrsInvalid.Instance, false);
        }
        return this.isFocusable();
    }

    /**
     * Searches the subtree rooted at the provided node for a matching `id`.
     * @param node Root to inspect.
     * @param id Identifier to seek (case-insensitive).
     * @returns The matching node or BrsInvalid when not found.
     */
    findNodeById(node: Node, id: string): Node | BrsInvalid {
        // test current node in tree
        const myId = node.getValue("id");
        if (myId?.toString().toLowerCase() === id.toLowerCase()) {
            return node;
        }
        // visit each child
        for (const child of node.children) {
            if (!(child instanceof Node)) {
                continue;
            }
            const result = this.findNodeById(child, id);
            if (result instanceof Node) {
                return result;
            }
        }
        // name was not found anywhere in tree
        return BrsInvalid.Instance;
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
        if (!uri.trim()) {
            return undefined;
        }
        if (sgRoot.scene?.subSearch && sgRoot.scene?.subReplace) {
            uri = uri.replace(sgRoot.scene.subSearch, sgRoot.scene.subReplace);
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
        const field = node.fields.get(fieldName.toLowerCase());
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
        this.changed ||= removed;
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
                const childNode = createNodeByType(childSubtype, interpreter);
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
                this.changed = true;
            } else if (fieldName === "subtype") {
                // Skip the "subtype" field, already handled
                continue;
            }
            // Set all other fields, respecting the createFields parameter
            else if (node.fields.has(fieldName) || (createFields && !isInvalid(value))) {
                node.setValue(key, value, false);
                this.changed = true;
            }
        }
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
                this.changed = true;
                return true;
            }
        }
        return false;
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
            this.changed = true;
            return true;
        }
        return false;
    }

    /**
     * Appends a child node to this node's children collection.
     * @param child Child to append.
     * @returns True when the child was appended.
     */
    appendChildToParent(child: BrsType): boolean {
        if (child instanceof Node) {
            if (this.children.includes(child)) {
                return true;
            }
            const insertionIndex = this.children.length;
            this.children.push(child);
            child.setNodeParent(this);
            this.changed = true;
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
        newChild.setNodeParent(this);
        this.children.splice(index, 1, newChild);
        this.changed = true;
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
            this.changed = true;
            this.recordChildChange("insert", index, index);
            return true;
        }
        child.setNodeParent(this);
        this.children.splice(index, 0, child);
        this.changed = true;
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
     * @param node Leaf node used to build the path.
     * @param reverse When true (default) returns the path root-first.
     * @returns Parent chain starting with the root-most ancestor.
     */
    protected createPath(node: Node, reverse: boolean = true): Node[] {
        let path: Node[] = [node];

        while (node.parent instanceof Node) {
            path.push(node.parent);
            node = node.parent;
        }

        return reverse ? path.reverse() : path;
    }

    /**
     * Finds the root ancestor either from the provided node or from this node.
     * @param from Optional starting node.
     * @returns Root-most ancestor.
     */
    protected findRootNode(from?: Node): Node {
        let root: Node = from ?? this;
        while (root.parent instanceof Node) {
            root = root.parent;
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

                subInterpreter.environment.setM(this.m);
                subInterpreter.environment.setRootM(this.m);
                subInterpreter.environment.hostNode = this;

                try {
                    // Determine whether the function should get arguments or not.
                    let satisfiedSignature = functionToCall.getFirstSatisfiedSignature(functionArgs);
                    const args = satisfiedSignature ? functionArgs : [];
                    satisfiedSignature ??= functionToCall.getFirstSatisfiedSignature([]);
                    if (satisfiedSignature) {
                        const funcLoc = functionToCall.getLocation() ?? interpreter.location;
                        interpreter.addToStack({
                            functionName: name,
                            functionLocation: funcLoc,
                            callLocation: funcLoc,
                            signature: satisfiedSignature.signature,
                        });
                        const returnValue = functionToCall.call(subInterpreter, ...args);
                        interpreter.stack.pop();
                        return returnValue;
                    } else {
                        return interpreter.addError(
                            generateArgumentMismatchError(
                                functionToCall,
                                functionArgs,
                                interpreter.stack.at(-1)?.functionLocation!
                            )
                        );
                    }
                } catch (reason) {
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
        for (const field of fields) {
            const value = getBrsValueFromFieldType(field.type, field.value);
            const fieldType = FieldKind.fromString(field.type);
            if (fieldType) {
                this.fields.set(
                    field.name.toLowerCase(),
                    new Field(field.name, value, fieldType, !!field.alwaysNotify, true, field.hidden)
                );
            }
        }
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
     * Posts a serialized node update to the owning thread.
     * @param id Target thread id.
     * @param type Update domain.
     * @param field Field name being synchronized.
     * @param value Value to send.
     * @param deep When true nested nodes are deeply serialized.
     */
    protected sendThreadUpdate(
        id: number,
        type: "scene" | "global" | "task",
        field: string,
        value: BrsType,
        deep: boolean = false
    ) {
        const update: ThreadUpdate = {
            id: id,
            type: type,
            field: field,
            value: value instanceof Node ? fromSGNode(value, deep) : jsValueOf(value),
        };
        if (sgRoot.inTaskThread() && value instanceof Node) value.changed = false;
        postMessage(update);
    }

    /**
     * Builds an associative array describing the node's threading context.
     * @returns Associative array describing thread state.
     */
    protected getThreadInfo() {
        const threadData: FlexObject = {
            currentThread: sgRoot.getCurrentThread(),
            node: {
                address: this.address,
                id: this.getId(),
                type: this.nodeSubtype,
                owningThread: sgRoot.getThreadInfo(this.owner),
                willRendezvousFromCurrentThread: this.owner === sgRoot.taskId ? "No" : "Yes",
            },
            renderThread: sgRoot.getRenderThread(),
        };
        return toAssociativeArray(threadData);
    }
}
