import {
    BrsValue,
    ValueKind,
    BrsString,
    BrsInvalid,
    BrsBoolean,
    Uninitialized,
    getBrsValueFromFieldType,
} from "../BrsType";
import { BrsComponent, BrsIterable } from "./BrsComponent";
import {
    AAMember,
    BrsType,
    RoMessagePort,
    Timer,
    Int32,
    RoArray,
    RoAssociativeArray,
    toAssociativeArray,
    BrsEvent,
    Scene,
    Task,
    jsValueOf,
    getTextureManager,
} from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Stmt } from "../../parser";
import { Interpreter } from "../../interpreter";
import { generateArgumentMismatchError } from "../../error/ArgumentMismatch";
import { createNodeByType, isSubtypeCheck, subtypeHierarchy } from "../../scenegraph/SGNodeFactory";
import { Field, FieldAlias, FieldKind, FieldModel } from "../nodes/Field";
import { Rect, IfDraw2D } from "../interfaces/IfDraw2D";
import { BrsDevice } from "../../device/BrsDevice";
import { RoHttpAgent } from "./RoHttpAgent";

export class RoSGNode extends BrsComponent implements BrsValue, BrsIterable {
    readonly kind = ValueKind.Object;
    protected fields = new Map<string, Field>();
    protected aliases = new Map<string, FieldAlias>();
    protected children: RoSGNode[] = [];
    protected parent: RoSGNode | BrsInvalid = BrsInvalid.Instance;
    protected triedInitFocus: boolean = false;
    protected httpAgent: RoHttpAgent;
    rectLocal: Rect = { x: 0, y: 0, width: 0, height: 0 };
    rectToParent: Rect = { x: 0, y: 0, width: 0, height: 0 };
    rectToScene: Rect = { x: 0, y: 0, width: 0, height: 0 };
    changed: boolean = false;

    readonly defaultFields: FieldModel[] = [
        { name: "id", type: FieldKind.String },
        { name: "focusedChild", type: FieldKind.Node, alwaysNotify: true },
        { name: "focusable", type: FieldKind.Boolean },
        { name: "change", type: FieldKind.AssocArray },
    ];
    m: RoAssociativeArray = new RoAssociativeArray([]);

    constructor(initializedFields: AAMember[], readonly nodeSubtype: string = "Node") {
        super("roSGNode");
        this.setExtendsType();

        // All nodes start have some built-in fields when created.
        this.registerDefaultFields(this.defaultFields);

        // After registering default fields, then register fields instantiated with initial values.
        this.registerInitializedFields(initializedFields);

        this.setFieldValue(
            "change",
            toAssociativeArray({ Index1: 0, Index2: 0, Operation: "none" })
        );

        this.registerMethods({
            ifAssociativeArray: [
                this.clear,
                this.delete,
                this.addReplace,
                this.count,
                this.doesExist,
                this.append,
                this.keys,
                this.items,
                this.lookup,
                this.lookupCI,
            ],
            ifSGNodeField: [
                this.addField,
                this.addFields,
                this.getField,
                this.getFields,
                this.hasField,
                this.observeField,
                this.unobserveField,
                this.observeFieldScoped, // deprecated
                this.observeFieldScopedEx,
                this.unobserveFieldScoped,
                this.removeField,
                this.setField,
                this.setFields,
                this.update,
                this.signalBeacon,
            ],
            ifSGNodeChildren: [
                this.appendChild,
                this.getChildCount,
                this.getChildren,
                this.removeChild,
                this.getParent,
                this.createChild,
                this.replaceChild,
                this.removeChildren,
                this.appendChildren,
                this.getChild,
                this.insertChild,
                this.removeChildrenIndex,
                this.removeChildIndex,
                this.reparent,
                this.createChildren,
                this.replaceChildren,
                this.insertChildren,
                this.getScene,
            ],
            ifSGNodeFocus: [this.hasFocus, this.setFocus, this.isInFocusChain],
            ifSGNodeDict: [
                this.findNode,
                this.isSameNode,
                this.subtype,
                this.callFunc,
                this.isSubtype,
                this.parentSubtype,
                this.clone,
            ],
            ifSGNodeBoundingRect: [
                this.boundingRect,
                this.localBoundingRect,
                this.sceneBoundingRect,
                // TODO: Implement the remaining `ifSGNodeBoundingRect` methods
            ],
            ifSGNodeHttpAgentAccess: [this.getHttpAgent, this.setHttpAgent],
        });
        this.httpAgent = new RoHttpAgent();
        this.registerHttpAgent(this.httpAgent);
    }
    hasNext(): BrsBoolean {
        throw new Error("Method not implemented.");
    }
    getNext(): BrsType {
        throw new Error("Method not implemented.");
    }
    resetNext(): void {
        throw new Error("Method not implemented.");
    }
    updateNext(): void {
        throw new Error("Method not implemented.");
    }

    toString(parent?: BrsType): string {
        const componentName = `${this.getComponentName()}:${this.nodeSubtype}`;

        if (parent) {
            return `<Component: ${componentName}>`;
        }

        return [
            `<Component: ${componentName}> =`,
            "{",
            ...Array.from(this.fields.entries())
                .reverse()
                .map(([key, value]) => `    ${key}: ${value.toString(this)}`),
            "}",
        ].join("\n");
    }

    equalTo(other: BrsType) {
        // SceneGraph nodes are never equal to anything
        return BrsBoolean.False;
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

    getNodeChildren() {
        return this.children;
    }

    get(index: BrsType) {
        if (index.kind !== ValueKind.String) {
            throw new Error("RoSGNode indexes must be strings");
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
        let field = this.fields.get(index.value.toLowerCase());
        if (field) {
            return field.getValue();
        }
        return this.getMethod(index.value) || BrsInvalid.Instance;
    }

    set(index: BrsType, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        if (index.kind !== ValueKind.String) {
            throw new Error("RoSGNode indexes must be strings");
        }

        const mapKey = index.value.toLowerCase();
        const fieldType = kind ?? FieldKind.fromBrsType(value);
        const alias = this.aliases.get(mapKey);
        let field = this.fields.get(mapKey);

        if (!field) {
            // RBI does not create a new field if the value isn't valid.
            if (fieldType && alwaysNotify !== undefined) {
                field = new Field(value, fieldType, alwaysNotify);
                this.fields.set(mapKey, field);
                this.changed = true;
            } else {
                let error = `warning,Warning occurred while setting a field of an RoSGNode\n`;
                error += `-- Tried to set nonexistent field "${index.value}" of a "${this.nodeSubtype}" node`;
                BrsDevice.stderr.write(error);
            }
        } else if (alias) {
            const child = this.findNodeById(this, new BrsString(alias.nodeId));
            if (child instanceof RoSGNode) {
                child.set(new BrsString(alias.fieldName), value, alwaysNotify);
                this.changed = true;
            } else {
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGNode.Set: "${index.value}": Alias "${alias.nodeId}.${alias.fieldName}" not found!`
                );
            }
        } else if (field.canAcceptValue(value)) {
            // Fields are not overwritten if they haven't the same type.
            // Except Numbers and Booleans that can be converted to string fields.
            field.setValue(value);
            this.fields.set(mapKey, field);
            this.changed = true;
        } else {
            BrsDevice.stderr.write(
                `warning,BRIGHTSCRIPT: ERROR: roSGNode.AddReplace: "${index.value}": Type mismatch!`
            );
        }
        return BrsInvalid.Instance;
    }

    getId() {
        const maybeID = this.fields.get("id")?.getValue();
        return maybeID instanceof BrsString ? maybeID.value : this.nodeSubtype;
    }

    addNodeField(fieldName: string, type: string, alwaysNotify: boolean) {
        let defaultValue = getBrsValueFromFieldType(type);
        let fieldKind = FieldKind.fromString(type);

        if (defaultValue !== Uninitialized.Instance && !this.fields.has(fieldName)) {
            this.set(new BrsString(fieldName), defaultValue, alwaysNotify, fieldKind);
        }
    }

    addNodeFieldAlias(fieldName: string, field: Field, childNode: string, childField: string) {
        this.fields.set(fieldName.toLowerCase(), field);
        this.aliases.set(fieldName.toLowerCase(), { nodeId: childNode, fieldName: childField });
    }

    // Used to setup values for the node fields without notifying observers
    setFieldValue(fieldName: string, value: BrsType, alwaysNotify: boolean = false) {
        const mapKey = fieldName.toLowerCase();
        let field = this.fields.get(mapKey);
        if (field) {
            field.setValue(value, false);
        } else {
            const fieldType = FieldKind.fromBrsType(value);
            if (fieldType) {
                field = new Field(value, fieldType, alwaysNotify);
            }
        }
        if (field) {
            this.fields.set(mapKey, field);
            this.changed = true;
        }
    }

    getFieldValue(fieldName: string) {
        const field = this.fields.get(fieldName.toLowerCase());
        return field ? field.getValue() : BrsInvalid.Instance;
    }

    getNodeParent() {
        return this.parent;
    }

    setNodeParent(parent: RoSGNode) {
        this.parent = parent;
    }

    removeParent() {
        this.parent = BrsInvalid.Instance;
    }

    // recursively search for any child that's focused via DFS
    isChildrenFocused(interpreter: Interpreter): boolean {
        if (this.children.length === 0) {
            return false;
        }
        for (let childNode of this.children) {
            if (rootObjects.focused === childNode || childNode.isChildrenFocused(interpreter)) {
                return true;
            }
        }
        return false;
    }

    isFocusable() {
        return jsValueOf(this.getFieldValue("focusable")) as boolean;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, draw2D?: IfDraw2D) {
        this.renderChildren(interpreter, origin, angle, draw2D);
    }

    renderChildren(interpreter: Interpreter, origin: number[], angle: number, draw2D?: IfDraw2D) {
        this.children.forEach((node) => {
            node.renderNode(interpreter, origin, angle, draw2D);
        });
        this.changed = false;
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
            if (funcOrPort instanceof BrsString) {
                callableOrPort = interpreter.getCallableFunction(funcOrPort.value);
            } else if (funcOrPort instanceof RoMessagePort) {
                callableOrPort = funcOrPort;
                funcOrPort.registerCallback(this.getComponentName(), this.getNewEvents.bind(this));
            }
            const subscriber = interpreter.environment.hostNode;
            if (!subscriber) {
                const location = interpreter.formatLocation();
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGNode.ObserveField: "${this.nodeSubtype}.${fieldName.value}" no active host node: ${location}`
                );
            } else if (!(callableOrPort instanceof BrsInvalid)) {
                field.addObserver(
                    scope,
                    interpreter,
                    callableOrPort,
                    subscriber,
                    this,
                    fieldName,
                    infoFields
                );
                result = BrsBoolean.True;
            }
        }
        return result;
    }

    /** Sets or removes the focus to/from the Node */
    setNodeFocus(interpreter: Interpreter, focusOn: boolean): boolean {
        const focusedChildString = new BrsString("focusedchild");
        if (focusOn) {
            if (!this.triedInitFocus) {
                // Only try initial focus once
                this.triedInitFocus = true;
                const typeDef = interpreter.environment.nodeDefMap.get(
                    this.nodeSubtype.toLowerCase()
                );
                if (typeDef?.initialFocus) {
                    const initialFocus = new BrsString(typeDef.initialFocus);
                    const childToFocus = this.findNodeById(this, initialFocus);
                    if (childToFocus instanceof RoSGNode) {
                        childToFocus.setNodeFocus(interpreter, true);
                        return this.isFocusable();
                    }
                }
            } else if (!this.isFocusable() && this.isChildrenFocused(interpreter)) {
                return false;
            }

            rootObjects.focused = this;

            // Get the focus chain, with lowest ancestor first.
            let newFocusChain = this.createPath(this);

            // If there's already a focused node somewhere, we need to remove focus
            // from it and its ancestors.
            if (rootObjects.focused instanceof RoSGNode) {
                // Get the focus chain, with root-most ancestor first.
                let currFocusChain = this.createPath(rootObjects.focused);

                // Find the lowest common ancestor (LCA) between the newly focused node
                // and the current focused node.
                let lcaIndex = 0;
                while (lcaIndex < newFocusChain.length && lcaIndex < currFocusChain.length) {
                    if (currFocusChain[lcaIndex] !== newFocusChain[lcaIndex]) break;
                    lcaIndex++;
                }

                // Unset all of the not-common ancestors of the current focused node.
                for (let i = lcaIndex; i < currFocusChain.length; i++) {
                    currFocusChain[i].set(focusedChildString, BrsInvalid.Instance, false);
                }
            }

            // Set the focusedChild for each ancestor to the next node in the chain,
            // which is the current node's child.
            for (let i = 0; i < newFocusChain.length - 1; i++) {
                newFocusChain[i].set(focusedChildString, newFocusChain[i + 1], false);
            }

            // Finally, set the focusedChild of the newly focused node to itself (to mimic RBI behavior).
            this.set(focusedChildString, this, false);
        } else if (rootObjects.focused === this) {
            // If we're unsetting focus on ourself, we need to unset it on all ancestors as well.
            const currFocusedNode = rootObjects.focused;
            rootObjects.focused = undefined;
            // Get the focus chain, with root-most ancestor first.
            let currFocusChain = this.createPath(currFocusedNode);
            currFocusChain.forEach((node) => {
                node.set(focusedChildString, BrsInvalid.Instance, false);
            });
        } else {
            // If the node doesn't have focus already, and it's not gaining focus,
            // we don't need to notify any ancestors.
            this.set(focusedChildString, BrsInvalid.Instance, false);
        }
        return this.isFocusable();
    }

    /* searches the node tree for a node with the given id */
    findNodeById(node: RoSGNode, id: BrsString): RoSGNode | BrsInvalid {
        // test current node in tree
        let currentId = node.get(new BrsString("id"));
        if (currentId.toString().toLowerCase() === id.value.toLowerCase()) {
            return node;
        }

        // visit each child
        for (let child of node.children) {
            let result = this.findNodeById(child, id);
            if (result instanceof RoSGNode) {
                return result;
            }
        }
        // name was not found anywhere in tree
        return BrsInvalid.Instance;
    }

    /** Load a bitmap based on one of the fields of the node */
    getBitmap(fieldName: string) {
        const uri = jsValueOf(this.getFieldValue(fieldName)) as string;
        return uri?.trim() ? getTextureManager().loadTexture(uri) : undefined;
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
    protected copyField(node: RoSGNode, fieldName: string, thisField?: string) {
        const value = this.getFieldValue(thisField ?? fieldName);
        node.set(new BrsString(fieldName), value);
        return value;
    }

    /** Links a field from another node to this node field */
    protected linkField(node: RoSGNode, fieldName: string, thisField?: string) {
        const field = node.getNodeFields().get(fieldName.toLowerCase());
        if (field) {
            this.fields.set((thisField ?? fieldName).toLowerCase(), field);
        }
        return field;
    }

    /** Message callback to handle observed fields with message port */
    protected getNewEvents() {
        const events: BrsEvent[] = [];
        // To be overridden by the Task class
        return events;
    }

    private registerHttpAgent(agent: RoHttpAgent) {
        this.registerMethods({
            ifHttpAgent: [
                agent.ifHttpAgent.addHeader,
                agent.ifHttpAgent.setHeaders,
                agent.ifHttpAgent.initClientCertificates,
                agent.ifHttpAgent.setCertificatesFile,
                agent.ifHttpAgent.setCertificatesDepth,
                agent.ifHttpAgent.enableCookies,
                agent.ifHttpAgent.getCookies,
                agent.ifHttpAgent.addCookies,
                agent.ifHttpAgent.clearCookies,
            ],
        });
    }

    removeChildByReference(child: BrsType): boolean {
        if (child instanceof RoSGNode) {
            let spliceIndex = this.children.indexOf(child);
            if (spliceIndex >= 0) {
                child.removeParent();
                this.children.splice(spliceIndex, 1);
            }
            return true;
        }
        return false;
    }

    appendChildToParent(child: BrsType): boolean {
        if (child instanceof RoSGNode) {
            if (this.children.includes(child)) {
                return true;
            }
            this.children.push(child);
            child.setNodeParent(this);
            return true;
        }
        return false;
    }

    private replaceChildAtIndex(newChild: BrsType, index: Int32): boolean {
        let childrenSize = this.children.length;
        let indexValue = index.getValue();
        if (newChild instanceof RoSGNode && indexValue < childrenSize) {
            // If newChild is already a child, remove it first.
            this.removeChildByReference(newChild);
            if (indexValue >= 0) {
                // The check is done to see if indexValue is inside the
                // new length of this.children (in case newChild was
                // removed above)
                if (indexValue < this.children.length) {
                    // Remove the parent of the child at indexValue
                    this.children[indexValue].removeParent();
                }
                newChild.setNodeParent(this);
                this.children.splice(indexValue, 1, newChild);
            }
            return true;
        }
        return false;
    }

    private insertChildAtIndex(child: BrsType, index: Int32): boolean {
        if (child instanceof RoSGNode) {
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
     * @param {RoSGNode} node The leaf node to create the tree with
     * @param {boolean} reverse Whether to return the path in reverse order
     * @returns RoSGNode[] The parent chain starting with root-most parent
     */
    protected createPath(node: RoSGNode, reverse: boolean = true): RoSGNode[] {
        let path: RoSGNode[] = [node];

        while (node.parent instanceof RoSGNode) {
            path.push(node.parent);
            node = node.parent;
        }

        return reverse ? path.reverse() : path;
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
        fields.forEach((field) => {
            const value = getBrsValueFromFieldType(field.type, field.value);
            const fieldType = FieldKind.fromString(field.type);
            if (fieldType) {
                this.fields.set(
                    field.name.toLowerCase(),
                    new Field(value, fieldType, !!field.alwaysNotify, field.hidden)
                );
            }
        });
    }

    /**
     * Takes a list of preset fields and creates fields from them.
     * TODO: filter out any non-allowed members. For example, if we instantiate a Node like this:
     *      <Node thisisnotanodefield="fakevalue" />
     * then Roku logs an error, because Node does not have a property called "thisisnotanodefield".
     */
    protected registerInitializedFields(fields: AAMember[]) {
        fields.forEach((field) => {
            let fieldType = FieldKind.fromBrsType(field.value);
            if (fieldType) {
                this.fields.set(
                    field.name.value.toLowerCase(),
                    new Field(field.value, fieldType, false)
                );
            }
        });
    }

    /**
     * Calls the function specified on this node.
     */
    private readonly callFunc = new Callable(
        "callFunc",
        ...Callable.variadic({
            signature: {
                args: [new StdlibArgument("functionName", ValueKind.String)],
                returns: ValueKind.Dynamic,
            },
            impl: (
                interpreter: Interpreter,
                functionName: BrsString,
                ...functionArgs: BrsType[]
            ) => {
                // We need to search the callee's environment for this function rather than the caller's.
                let componentDef = interpreter.environment.nodeDefMap.get(
                    this.nodeSubtype.toLowerCase()
                );

                // Only allow public functions (defined in the interface) to be called.
                if (componentDef && functionName.value in componentDef.functions) {
                    return interpreter.inSubEnv((subInterpreter) => {
                        let functionToCall = subInterpreter.getCallableFunction(functionName.value);
                        if (!(functionToCall instanceof Callable)) {
                            BrsDevice.stderr.write(
                                `Ignoring attempt to call non-implemented function ${functionName}`
                            );
                            return BrsInvalid.Instance;
                        }

                        subInterpreter.environment.setM(this.m);
                        subInterpreter.environment.setRootM(this.m);
                        subInterpreter.environment.hostNode = this;

                        try {
                            // Determine whether the function should get arguments or not.
                            let satisfiedSignature =
                                functionToCall.getFirstSatisfiedSignature(functionArgs);
                            let args = satisfiedSignature ? functionArgs : [];
                            if (!satisfiedSignature) {
                                satisfiedSignature = functionToCall.getFirstSatisfiedSignature([]);
                            }
                            if (satisfiedSignature) {
                                const funcLoc =
                                    functionToCall.getLocation() ?? interpreter.location;
                                interpreter.addToStack({
                                    functionName: functionName.value,
                                    functionLocation: funcLoc,
                                    callLocation: funcLoc,
                                    signature: satisfiedSignature.signature,
                                });
                                try {
                                    const returnValue = functionToCall.call(
                                        subInterpreter,
                                        ...args
                                    );
                                    interpreter.stack.pop();
                                    return returnValue;
                                } catch (err) {
                                    throw err;
                                }
                            } else {
                                return interpreter.addError(
                                    generateArgumentMismatchError(
                                        functionToCall,
                                        functionArgs,
                                        interpreter.stack[interpreter.stack.length - 1]
                                            .functionLocation
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
            },
        })
    );

    /** Removes all fields from the node */
    // ToDo: Built-in fields shouldn't be removed
    private readonly clear = new Callable("clear", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.fields.clear();
            return BrsInvalid.Instance;
        },
    });

    /** Removes a given item from the node */
    // ToDo: Built-in fields shouldn't be removed
    private readonly delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, str: BrsString) => {
            this.fields.delete(str.value.toLowerCase());
            return BrsBoolean.True; //RBI always returns true
        },
    });

    /** Given a key and value, adds an item to the node if it doesn't exist
     * Or replaces the value of a key that already exists in the node
     */
    private readonly addReplace = new Callable("addReplace", {
        signature: {
            args: [
                new StdlibArgument("key", ValueKind.String),
                new StdlibArgument("value", ValueKind.Dynamic),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, key: BrsString, value: BrsType) => {
            this.set(key, value);
            return BrsInvalid.Instance;
        },
    });

    /** Returns the number of items in the node */
    protected count = new Callable("count", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.fields.size);
        },
    });

    /** Returns a boolean indicating whether or not a given key exists in the node */
    private readonly doesExist = new Callable("doesExist", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, str: BrsString) => {
            return this.get(str) !== BrsInvalid.Instance ? BrsBoolean.True : BrsBoolean.False;
        },
    });

    /** Appends a new node to another. If two keys are the same, the value of the original AA is replaced with the new one. */
    private readonly append = new Callable("append", {
        signature: {
            args: [new StdlibArgument("obj", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, obj: BrsType) => {
            if (obj instanceof RoAssociativeArray) {
                obj.elements.forEach((value, key) => {
                    let fieldType = FieldKind.fromBrsType(value);

                    // if the field doesn't have a valid value, RBI doesn't add it.
                    if (fieldType) {
                        this.fields.set(key, new Field(value, fieldType, false));
                    }
                });
            } else if (obj instanceof RoSGNode) {
                obj.getNodeFields().forEach((value, key) => {
                    this.fields.set(key, value);
                });
            }

            return BrsInvalid.Instance;
        },
    });

    /** Returns an array of keys from the node in lexicographical order */
    protected readonly keys = new Callable("keys", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return new RoArray(this.getElements());
        },
    });

    /** Returns an array of key/value pairs in lexicographical order of key. */
    protected readonly items = new Callable("items", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return new RoArray(
                this.getElements().map((key: BrsString) => {
                    return toAssociativeArray({ key: key, value: this.get(key) });
                })
            );
        },
    });

    /** Given a key, returns the value associated with that key. This method is case insensitive. */
    private readonly lookup = new Callable("lookup", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, key: BrsString) => {
            let lKey = key.value.toLowerCase();
            return this.get(new BrsString(lKey));
        },
    });

    /** Given a key, returns the value associated with that key. This method is case insensitive. */
    private readonly lookupCI = new Callable("lookupCI", this.lookup.signatures[0]);

    /** Adds a new field to the node, if the field already exists it doesn't change the current value. */
    private readonly addField = new Callable("addField", {
        signature: {
            args: [
                new StdlibArgument("fieldName", ValueKind.String),
                new StdlibArgument("type", ValueKind.String),
                new StdlibArgument("alwaysNotify", ValueKind.Boolean),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, fieldName: BrsString, type: BrsString, alwaysNotify: BrsBoolean) => {
            this.addNodeField(fieldName.value, type.value, alwaysNotify.toBoolean());
            return BrsBoolean.True;
        },
    });

    /** Adds one or more fields defined as an associative array of key values. */
    private readonly addFields = new Callable("addFields", {
        signature: {
            args: [new StdlibArgument("fields", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, fields: RoAssociativeArray) => {
            if (!(fields instanceof RoAssociativeArray)) {
                return BrsBoolean.False;
            }

            fields.getValue().forEach((value, key) => {
                let fieldName = new BrsString(key);
                if (!this.fields.has(key)) {
                    this.set(fieldName, value, false);
                }
            });

            return BrsBoolean.True;
        },
    });

    /** Returns the value of the field passed as argument, if the field doesn't exist it returns invalid. */
    private readonly getField = new Callable("getField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, fieldName: BrsString) => {
            return this.get(fieldName);
        },
    });

    /** Returns the names and values of all the fields in the node. */
    private readonly getFields = new Callable("getFields", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            let packagedFields: AAMember[] = [];

            this.fields.forEach((field, name) => {
                if (field.isHidden()) {
                    return;
                }

                packagedFields.push({
                    name: new BrsString(name),
                    value: field.getValue(),
                });
            });

            return new RoAssociativeArray(packagedFields);
        },
    });

    /** Returns true if the field exists */
    protected readonly hasField = new Callable("hasField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, fieldName: BrsString) => {
            return this.fields.has(fieldName.value.toLowerCase())
                ? BrsBoolean.True
                : BrsBoolean.False;
        },
    });

    /** Registers a callback to be executed when the value of the field changes */
    private readonly observeField = new Callable(
        "observeField",
        {
            signature: {
                args: [
                    new StdlibArgument("fieldName", ValueKind.String),
                    new StdlibArgument("functionName", ValueKind.String),
                    new StdlibArgument("infoFields", ValueKind.Object, BrsInvalid.Instance),
                ],
                returns: ValueKind.Boolean,
            },
            impl: (
                interpreter: Interpreter,
                fieldName: BrsString,
                funcName: BrsString,
                infoFields: RoArray
            ) => {
                return this.addObserver(interpreter, "unscoped", fieldName, funcName, infoFields);
            },
        },
        {
            signature: {
                args: [
                    new StdlibArgument("fieldName", ValueKind.String),
                    new StdlibArgument("port", ValueKind.Object),
                    new StdlibArgument("infoFields", ValueKind.Object, BrsInvalid.Instance),
                ],
                returns: ValueKind.Boolean,
            },
            impl: (
                interpreter: Interpreter,
                fieldName: BrsString,
                port: RoMessagePort,
                infoFields: RoArray
            ) => {
                return this.addObserver(interpreter, "unscoped", fieldName, port, infoFields);
            },
        }
    );

    /** Removes all observers of a given field, regardless of whether or not the host node is the subscriber. */
    private readonly unobserveField = new Callable("unobserveField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            if (!interpreter.environment.hostNode) {
                let location = interpreter.formatLocation();
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGNode.unObserveField: "${this.nodeSubtype}.${fieldName.value}" no active host node: ${location}`
                );
                return BrsBoolean.False;
            }

            let field = this.fields.get(fieldName.value.toLowerCase());
            if (field instanceof Field) {
                field.removeUnscopedObservers();
            }
            // returns true, even if the field doesn't exist
            return BrsBoolean.True;
        },
    });

    /** Sets up a connection between the observed node's field and the current component from which this call is made. */
    private readonly observeFieldScoped = new Callable(
        "observeFieldScoped",
        {
            signature: {
                args: [
                    new StdlibArgument("fieldName", ValueKind.String),
                    new StdlibArgument("functionName", ValueKind.String),
                    new StdlibArgument("infoFields", ValueKind.Object, BrsInvalid.Instance),
                ],
                returns: ValueKind.Boolean,
            },
            impl: (
                interpreter: Interpreter,
                fieldName: BrsString,
                funcName: BrsString,
                infoFields: RoArray
            ) => {
                return this.addObserver(interpreter, "scoped", fieldName, funcName, infoFields);
            },
        },
        {
            signature: {
                args: [
                    new StdlibArgument("fieldName", ValueKind.String),
                    new StdlibArgument("port", ValueKind.Object),
                    new StdlibArgument("infoFields", ValueKind.Object, BrsInvalid.Instance),
                ],
                returns: ValueKind.Boolean,
            },
            impl: (
                interpreter: Interpreter,
                fieldName: BrsString,
                port: RoMessagePort,
                infoFields: RoArray
            ) => {
                return this.addObserver(interpreter, "scoped", fieldName, port, infoFields);
            },
        }
    );

    /** Sets up a connection between the observed node's field and the current component from which this call is made. */
    private readonly observeFieldScopedEx = new Callable(
        "observeFieldScopedEx",
        {
            signature: {
                args: [
                    new StdlibArgument("fieldName", ValueKind.String),
                    new StdlibArgument("functionName", ValueKind.String),
                    new StdlibArgument("infoFields", ValueKind.Object, BrsInvalid.Instance),
                ],
                returns: ValueKind.Boolean,
            },
            impl: (
                interpreter: Interpreter,
                fieldName: BrsString,
                funcName: BrsString,
                infoFields: RoArray
            ) => {
                return this.addObserver(interpreter, "scoped", fieldName, funcName, infoFields);
            },
        },
        {
            signature: {
                args: [
                    new StdlibArgument("fieldName", ValueKind.String),
                    new StdlibArgument("port", ValueKind.Object),
                    new StdlibArgument("infoFields", ValueKind.Object, BrsInvalid.Instance),
                ],
                returns: ValueKind.Boolean,
            },
            impl: (
                interpreter: Interpreter,
                fieldName: BrsString,
                port: RoMessagePort,
                infoFields: RoArray
            ) => {
                return this.addObserver(interpreter, "scoped", fieldName, port, infoFields);
            },
        }
    );

    /** Removes the connection between the observing component and the observed node's field. */
    private readonly unobserveFieldScoped = new Callable("unobserveFieldScoped", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            if (!interpreter.environment.hostNode) {
                let location = interpreter.formatLocation();
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGNode.unObserveFieldScoped: "${this.nodeSubtype}.${fieldName.value}" no active host node: ${location}`
                );
                return BrsBoolean.False;
            }

            let field = this.fields.get(fieldName.value.toLowerCase());
            if (field instanceof Field) {
                field.removeScopedObservers(interpreter.environment.hostNode);
            }
            // returns true, even if the field doesn't exist
            return BrsBoolean.True;
        },
    });

    /** Removes the given field from the node */
    /** TODO: node built-in fields shouldn't be removable (i.e. id, change, focusable,) */
    private readonly removeField = new Callable("removeField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, fieldName: BrsString) => {
            this.fields.delete(fieldName.value.toLowerCase());
            return BrsBoolean.True; //RBI always returns true
        },
    });

    /** Updates the value of an existing field only if the types match. */
    private readonly setField = new Callable("setField", {
        signature: {
            args: [
                new StdlibArgument("fieldName", ValueKind.String),
                new StdlibArgument("value", ValueKind.Dynamic),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, fieldName: BrsString, value: BrsType) => {
            let field = this.fields.get(fieldName.value.toLowerCase());
            if (!field) {
                return BrsBoolean.False;
            }

            if (!field.canAcceptValue(value)) {
                return BrsBoolean.False;
            }

            this.set(fieldName, value);
            return BrsBoolean.True;
        },
    });

    /** Updates the value of multiple existing field only if the types match. */
    private readonly setFields = new Callable("setFields", {
        signature: {
            args: [new StdlibArgument("fields", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, fields: RoAssociativeArray) => {
            if (!(fields instanceof RoAssociativeArray)) {
                return BrsBoolean.False;
            }

            fields.getValue().forEach((value, key) => {
                let fieldName = new BrsString(key.toLowerCase());
                if (this.fields.has(key.toLowerCase())) {
                    this.set(fieldName, value, false);
                }
            });

            return BrsBoolean.True;
        },
    });

    /* Updates the value of multiple existing field only if the types match.
    In contrast to setFields method, update always return Uninitialized */
    private readonly update = new Callable("update", {
        signature: {
            args: [
                new StdlibArgument("aa", ValueKind.Object),
                new StdlibArgument("createFields", ValueKind.Boolean, BrsBoolean.False),
            ],
            returns: ValueKind.Uninitialized,
        },
        impl: (_: Interpreter, aa: RoAssociativeArray, createFields: BrsBoolean) => {
            if (!(aa instanceof RoAssociativeArray)) {
                return Uninitialized.Instance;
            }

            aa.getValue().forEach((value, key) => {
                let fieldName = new BrsString(key);
                if (this.fields.has(key.toLowerCase()) || createFields.toBoolean()) {
                    this.set(fieldName, value, false);
                }
            });

            return Uninitialized.Instance;
        },
    });

    /** Signals start and/or stop points for measuring app launch and Electronic Program Grid (EPG) launch times. */
    private readonly signalBeacon = new Callable("signalBeacon", {
        signature: {
            args: [new StdlibArgument("beacon", ValueKind.String)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, beacon: BrsString) => {
            const validBeacons = [
                "AppLaunchComplete",
                "AppDialogInitiate",
                "AppDialogComplete",
                "EPGLaunchInitiate",
                "EPGLaunchComplete",
            ];
            return new Int32(validBeacons.includes(beacon.value) ? 0 : 2);
        },
    });

    /* Return the current number of children in the subject node list of children.
    This is always a non-negative number. */
    private readonly getChildCount = new Callable("getChildCount", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.children.length);
        },
    });

    /* Adds a child node to the end of the subject node list of children so that it is
    traversed last (of those children) during render. */
    private readonly appendChild = new Callable("appendChild", {
        signature: {
            args: [new StdlibArgument("child", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, child: BrsType) => {
            return BrsBoolean.from(this.appendChildToParent(child));
        },
    });

    /* Retrieves the number of child nodes specified by num_children from the subject
    node, starting at the position specified by index. Returns an array of the child nodes
    retrieved. If num_children is -1, return all the children. */
    private readonly getChildren = new Callable("getChildren", {
        signature: {
            args: [
                new StdlibArgument("num_children", ValueKind.Int32),
                new StdlibArgument("index", ValueKind.Int32),
            ],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, num_children: Int32, index: Int32) => {
            let numChildrenValue = num_children.getValue();
            let indexValue = index.getValue();
            let childrenSize = this.children.length;
            if (numChildrenValue <= -1 && indexValue === 0) {
                //short hand to return all children
                return new RoArray(this.children.slice());
            } else if (numChildrenValue <= 0 || indexValue < 0 || indexValue >= childrenSize) {
                //these never return any children
                return new RoArray([]);
            } else {
                //only valid cases
                return new RoArray(this.children.slice(indexValue, indexValue + numChildrenValue));
            }

            return new RoArray([]);
        },
    });

    /* Finds a child node in the subject node list of children, and if found,
    remove it from the list of children. The match is made on the basis of actual
    object identity, that is, the value of the pointer to the child node.
    return false if trying to remove anything that's not a node */
    private readonly removeChild = new Callable("removeChild", {
        signature: {
            args: [new StdlibArgument("child", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, child: BrsType) => {
            return BrsBoolean.from(this.removeChildByReference(child));
        },
    });
    /* If the subject node has been added to a parent node list of children,
    return the parent node, otherwise return invalid.*/
    private readonly getParent = new Callable("getParent", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.parent;
        },
    });

    /* Creates a child node of type nodeType, and adds the new node to the end of the
    subject node list of children */
    private readonly createChild = new Callable("createChild", {
        signature: {
            args: [new StdlibArgument("nodeType", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, nodeType: BrsString) => {
            let child = createNodeByType(interpreter, nodeType);
            if (child instanceof RoSGNode) {
                this.children.push(child);
                child.setNodeParent(this);
            }
            return child;
        },
    });

    /**
     * If the subject node has a child node in the index position, replace that child
     * node with the newChild node in the subject node list of children, otherwise do nothing.
     */

    private readonly replaceChild = new Callable("replaceChild", {
        signature: {
            args: [
                new StdlibArgument("newChild", ValueKind.Dynamic),
                new StdlibArgument("index", ValueKind.Int32),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, newChild: BrsType, index: Int32) => {
            return BrsBoolean.from(this.replaceChildAtIndex(newChild, index));
        },
    });

    /**
     * Removes the child nodes specified by child_nodes from the subject node. Returns
     * true if the child nodes were successfully removed.
     */
    private readonly removeChildren = new Callable("removeChildren", {
        signature: {
            args: [new StdlibArgument("child_nodes", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, child_nodes: BrsType) => {
            if (child_nodes instanceof RoArray) {
                let childNodesElements = child_nodes.getElements();
                if (childNodesElements.length !== 0) {
                    childNodesElements.forEach((childNode) => {
                        this.removeChildByReference(childNode);
                    });
                    return BrsBoolean.True;
                }
            }
            return BrsBoolean.False;
        },
    });

    /**
     * Removes the number of child nodes specified by num_children from the subject node
     * starting at the position specified by index.
     */
    private readonly removeChildrenIndex = new Callable("removeChildrenIndex", {
        signature: {
            args: [
                new StdlibArgument("num_children", ValueKind.Int32),
                new StdlibArgument("index", ValueKind.Int32),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, num_children: Int32, index: Int32) => {
            let numChildrenValue = num_children.getValue();
            let indexValue = index.getValue();

            if (numChildrenValue > 0) {
                let removedChildren = this.children.splice(indexValue, numChildrenValue);
                removedChildren.forEach((node) => {
                    node.removeParent();
                });
                return BrsBoolean.True;
            }
            return BrsBoolean.False;
        },
    });

    /**
     * If the subject node has a child node at the index position, return it, otherwise
     * return invalid.
     */
    private readonly getChild = new Callable("getChild", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, index: Int32) => {
            let indexValue = index.getValue();
            let childrenSize = this.children.length;

            if (indexValue >= 0 && indexValue < childrenSize) {
                return this.children[indexValue];
            }
            return BrsInvalid.Instance;
        },
    });

    /**
     * Appends the nodes specified by child_nodes to the subject node.
     */
    private readonly appendChildren = new Callable("appendChildren", {
        signature: {
            args: [new StdlibArgument("child_nodes", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, child_nodes: BrsType) => {
            if (child_nodes instanceof RoArray) {
                let childNodesElements = child_nodes.getElements();
                if (childNodesElements.length !== 0) {
                    childNodesElements.forEach((childNode) => {
                        if (childNode instanceof RoSGNode) {
                            // Remove if it exists to re-append
                            this.removeChildByReference(childNode);
                            this.appendChildToParent(childNode);
                        }
                    });
                    return BrsBoolean.True;
                }
            }
            return BrsBoolean.False;
        },
    });

    /** Creates the number of children specified by num_children for the subject node,
     *  of the type or extended type specified by subtype.
     */
    private readonly createChildren = new Callable("createChildren", {
        signature: {
            args: [
                new StdlibArgument("num_children", ValueKind.Int32),
                new StdlibArgument("subtype", ValueKind.String),
            ],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, num_children: Int32, subtype: BrsString) => {
            let numChildrenValue = num_children.getValue();
            let addedChildren: RoSGNode[] = [];
            for (let i = 0; i < numChildrenValue; i++) {
                let child = createNodeByType(interpreter, subtype);
                if (child instanceof RoSGNode) {
                    this.children.push(child);
                    addedChildren.push(child);
                    child.setNodeParent(this);
                }
            }
            return new RoArray(addedChildren);
        },
    });

    /** Replaces the child nodes in the subject node, starting at the position specified
     *  by index, with new child nodes specified by child_nodes.
     */
    private readonly replaceChildren = new Callable("replaceChildren", {
        signature: {
            args: [
                new StdlibArgument("child_nodes", ValueKind.Dynamic),
                new StdlibArgument("index", ValueKind.Int32),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, child_nodes: BrsType, index: Int32) => {
            if (child_nodes instanceof RoArray) {
                let indexValue = index.getValue();
                let childNodesElements = child_nodes.getElements();
                if (childNodesElements.length !== 0) {
                    childNodesElements.forEach((childNode) => {
                        if (!this.replaceChildAtIndex(childNode, new Int32(indexValue))) {
                            this.removeChildByReference(childNode);
                        }
                        indexValue += 1;
                    });
                    return BrsBoolean.True;
                }
            }
            return BrsBoolean.False;
        },
    });

    /**
     * Inserts the child nodes specified by child_nodes to the subject node starting
     * at the position specified by index.
     */
    private readonly insertChildren = new Callable("insertChildren", {
        signature: {
            args: [
                new StdlibArgument("child_nodes", ValueKind.Dynamic),
                new StdlibArgument("index", ValueKind.Int32),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, child_nodes: BrsType, index: Int32) => {
            if (child_nodes instanceof RoArray) {
                let indexValue = index.getValue();
                let childNodesElements = child_nodes.getElements();
                if (childNodesElements.length !== 0) {
                    childNodesElements.forEach((childNode) => {
                        this.insertChildAtIndex(childNode, new Int32(indexValue));
                        indexValue += 1;
                    });
                    return BrsBoolean.True;
                }
            }
            return BrsBoolean.False;
        },
    });

    /**
     * Inserts a previously-created child node at the position index in the subject
     * node list of children, so that this is the position that the new child node
     * is traversed during render.
     */
    private readonly insertChild = new Callable("insertChild", {
        signature: {
            args: [
                new StdlibArgument("child", ValueKind.Dynamic),
                new StdlibArgument("index", ValueKind.Int32),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, child: BrsType, index: Int32) => {
            return BrsBoolean.from(this.insertChildAtIndex(child, index));
        },
    });

    /**
     * If the subject node has a child node in the index position, remove that child
     * node from the subject node list of children.
     */
    private readonly removeChildIndex = new Callable("removeChildIndex", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, index: Int32) => {
            let indexValue = index.getValue();
            let childrenSize = this.children.length;

            if (indexValue < childrenSize) {
                if (indexValue >= 0) {
                    this.removeChildByReference(this.children[indexValue]);
                }
                return BrsBoolean.True;
            }
            return BrsBoolean.False;
        },
    });

    /**
     * Moves the subject node to another node.
     * If adjustTransform is true, the subject node transformation factor fields (translation/rotation/scale)
     * are adjusted so that the node has the same transformation factors relative to the screen as it previously did.
     * If adjustTransform is false, the subject node is simply parented to the new node without adjusting its
     * transformation factor fields, in which case, the re-parenting operation could cause the node to jump to a
     * new position on the screen.
     */
    private readonly reparent = new Callable("reparent", {
        signature: {
            args: [
                new StdlibArgument("newParent", ValueKind.Dynamic),
                new StdlibArgument("adjustTransform", ValueKind.Boolean),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, newParent: BrsType, adjustTransform: BrsBoolean) => {
            if (newParent instanceof RoSGNode && newParent !== this) {
                // TODO: adjustTransform has to be implemented probably by traversing the
                // entire parent tree to get to the top, calculate the absolute transform
                // parameters and then use that to adjust the new transform properties.
                // Until that is implemented, the parameter does nothing.

                // Remove parents child reference
                if (this.parent instanceof RoSGNode) {
                    this.parent.removeChildByReference(this);
                }
                newParent.appendChildToParent(this);
                return BrsBoolean.True;
            }
            return BrsBoolean.False;
        },
    });

    /* Returns the Node bounding rectangle */
    private readonly boundingRect = new Callable("boundingRect", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            const root = this.createPath(this)[0];
            root.renderNode(interpreter, [0, 0], 0);
            return toAssociativeArray(this.rectToParent);
        },
    });

    /* Returns the Node local bounding rectangle */
    private readonly localBoundingRect = new Callable("localBoundingRect", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            const root = this.createPath(this)[0];
            root.renderNode(interpreter, [0, 0], 0);
            return toAssociativeArray(this.rectLocal);
        },
    });

    /* Returns the bounding rectangle for scene components. */
    private readonly sceneBoundingRect = new Callable("sceneBoundingRect", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            const root = this.createPath(this)[0];
            root.renderNode(interpreter, [0, 0], 0);
            return toAssociativeArray(this.rectToScene);
        },
    });

    /* Returns true if the subject node has the remote control focus, and false otherwise */
    private readonly hasFocus = new Callable("hasFocus", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(rootObjects.focused === this);
        },
    });

    /**
     *  If on is set to true, sets the current remote control focus to the subject node,
     *  also automatically removing it from the node on which it was previously set.
     *  If on is set to false, removes focus from the subject node if it had it.
     *
     *  It also runs through all of the ancestors of the node that was focused prior to this call,
     *  and the newly focused node, and sets the `focusedChild` field of each to reflect the new state.
     */
    private readonly setFocus = new Callable("setFocus", {
        signature: {
            args: [new StdlibArgument("on", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, on: BrsBoolean) => {
            return BrsBoolean.from(this.setNodeFocus(interpreter, on.toBoolean()));
        },
    });

    /**
     *  Returns true if the subject node or any of its descendants in the SceneGraph node tree
     *  has remote control focus
     */
    private readonly isInFocusChain = new Callable("isInFocusChain", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter) => {
            // loop through all children DFS and check if any children has focus
            if (rootObjects.focused === this) {
                return BrsBoolean.True;
            }

            return BrsBoolean.from(this.isChildrenFocused(interpreter));
        },
    });

    /* Returns the node that is a descendant of the nearest component ancestor of the subject node whose id field matches the given name,
        otherwise return invalid.
        Implemented as a DFS from the top of parent hierarchy to match the observed behavior as opposed to the BFS mentioned in the docs. */
    private readonly findNode = new Callable("findNode", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, name: BrsString) => {
            // Roku's implementation returns invalid on empty string
            if (name.value.length === 0) return BrsInvalid.Instance;

            // climb parent hierarchy to find node to start search at
            let root: RoSGNode = this;
            while (root.parent && root.parent instanceof RoSGNode) {
                root = root.parent;
            }

            // perform search
            return this.findNodeById(root, name);
        },
    });

    /* Checks whether the subtype of the subject node is a descendant of the subtype nodeType
     * in the SceneGraph node class hierarchy.
     *
     *
     */
    private readonly isSubtype = new Callable("isSubtype", {
        signature: {
            args: [new StdlibArgument("nodeType", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, nodeType: BrsString) => {
            return BrsBoolean.from(isSubtypeCheck(this.nodeSubtype, nodeType.value));
        },
    });

    /* Checks whether the subtype of the subject node is a descendant of the subtype nodeType
     * in the SceneGraph node class hierarchy.
     */
    private readonly parentSubtype = new Callable("parentSubtype", {
        signature: {
            args: [new StdlibArgument("nodeType", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, nodeType: BrsString) => {
            const parentType = subtypeHierarchy.get(nodeType.value.toLowerCase());
            if (parentType) {
                return new BrsString(parentType);
            }
            return BrsInvalid.Instance;
        },
    });

    /* Returns a Boolean value indicating whether the roSGNode parameter
            refers to the same node object as this node */
    private readonly isSameNode = new Callable("isSameNode", {
        signature: {
            args: [new StdlibArgument("roSGNode", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, roSGNode: RoSGNode) => {
            return BrsBoolean.from(this === roSGNode);
        },
    });

    /* Returns the subtype of this node as specified when it was created */
    private readonly subtype = new Callable("subtype", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.nodeSubtype);
        },
    });

    /* Returns a copy of the entire node tree or just a shallow copy. */
    private readonly clone = new Callable("clone", {
        signature: {
            args: [new StdlibArgument("isDeepCopy", ValueKind.Boolean)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, isDeepCopy: BrsBoolean) => {
            const clonedNode = createNodeByType(interpreter, new BrsString(this.nodeSubtype));
            if (!(clonedNode instanceof RoSGNode)) {
                return BrsInvalid.Instance;
            }
            // Clone fields
            this.fields.forEach((field, key) => {
                const clonedField = new Field(
                    field.getValue(false),
                    field.getType(),
                    field.isAlwaysNotify(),
                    field.isHidden()
                );
                clonedNode.fields.set(key, clonedField);
            });
            // Clone children if deep copy
            if (isDeepCopy.toBoolean()) {
                this.children.forEach((child) => {
                    const clonedChild = child.clone.call(interpreter, isDeepCopy);
                    if (clonedChild instanceof RoSGNode) {
                        clonedNode.children.push(clonedChild);
                        clonedChild.setNodeParent(clonedNode);
                    }
                });
            }
            return clonedNode;
        },
    });

    /* Returns the node's root Scene. This returns a valid Scene even if the node is not parented. */
    private readonly getScene = new Callable("getScene", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return rootObjects.rootScene || BrsInvalid.Instance;
        },
    });

    /* Returns the roHttpAgent object for the node. */
    private readonly getHttpAgent = new Callable("getHttpAgent", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.httpAgent;
        },
    });

    /** Sets an roHttpAgent object for the node. */
    private readonly setHttpAgent = new Callable("setHttpAgent", {
        signature: {
            args: [new StdlibArgument("httpAgent", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, httpAgent: RoHttpAgent) => {
            if (httpAgent instanceof RoHttpAgent) {
                this.httpAgent = httpAgent;
                this.registerHttpAgent(httpAgent);
                return BrsBoolean.True;
            }
            return BrsBoolean.False;
        },
    });
}

/**
 * An object that holds the Node that represents the m.global, the root Scene,
 * the currently focused node and the arrays of tasks and timers.
 * */
interface RootObjects {
    mGlobal: RoSGNode;
    rootScene?: Scene;
    focused?: RoSGNode;
    tasks: Task[];
    timers: Timer[];
}
export const rootObjects: RootObjects = { mGlobal: new RoSGNode([]), tasks: [], timers: [] };
