import {
    AAMember,
    BrsBoolean,
    BrsInvalid,
    BrsString,
    BrsType,
    BrsValue,
    Int32,
    isBrsString,
    ISGNode,
    RoArray,
    RoAssociativeArray,
    RoHttpAgent,
    RoMessagePort,
    Uninitialized,
    ValueKind,
    BrsComponent,
    Callable,
    StdlibArgument,
    Interpreter,
    BrsDevice,
    Rect,
} from "brs-engine";
import { sgRoot } from "../SGRoot";
import { createNodeByType, isSubtypeCheck, subtypeHierarchy } from "../factory/SGNodeFactory";
import { toAssociativeArray } from "../factory/serialization";
import { FieldKind, isContentNode } from "../SGTypes";

export abstract class RoSGNode extends BrsComponent implements BrsValue, ISGNode {
    readonly kind = ValueKind.Object;
    protected httpAgent: RoHttpAgent;
    m: RoAssociativeArray = new RoAssociativeArray([]);
    location: string = "";

    constructor(_: AAMember[], readonly nodeSubtype: string = "Node") {
        super("roSGNode");

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
                this.getFieldType,
                this.getFieldTypes,
                this.hasField,
                this.observeField,
                this.unobserveField,
                this.observeFieldScoped, // deprecated
                this.observeFieldScopedEx,
                this.unobserveFieldScoped,
                this.removeField,
                this.removeFields,
                this.setField,
                this.setFields,
                this.update,
                this.signalBeacon,
                this.threadInfo,
                this.queueFields,
                this.moveIntoField, // Since OS 15
                this.moveFromField, // Since OS 15
                this.setRef, // Since OS 15
                this.canGetRef, // Since OS 15
                this.getRef, // Since OS 15
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

    // BrsValue interface methods
    equalTo(_: BrsType) {
        // SceneGraph nodes are never equal to anything
        return BrsBoolean.False;
    }
    abstract toString(parent?: BrsType): string;

    abstract get(index: BrsType): BrsType;
    set(index: BrsType, value: BrsType, _isCaseSensitive?: boolean): BrsInvalid {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        // delegates to setValue
        this.setValue(index.getValue(), value);
        return BrsInvalid.Instance;
    }
    abstract deepCopy(): BrsType;

    // Abstract methods to be implemented by subclasses
    abstract getElements(): BrsString[];
    abstract getValue(fieldName: string): BrsType;
    abstract getValues(): BrsType[];
    abstract setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind): void;
    abstract setValueSilent(fieldName: string, value: BrsType, alwaysNotify?: boolean): void;
    abstract addNodeField(fieldName: string, type: string, alwaysNotify: boolean): void;

    abstract getNodeChildren(): BrsType[];
    abstract getNodeParent(): RoSGNode | BrsInvalid;
    abstract findNodeById(node: RoSGNode, id: string): RoSGNode | BrsInvalid;
    abstract appendChildToParent(child: BrsType): boolean;
    abstract addObserver(
        interpreter: Interpreter,
        scope: "permanent" | "scoped" | "unscoped",
        fieldName: BrsString,
        funcOrPort: BrsString | RoMessagePort,
        infoFields?: RoArray
    ): BrsBoolean;
    protected abstract removeObserver(fieldName: string, node?: RoSGNode): void;
    protected abstract cloneNode(isDeepCopy: boolean, interpreter?: Interpreter): BrsType;
    protected abstract callFunction(interpreter: Interpreter, funcName: BrsString, ...funcArgs: BrsType[]): BrsType;
    protected abstract setNodeFocus(interpreter: Interpreter, focusOn: boolean): boolean;

    protected abstract moveObjectIntoField(fieldName: string, data: RoAssociativeArray): { code: number; msg?: string };
    protected abstract moveObjectFromField(fieldName: string): BrsType | string;
    protected abstract setFieldByRef(fieldName: string, data: RoAssociativeArray): number;
    protected abstract canGetFieldByRef(fieldName: string): boolean;
    protected abstract getFieldByRef(fieldName: string): RoAssociativeArray | string;
    protected abstract updateFields(interpreter: Interpreter, content: BrsType, createFields: boolean): void;
    protected abstract appendNodeFields(fieldsToAppend: BrsType): void;
    protected abstract setNodeFields(fieldsToAppend: BrsType, replace?: boolean): void;
    protected abstract removeFieldEntry(fieldName: string): boolean;
    protected abstract getNodeFieldsAsAA(): RoAssociativeArray;
    protected abstract getNodeFieldTypes(): RoAssociativeArray;
    protected abstract hasNodeField(fieldName: string): boolean;
    protected abstract canAcceptValue(fieldName: string, value: BrsType): boolean;
    protected abstract clearNodeFields(): void;

    protected abstract removeChildByReference(child: BrsType): boolean;
    protected abstract removeChildrenAtIndex(index: number, count: number): boolean;
    protected abstract replaceChildAtIndex(newChild: RoSGNode, index: number): boolean;
    protected abstract insertChildAtIndex(child: BrsType, index: number): boolean;
    protected abstract isChildrenFocused(): boolean;
    protected abstract findRootNode(from?: RoSGNode): RoSGNode;

    protected abstract getBoundingRect(interpreter: Interpreter, type: string): Rect;
    protected abstract compareNodes(other: RoSGNode): boolean;
    protected abstract getThreadInfo(): RoAssociativeArray;

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
            impl: (interpreter: Interpreter, functionName: BrsString, ...functionArgs: BrsType[]) => {
                return this.callFunction(interpreter, functionName, ...functionArgs);
            },
        })
    );

    /** Removes all fields from the node */
    private readonly clear = new Callable("clear", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.clearNodeFields();
            return Uninitialized.Instance;
        },
    });

    /** Removes a given item from the node */
    private readonly delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, str: BrsString) => {
            this.removeFieldEntry(str.getValue());
            return BrsBoolean.True; //RBI always returns true
        },
    });

    /** Given a key and value, adds an item to the node if it doesn't exist
     * Or replaces the value of a key that already exists in the node
     */
    private readonly addReplace = new Callable("addReplace", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String), new StdlibArgument("value", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, key: BrsString, value: BrsType) => {
            this.location = interpreter.formatLocation();
            this.setValue(key.value, value);
            return Uninitialized.Instance;
        },
    });

    /** Returns the number of items in the node */
    protected readonly count = new Callable("count", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.getElements().length);
        },
    });

    /** Returns a boolean indicating whether or not a given key exists in the node */
    private readonly doesExist = new Callable("doesExist", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, str: BrsString) => {
            return BrsBoolean.from(this.getElements().some((key) => key.value === str.value.toLowerCase()));
        },
    });

    /** Appends a new node to another. If two keys are the same, the value of the original AA is replaced with the new one. */
    private readonly append = new Callable("append", {
        signature: {
            args: [new StdlibArgument("obj", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, obj: BrsType) => {
            this.appendNodeFields(obj);
            return Uninitialized.Instance;
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
            return this.get(key);
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
        impl: (interpreter: Interpreter, fieldName: BrsString, type: BrsString, alwaysNotify: BrsBoolean) => {
            this.location = interpreter.formatLocation();
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
        impl: (interpreter: Interpreter, fields: RoAssociativeArray) => {
            if (!(fields instanceof RoAssociativeArray)) {
                return BrsBoolean.False;
            }
            this.location = interpreter.formatLocation();
            this.setNodeFields(fields, true);
            return BrsBoolean.True;
        },
    });

    /** Returns an object containing thread information for debugging purposes. */
    private readonly threadInfo = new Callable("threadInfo", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.getThreadInfo();
        },
    });

    /** Makes subsequent operations on the node fields to queue on the node itself rather than on the Scene node render thread. */
    private readonly queueFields = new Callable("queueFields", {
        signature: {
            args: [new StdlibArgument("queueNode", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, _queueNode: BrsBoolean) => {
            // Not implemented yet. Mocking to prevent crash on usage.
            return Uninitialized.Instance;
        },
    });

    /** Moves an object into an roSGNode field, which must be an associative array. */
    private readonly moveIntoField = new Callable("moveIntoField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String), new StdlibArgument("data", ValueKind.Object)],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString, data: RoAssociativeArray) => {
            let result: { code: number; msg?: string };
            if (data instanceof RoAssociativeArray) {
                result = this.moveObjectIntoField(fieldName.value, data);
            } else {
                result = { code: -1, msg: "Move data must be AA" };
            }
            if (result.code < 0) {
                const location = interpreter.formatLocation();
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGNode.moveIntoField: ${result.msg}: ${location}`
                );
            }
            return new Int32(result.code);
        },
    });

    /** Moves an object out of an roSGNode field (an associative array). */
    private readonly moveFromField = new Callable("moveFromField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            const result = this.moveObjectFromField(fieldName.value);
            if (typeof result === "string") {
                const location = interpreter.formatLocation();
                BrsDevice.stderr.write(`warning,BRIGHTSCRIPT: ERROR: roSGNode.moveFromField: ${result}: ${location}`);
                return BrsInvalid.Instance;
            }
            return result;
        },
    });

    /** Assigns an associative array to the field of a roSGNode via reference. */
    private readonly setRef = new Callable("setRef", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String), new StdlibArgument("data", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString, data: RoAssociativeArray) => {
            if (sgRoot.inTaskThread() || !(data instanceof RoAssociativeArray)) {
                return BrsBoolean.False;
            }
            const result = this.setFieldByRef(fieldName.value, data);
            if (result < 0) {
                const location = interpreter.formatLocation();
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGNode.setRef: Could not find field '"${fieldName.value}"': ${location}`
                );
            }
            return BrsBoolean.from(result > 0);
        },
    });

    /** Indicates whether the GetRef() function will succeed in the current context. */
    private readonly canGetRef = new Callable("canGetRef", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, fieldName: BrsString) => {
            return BrsBoolean.from(this.canGetFieldByRef(fieldName.value));
        },
    });

    /** Returns a reference to the value of an roSGNode field, which must be an associative array and be set by SetRef() */
    private readonly getRef = new Callable("getRef", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            const result = this.getFieldByRef(fieldName.value);
            if (typeof result === "string" && result.length > 0) {
                const location = interpreter.formatLocation();
                BrsDevice.stderr.write(`warning,BRIGHTSCRIPT: ERROR: roSGNode.getRef: ${result}: ${location}`);
            } else if (result instanceof RoAssociativeArray) {
                return result;
            }
            return BrsInvalid.Instance;
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
            return this.getNodeFieldsAsAA();
        },
    });

    /** Returns the type of a specific field of the subject node. */
    private readonly getFieldType = new Callable("getFieldType", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, fieldName: BrsString) => {
            const types = this.getNodeFieldTypes();
            const fieldType = types.get(fieldName);
            return fieldType instanceof BrsString ? fieldType : new BrsString("<NoSuchField>");
        },
    });

    /** Returns the names and types of all the fields in the node. */
    private readonly getFieldTypes = new Callable("getFieldTypes", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.getNodeFieldTypes();
        },
    });

    /** Returns true if the field exists */
    protected readonly hasField = new Callable("hasField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, fieldName: BrsString) => {
            return BrsBoolean.from(this.hasNodeField(fieldName.value));
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
            impl: (interpreter: Interpreter, fieldName: BrsString, funcName: BrsString, infoFields: RoArray) => {
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
            impl: (interpreter: Interpreter, fieldName: BrsString, port: RoMessagePort, infoFields: RoArray) => {
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
                const location = interpreter.formatLocation();
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGNode.unObserveField: "${this.nodeSubtype}.${fieldName.value}" no active host node: ${location}`
                );
                return BrsBoolean.False;
            }
            this.removeObserver(fieldName.value);
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
            impl: (interpreter: Interpreter, fieldName: BrsString, funcName: BrsString, infoFields: RoArray) => {
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
            impl: (interpreter: Interpreter, fieldName: BrsString, port: RoMessagePort, infoFields: RoArray) => {
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
            impl: (interpreter: Interpreter, fieldName: BrsString, funcName: BrsString, infoFields: RoArray) => {
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
            impl: (interpreter: Interpreter, fieldName: BrsString, port: RoMessagePort, infoFields: RoArray) => {
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
            this.removeObserver(fieldName.value, interpreter.environment.hostNode as RoSGNode);
            // returns true, even if the field doesn't exist
            return BrsBoolean.True;
        },
    });

    /** Removes the given field from the node */
    private readonly removeField = new Callable("removeField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, fieldName: BrsString) => {
            this.removeFieldEntry(fieldName.getValue());
            return BrsBoolean.True; //RBI always returns true
        },
    });

    /** Removes one or more fields from the node */
    private readonly removeFields = new Callable("removeFields", {
        signature: {
            args: [new StdlibArgument("fieldNames", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, fieldNames: RoArray) => {
            if (!(fieldNames instanceof RoArray)) {
                return BrsBoolean.False;
            }
            const elements = fieldNames.getElements();
            if (elements.length === 0) {
                return BrsBoolean.False;
            }
            let removedAny = false;
            for (const fieldName of elements) {
                if (!isBrsString(fieldName)) {
                    continue;
                }
                removedAny ||= this.removeFieldEntry(fieldName.getValue());
            }
            return BrsBoolean.from(removedAny);
        },
    });

    /** Updates the value of an existing field only if the field exists and types match. */
    private readonly setField = new Callable("setField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String), new StdlibArgument("value", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString, value: BrsType) => {
            this.location = interpreter.formatLocation();
            if (
                !isContentNode(this) &&
                !this.getElements().some((key) => key.value.toLowerCase() === fieldName.value.toLowerCase())
            ) {
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGNode.setField: Tried to set nonexistent field "${fieldName.value}": ${this.location}`
                );
                return BrsBoolean.False;
            } else if (!this.canAcceptValue(fieldName.value, value)) {
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGNode.setField: Type mismatch: ${this.location}`
                );
                // Roku always returns true if the field exists
                return BrsBoolean.True;
            }
            this.setValue(fieldName.value, value);
            return BrsBoolean.True;
        },
    });

    /** Updates the value of multiple existing field only if the field exists and types match. */
    private readonly setFields = new Callable("setFields", {
        signature: {
            args: [new StdlibArgument("fields", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fields: RoAssociativeArray) => {
            if (!(fields instanceof RoAssociativeArray)) {
                return BrsBoolean.False;
            }
            this.location = interpreter.formatLocation();
            this.setNodeFields(fields, false);
            return BrsBoolean.True;
        },
    });

    /* Updates the value of multiple existing field only if the types match.
    In contrast to setFields method, update always return Uninitialized */
    private readonly update = new Callable("update", {
        signature: {
            args: [
                new StdlibArgument("content", ValueKind.Object),
                new StdlibArgument("createFields", ValueKind.Boolean, BrsBoolean.False),
            ],
            returns: ValueKind.Uninitialized,
        },
        impl: (interpreter: Interpreter, content: RoAssociativeArray | RoArray, createFields: BrsBoolean) => {
            this.location = interpreter.formatLocation();
            this.updateFields(interpreter, content, createFields.toBoolean());
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
            return new Int32(this.getNodeChildren().length);
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
            args: [new StdlibArgument("num_children", ValueKind.Int32), new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, num_children: Int32, index: Int32) => {
            const numChildrenValue = num_children.getValue();
            const indexValue = index.getValue();
            const children = this.getNodeChildren();
            let returnedChildren: RoArray;
            if (numChildrenValue <= -1 && indexValue === 0) {
                //short hand to return all children
                returnedChildren = new RoArray(
                    children.slice().map((child) => {
                        return child instanceof BrsInvalid ? child.box() : child;
                    })
                );
            } else if (numChildrenValue <= 0 || indexValue < 0 || indexValue >= children.length) {
                //these never return any children
                returnedChildren = new RoArray([]);
            } else {
                //only valid cases
                returnedChildren = new RoArray(
                    children.slice(indexValue, indexValue + numChildrenValue).map((child) => {
                        return child instanceof BrsInvalid ? child.box() : child;
                    })
                );
            }
            return returnedChildren;
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
            return this.getNodeParent();
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
            const child = createNodeByType(nodeType.value, interpreter);
            if (child instanceof RoSGNode) {
                this.appendChildToParent(child);
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
            args: [new StdlibArgument("newChild", ValueKind.Dynamic), new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, newChild: BrsType, index: Int32) => {
            if (!(newChild instanceof RoSGNode)) {
                return BrsBoolean.False;
            }
            return BrsBoolean.from(this.replaceChildAtIndex(newChild, index.getValue()));
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
                const childNodesElements = child_nodes.getElements();
                if (childNodesElements.length !== 0) {
                    for (const childNode of childNodesElements) {
                        this.removeChildByReference(childNode);
                    }
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
            args: [new StdlibArgument("num_children", ValueKind.Int32), new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, num_children: Int32, index: Int32) => {
            const count = num_children.getValue();
            const idx = index.getValue();
            return BrsBoolean.from(this.removeChildrenAtIndex(idx, count));
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
            const indexValue = index.getValue();
            const children = this.getNodeChildren();
            let child: BrsType = BrsInvalid.Instance;
            if (indexValue >= 0 && indexValue < children.length) {
                child = children[indexValue];
            }
            return child;
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
                const childNodesElements = child_nodes.getElements();
                if (childNodesElements.length !== 0) {
                    for (const childNode of childNodesElements) {
                        if (childNode instanceof RoSGNode) {
                            // Remove if it exists to re-append
                            this.removeChildByReference(childNode);
                            this.appendChildToParent(childNode);
                        }
                    }
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
            const numChildrenValue = num_children.getValue();
            const addedChildren: RoSGNode[] = [];
            for (let i = 0; i < numChildrenValue; i++) {
                const child = createNodeByType(subtype.value, interpreter);
                if (child instanceof RoSGNode) {
                    this.appendChildToParent(child);
                    addedChildren.push(child);
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
            args: [new StdlibArgument("child_nodes", ValueKind.Dynamic), new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, child_nodes: BrsType, index: Int32) => {
            if (child_nodes instanceof RoArray) {
                let indexValue = index.getValue();
                const childNodesElements = child_nodes.getElements();
                if (childNodesElements.length !== 0) {
                    for (const childNode of childNodesElements) {
                        if (childNode instanceof RoSGNode && !this.replaceChildAtIndex(childNode, indexValue)) {
                            this.removeChildByReference(childNode);
                        }
                        indexValue += 1;
                    }
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
            args: [new StdlibArgument("child_nodes", ValueKind.Dynamic), new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, child_nodes: BrsType, index: Int32) => {
            if (child_nodes instanceof RoArray) {
                let indexValue = index.getValue();
                const childNodesElements = child_nodes.getElements();
                if (childNodesElements.length !== 0) {
                    for (const childNode of childNodesElements) {
                        this.insertChildAtIndex(childNode, indexValue);
                        indexValue += 1;
                    }
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
            args: [new StdlibArgument("child", ValueKind.Dynamic), new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, child: BrsType, index: Int32) => {
            return BrsBoolean.from(this.insertChildAtIndex(child, index.getValue()));
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
            return BrsBoolean.from(this.removeChildrenAtIndex(index.getValue(), 1));
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
                const parent = this.getNodeParent();
                if (parent instanceof RoSGNode) {
                    parent.removeChildByReference(this);
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
            return toAssociativeArray(this.getBoundingRect(interpreter, "toParent"));
        },
    });

    /* Returns the Node local bounding rectangle */
    private readonly localBoundingRect = new Callable("localBoundingRect", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            return toAssociativeArray(this.getBoundingRect(interpreter, "local"));
        },
    });

    /* Returns the bounding rectangle for scene components. */
    private readonly sceneBoundingRect = new Callable("sceneBoundingRect", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            return toAssociativeArray(this.getBoundingRect(interpreter, "toScene"));
        },
    });

    /* Returns true if the subject node has the remote control focus, and false otherwise */
    private readonly hasFocus = new Callable("hasFocus", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(sgRoot.focused === this);
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
            this.location = interpreter.formatLocation();
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
        impl: (_: Interpreter) => {
            // loop through all children DFS and check if any children has focus
            if (sgRoot.focused === this) {
                return BrsBoolean.True;
            }
            return BrsBoolean.from(this.isChildrenFocused());
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

            // perform search
            return this.findNodeById(this.findRootNode(), name.value);
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
            return BrsBoolean.from(this.compareNodes(roSGNode));
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
            return this.cloneNode(isDeepCopy.toBoolean(), interpreter);
        },
    });

    /* Returns the node's root Scene. This returns a valid Scene even if the node is not parented. */
    private readonly getScene = new Callable("getScene", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return sgRoot.scene ?? BrsInvalid.Instance;
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
