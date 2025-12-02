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
    Int32,
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
import { createNodeByType, getBrsValueFromFieldType, subtypeHierarchy } from "../factory/SGNodeFactory";
import { Field } from "../nodes/Field";
import { FieldAlias, FieldKind, FieldModel } from "../SGTypes";
import { toAssociativeArray, jsValueOf, fromSGNode } from "../factory/serialization";
import { sgRoot } from "../SGRoot";

export class Node extends RoSGNode implements BrsValue {
    protected readonly fields: Map<string, Field>;
    protected readonly aliases: Map<string, FieldAlias>;
    protected readonly children: (Node | BrsInvalid)[];
    protected triedInitFocus: boolean = false;
    protected notified: boolean = false;

    protected parent: Node | BrsInvalid;
    address: string;
    owner: number;
    changed: boolean = false;

    rectLocal: Rect = { x: 0, y: 0, width: 0, height: 0 };
    rectToParent: Rect = { x: 0, y: 0, width: 0, height: 0 };
    rectToScene: Rect = { x: 0, y: 0, width: 0, height: 0 };

    readonly defaultFields: FieldModel[] = [
        { name: "id", type: FieldKind.String },
        { name: "focusable", type: FieldKind.Boolean },
        { name: "focusedChild", type: FieldKind.Node, alwaysNotify: true },
        { name: "change", type: FieldKind.AssocArray },
    ];

    constructor(initializedFields: AAMember[] = [], readonly nodeSubtype: string = "Node") {
        super([], nodeSubtype);
        this.setExtendsType();
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
    }

    toString(parent?: BrsType): string {
        const componentName = `${this.getComponentName()}:${this.nodeSubtype}`;
        if (parent) {
            return `<Component: ${componentName}>`;
        }
        const systemFields: [string, Field][] = [];
        const otherFields: [string, Field][] = [];
        for (const [key, field] of this.fields.entries()) {
            if (field.isHidden()) {
                continue;
            } else if (field.isSystem() && !this.aliases.has(key)) {
                systemFields.push([key, field]);
                continue;
            }
            otherFields.push([key, field]);
        }
        otherFields.sort((a, b) => a[0].localeCompare(b[0]));
        const allFields = [...systemFields, ...otherFields];
        return [
            `<Component: ${componentName}> =`,
            "{",
            ...allFields.map(([key, value]) => `    ${key}: ${value.toString(this)}`),
            "}",
        ].join("\n");
    }

    getElements() {
        return Array.from(this.fields.keys())
            .sort()
            .map((key) => new BrsString(key));
    }

    getValues() {
        return Array.from(this.fields.values())
            .sort()
            .map((field: Field) => field.getValue());
    }

    getNodeFields() {
        return this.fields;
    }

    protected getNodeFieldsAsAA(): RoAssociativeArray {
        const packagedFields: AAMember[] = [];
        for (const [name, field] of this.fields) {
            if (field.isHidden()) {
                continue;
            }
            packagedFields.push({ name: new BrsString(name), value: field.getValue() });
        }
        return new RoAssociativeArray(packagedFields);
    }

    protected getNodeFieldTypes(): RoAssociativeArray {
        const packagedFields: AAMember[] = [];
        for (const [name, field] of this.fields) {
            if (field.isHidden()) {
                continue;
            }
            packagedFields.push({ name: new BrsString(name), value: new BrsString(field.getType()) });
        }
        return new RoAssociativeArray(packagedFields);
    }

    protected hasNodeField(fieldName: string): boolean {
        return this.fields.has(fieldName.toLowerCase());
    }

    protected canAcceptValue(fieldName: string, value: BrsType): boolean {
        const field = this.fields.get(fieldName.toLowerCase());
        if (!field?.canAcceptValue(value)) {
            return false;
        }
        return true;
    }

    protected clearNodeFields() {
        for (const [name, field] of this.fields) {
            this.removeFieldEntry(name);
        }
    }

    getNodeChildren(): BrsType[] {
        return this.children;
    }

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

    getValue(fieldName: string) {
        const field = this.fields.get(fieldName.toLowerCase());
        return field ? field.getValue() : BrsInvalid.Instance;
    }

    getValueJS(fieldName: string) {
        const field = this.fields.get(fieldName.toLowerCase());
        return field ? jsValueOf(field.getValue()) : undefined;
    }

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
                field = new Field(value, fieldType, alwaysNotify);
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

    // Used to setup values for the node fields without validation or notifying observers
    setValueSilent(fieldName: string, value: BrsType) {
        const mapKey = fieldName.toLowerCase();
        let field = this.fields.get(mapKey);
        if (field) {
            field.setValue(value, false);
        } else {
            const fieldType = FieldKind.fromBrsType(value);
            if (fieldType) {
                field = new Field(value, fieldType, false);
            }
        }
        if (field) {
            this.fields.set(mapKey, field);
            this.changed = true;
        }
    }

    getId() {
        return this.getValueJS("id") ?? this.nodeSubtype;
    }

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

    addNodeField(fieldName: string, type: string, alwaysNotify: boolean) {
        let defaultValue = getBrsValueFromFieldType(type);
        let fieldKind = FieldKind.fromString(type);

        if (defaultValue !== Uninitialized.Instance && !this.fields.has(fieldName.toLowerCase())) {
            this.setValue(fieldName, defaultValue, alwaysNotify, fieldKind);
            this.changed = true;
        }
    }

    addNodeFieldAlias(fieldName: string, field: Field, childNode: string, childField: string) {
        this.fields.set(fieldName.toLowerCase(), field);
        this.aliases.set(fieldName.toLowerCase(), { nodeId: childNode, fieldName: childField });
    }

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

    protected setNodeFields(fieldsToSet: RoAssociativeArray, addFields: boolean) {
        for (const [key, value] of fieldsToSet.elements) {
            if (
                (addFields && !this.fields.has(key.toLowerCase())) ||
                (!addFields && this.fields.has(key.toLowerCase()))
            ) {
                this.setValue(key, value, false);
                this.changed = true;
            }
        }
    }

    protected updateFields(interpreter: Interpreter, content: BrsType, createFields: boolean) {
        if (content instanceof RoAssociativeArray) {
            this.populateNodeFromAA(interpreter, this, content, createFields, this.nodeSubtype);
        } else if (content instanceof RoArray) {
            this.updateChildrenFromArray(interpreter, this, content, createFields, this.nodeSubtype);
        }
    }

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

    protected canGetFieldByRef(fieldName: string): boolean {
        const field = this.fields.get(fieldName.toLowerCase());
        return !!field && field.getType() === FieldKind.AssocArray && field.isValueRef();
    }

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

    getNodeParent() {
        return this.parent;
    }

    setNodeParent(parent: Node) {
        this.parent = parent;
    }

    removeParent() {
        this.parent = BrsInvalid.Instance;
    }

    // recursively search for any child that's focused via DFS
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

    isFocusable() {
        return (this.getValueJS("focusable") as boolean) ?? false;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        this.renderChildren(interpreter, origin, angle, opacity, draw2D);
    }

    renderChildren(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        for (const node of this.children) {
            if (!(node instanceof Node)) {
                continue;
            }
            node.renderNode(interpreter, origin, angle, opacity, draw2D);
        }
        this.changed = false;
    }

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

    addObserver(
        interpreter: Interpreter,
        scope: "permanent" | "scoped" | "unscoped",
        fieldName: BrsString,
        funcOrPort: BrsString | RoMessagePort,
        infoFields?: RoArray
    ) {
        let result = BrsBoolean.False;
        const field = this.fields.get(fieldName.value.toLowerCase());
        if (field instanceof Field) {
            let callableOrPort: Callable | RoMessagePort | BrsInvalid = BrsInvalid.Instance;
            if (!interpreter.environment.hostNode) {
                const location = interpreter.formatLocation();
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGNode.ObserveField: "${this.nodeSubtype}.${fieldName.value}" no active host node: ${location}`
                );
            } else if (funcOrPort instanceof BrsString) {
                callableOrPort = interpreter.getCallableFunction(funcOrPort.value);
            } else if (funcOrPort instanceof RoMessagePort) {
                const host = interpreter.environment.hostNode as Node;
                funcOrPort.registerCallback(host.nodeSubtype, host.getNewEvents.bind(host));
                callableOrPort = funcOrPort;
            }
            if (!(callableOrPort instanceof BrsInvalid)) {
                field.addObserver(scope, interpreter, callableOrPort, this, fieldName, infoFields);
                result = BrsBoolean.True;
            }
        }
        return result;
    }

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

    /** Sets or removes the focus to/from the Node */
    protected setNodeFocus(interpreter: Interpreter, focusOn: boolean): boolean {
        const focusedChild = "focusedchild";
        if (focusOn) {
            if (!this.triedInitFocus) {
                // Only try initial focus once
                this.triedInitFocus = true;
                const typeDef = sgRoot.nodeDefMap.get(this.nodeSubtype.toLowerCase());
                if (typeDef?.initialFocus) {
                    const childToFocus = this.findNodeById(this, typeDef.initialFocus);
                    if (childToFocus instanceof Node) {
                        childToFocus.setNodeFocus(interpreter, true);
                        return this.isFocusable();
                    }
                }
            } else if (!this.isFocusable() && this.isChildrenFocused()) {
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

    /* searches the node tree for a node with the given id */
    findNodeById(node: Node, id: string): Node | BrsInvalid {
        // test current node in tree
        let currentId = node.getValue("id");
        if (currentId.toString().toLowerCase() === id.toLowerCase()) {
            return node;
        }

        // visit each child
        for (const child of node.children) {
            if (!(child instanceof Node)) {
                continue;
            }
            let result = this.findNodeById(child, id);
            if (result instanceof Node) {
                return result;
            }
        }
        // name was not found anywhere in tree
        return BrsInvalid.Instance;
    }

    /** Returns a bitmap based on one of the fields of the node */
    getBitmap(fieldName: string) {
        const uri = this.getValueJS(fieldName) as string;
        return this.loadBitmap(uri);
    }

    /** Loads a bitmap from the given URI */
    protected loadBitmap(uri: string) {
        if (!uri.trim()) {
            return undefined;
        }
        if (sgRoot.scene?.subSearch && sgRoot.scene?.subReplace) {
            uri = uri.replace(sgRoot.scene.subSearch, sgRoot.scene.subReplace);
        }
        return getTextureManager().loadTexture(uri, this.httpAgent.customHeaders);
    }

    /** Returns the largest dimensions of the icons from the passed fields */
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

    /** Copies a field value from this Node to a Child node field */
    protected copyField(node: Node, fieldName: string, thisField?: string) {
        const value = this.getValue(thisField ?? fieldName);
        node.setValue(fieldName, value);
        return value;
    }

    /** Links a field from another node to this node field */
    protected linkField(node: Node, fieldName: string, thisField?: string) {
        const field = node.fields.get(fieldName.toLowerCase());
        if (field) {
            this.fields.set((thisField ?? fieldName).toLowerCase(), field);
        }
        return field;
    }

    /** Removes a field from this Node */
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

    /** Creates a tree of Nodes children from an array of associative arrays */
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

    /** Populates a node from an associative array, recursively converting nested children arrays to nodes */
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

    /** Message callback to handle observed fields with message port */
    protected getNewEvents(_interpreter: Interpreter, _wait: number) {
        // To be overridden by the Task class
        return new Array<BrsEvent>();
    }

    protected removeChildByReference(child: BrsType): boolean {
        if (child instanceof Node) {
            let spliceIndex = this.children.indexOf(child);
            if (spliceIndex >= 0) {
                child.removeParent();
                this.children.splice(spliceIndex, 1);
            }
            this.changed = true;
            return true;
        }
        return false;
    }

    protected removeChildrenAtIndex(index: number, count: number): boolean {
        if (count > 0 && index >= 0 && index < this.children.length) {
            const removedChildren = this.children.splice(index, count);
            for (const node of removedChildren.filter((n) => n instanceof RoSGNode)) {
                node.removeParent();
            }
            this.changed = true;
            return true;
        }
        return false;
    }

    appendChildToParent(child: BrsType): boolean {
        if (child instanceof Node) {
            if (this.children.includes(child)) {
                return true;
            }
            this.children.push(child);
            child.setNodeParent(this);
            this.changed = true;
            return true;
        }
        return false;
    }

    protected replaceChildAtIndex(newChild: Node, index: Int32): boolean {
        let childrenSize = this.children.length;
        let indexValue = index.getValue();
        if (indexValue < childrenSize) {
            // If newChild is already a child, remove it first.
            this.removeChildByReference(newChild);
            if (indexValue >= 0) {
                // The check is done to see if indexValue is inside the
                // new length of this.children (in case newChild was
                // removed above)
                if (indexValue < this.children.length) {
                    // Remove the parent of the child at indexValue
                    const oldChild = this.children[indexValue];
                    if (oldChild instanceof Node) {
                        oldChild.removeParent();
                    }
                }
                newChild.setNodeParent(this);
                this.children.splice(indexValue, 1, newChild);
            }
            return true;
        }
        return false;
    }

    protected insertChildAtIndex(child: BrsType, index: Int32): boolean {
        if (child instanceof Node) {
            let childrenSize = this.children.length;
            let indexValue = index.getValue() < 0 ? childrenSize : index.getValue();
            // Remove node if it already exists
            this.removeChildByReference(child);
            child.setNodeParent(this);
            this.children.splice(indexValue, 0, child);
            return true;
        }
        return false;
    }

    /**
     * Starting with a leaf node, traverses upward through the parents until it reaches
     * a node without a parent (root node).
     * @param {Node} node The leaf node to create the tree with
     * @param {boolean} reverse Whether to return the path in reverse order
     * @returns Node[] The parent chain starting with root-most parent
     */
    protected createPath(node: Node, reverse: boolean = true): Node[] {
        let path: Node[] = [node];

        while (node.parent instanceof Node) {
            path.push(node.parent);
            node = node.parent;
        }

        return reverse ? path.reverse() : path;
    }

    protected findRootNode(from?: Node): Node {
        let root: Node = from ?? this;
        while (root.parent instanceof Node) {
            root = root.parent;
        }
        return root;
    }

    protected callFunction(interpreter: Interpreter, functionName: BrsString, ...functionArgs: BrsType[]): BrsType {
        // We need to search the callee's environment for this function rather than the caller's.
        let componentDef = sgRoot.nodeDefMap.get(this.nodeSubtype.toLowerCase());

        // Only allow public functions (defined in the interface) to be called.
        if (componentDef && functionName.value in componentDef.functions) {
            return interpreter.inSubEnv((subInterpreter) => {
                let functionToCall = subInterpreter.getCallableFunction(functionName.value);
                if (!(functionToCall instanceof Callable)) {
                    BrsDevice.stderr.write(`Ignoring attempt to call non-implemented function ${functionName}`);
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
                            functionName: functionName.value,
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
                    return reason.value || BrsInvalid.Instance;
                }
            }, componentDef.environment);
        }

        BrsDevice.stderr.write(
            `Warning calling function in ${this.nodeSubtype}: no function interface specified for ${functionName}`
        );
        return BrsInvalid.Instance;
    }

    /* used for isSubtype */
    protected setExtendsType() {
        let baseClass = this.constructor;
        let currentNodeType: string, parentType: string;
        while (baseClass) {
            currentNodeType = baseClass.name.toLowerCase();

            const parentClass = Object.getPrototypeOf(baseClass);

            if (parentClass && parentClass !== Object && parentClass.name) {
                baseClass = parentClass;
                parentType = parentClass.name;
                if (parentType === "BrsComponent") {
                    // Only care about RoSgNode and above
                    break;
                }
                if (parentType === "RoSGNode") {
                    // RoSGNode is referenced as "Node"
                    parentType = "Node";
                }
                if (!subtypeHierarchy.has(currentNodeType)) {
                    subtypeHierarchy.set(currentNodeType, parentType);
                }
            } else {
                break;
            }
        }
    }

    /* Takes a list of models and creates fields with default values, and adds them to this.fields. */
    protected registerDefaultFields(fields: FieldModel[]) {
        for (const field of fields) {
            const value = getBrsValueFromFieldType(field.type, field.value);
            const fieldType = FieldKind.fromString(field.type);
            if (fieldType) {
                this.fields.set(
                    field.name.toLowerCase(),
                    new Field(value, fieldType, !!field.alwaysNotify, true, field.hidden)
                );
            }
        }
    }

    /**
     * Takes a list of preset fields and creates fields from them.
     * TODO: filter out any non-allowed members. For example, if we instantiate a Node like this:
     *      <Node thisisnotanodefield="fakevalue" />
     * then Roku logs an error, because Node does not have a property called "thisisnotanodefield".
     */
    protected registerInitializedFields(fields: AAMember[]) {
        for (const field of fields) {
            let fieldType = FieldKind.fromBrsType(field.value);
            if (fieldType) {
                this.fields.set(field.name.value.toLowerCase(), new Field(field.value, fieldType, false));
            }
        }
    }

    protected compareNodes(other: Node): boolean {
        return this.nodeSubtype === other.nodeSubtype && this.address === other.address;
    }

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
