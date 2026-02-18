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
import { createNode, getNodeType, isSubtypeCheck, subtypeHierarchy } from "../factory/NodeFactory";
import { toAssociativeArray } from "../factory/Serializer";
import { FieldKind, isContentNode, ObserverScope } from "../SGTypes";
import type { Scene, SGNodeType } from "../nodes";

export abstract class RoSGNode extends BrsComponent implements BrsValue, ISGNode {
    readonly kind = ValueKind.Object;
    readonly nodeType: SGNodeType;
    protected httpAgent: RoHttpAgent;
    m: RoAssociativeArray = new RoAssociativeArray([]);
    location: string = "";

    constructor(_: AAMember[], readonly nodeSubtype: string = "Node") {
        super("roSGNode");
        this.nodeType = getNodeType(this.nodeSubtype);
        BrsDevice.addNodeStat(this.nodeType);

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
            ifTypedComponent: [this.getSubtype], // undocumented interface
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
                this.ancestorBoundingRect,
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
    abstract setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind, sync?: boolean): void;
    abstract setValueSilent(fieldName: string, value: BrsType, alwaysNotify?: boolean): void;
    abstract addNodeField(fieldName: string, type: string, alwaysNotify: boolean, sync: boolean): void;
    abstract getAddress(): string;
    abstract setAddress(address: string): void;
    abstract getOwner(): number;
    abstract setOwner(owner: number): void;

    abstract getNodeChildren(): BrsType[];
    abstract getNodeParent(): RoSGNode | BrsInvalid;
    abstract findNodeById(node: RoSGNode, id: string): RoSGNode | BrsInvalid;
    abstract appendChildToParent(child: BrsType): boolean;
    abstract addObserver(
        interpreter: Interpreter,
        scope: ObserverScope,
        fieldName: BrsString,
        funcOrPort: BrsString | RoMessagePort,
        infoFields?: RoArray | BrsInvalid
    ): BrsBoolean;
    protected abstract removeObserver(fieldName: string, node?: RoSGNode): void;
    protected abstract cloneNode(isDeepCopy: boolean, interpreter?: Interpreter): BrsType;
    protected abstract callFunction(interpreter: Interpreter, funcName: BrsString, ...funcArgs: BrsType[]): BrsType;
    protected abstract setNodeFocus(focusOn: boolean): boolean;

    protected abstract moveObjectIntoField(fieldName: string, data: RoAssociativeArray): { code: number; msg?: string };
    protected abstract moveObjectFromField(fieldName: string): BrsType | string;
    protected abstract setFieldByRef(fieldName: string, data: RoAssociativeArray): number;
    protected abstract canGetFieldByRef(fieldName: string): boolean;
    protected abstract getFieldByRef(fieldName: string): RoAssociativeArray | string;
    protected abstract updateFields(interpreter: Interpreter, content: BrsType, createFields: boolean): void;
    protected abstract appendNodeFields(fieldsToAppend: BrsType): void;
    protected abstract setNodeFields(fieldsToAppend: BrsType, addFields?: boolean): void;
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
    protected abstract createPath(start?: RoSGNode, reverse?: boolean): RoSGNode[];
    protected abstract findRootNode(start?: RoSGNode): RoSGNode;

    protected abstract getBoundingRect(type: string, interpreter?: Interpreter): Rect;
    protected abstract compareNodes(other: RoSGNode): boolean;
    protected abstract getThreadInfo(): RoAssociativeArray;

    protected abstract shouldRendezvous(): boolean;
    protected abstract rendezvousCall(interpreter: Interpreter, method: string, args?: BrsType[]): BrsType | undefined;

    /**
     * Calls the function specified on this node.
     */
    protected readonly callFunc = new Callable(
        "callFunc",
        ...Callable.variadic({
            signature: {
                args: [new StdlibArgument("functionName", ValueKind.String)],
                returns: ValueKind.Dynamic,
            },
            impl: (interpreter: Interpreter, functionName: BrsString, ...functionArgs: BrsType[]) => {
                const remote = this.rendezvousCall(interpreter, "callFunc", [functionName, ...functionArgs]);
                if (remote !== undefined) {
                    return remote;
                }
                return this.callFunction(interpreter, functionName, ...functionArgs);
            },
        })
    );

    /** Removes all fields from the node */
    protected readonly clear = new Callable("clear", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "clear");
            if (remote !== undefined) {
                return remote;
            }
            this.clearNodeFields();
            return Uninitialized.Instance;
        },
    });

    /** Removes a given item from the node */
    protected readonly delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, str: BrsString) => {
            const remote = this.rendezvousCall(interpreter, "delete", [str]);
            if (remote !== undefined) {
                return remote;
            }
            this.removeFieldEntry(str.getValue());
            return BrsBoolean.True; //RBI always returns true
        },
    });

    /** Given a key and value, adds an item to the node if it doesn't exist
     * Or replaces the value of a key that already exists in the node
     */
    protected readonly addReplace = new Callable("addReplace", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String), new StdlibArgument("value", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, key: BrsString, value: BrsType) => {
            const remote = this.rendezvousCall(interpreter, "addReplace", [key, value]);
            if (remote !== undefined) {
                return remote;
            }
            this.location = interpreter.formatLocation();
            this.setValue(key.getValue(), value);
            return Uninitialized.Instance;
        },
    });

    /** Returns the number of items in the node */
    protected readonly count = new Callable("count", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "count");
            if (remote !== undefined) {
                return remote;
            }
            return new Int32(this.getElements().length);
        },
    });

    /** Returns a boolean indicating whether or not a given key exists in the node */
    protected readonly doesExist = new Callable("doesExist", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, str: BrsString) => {
            const remote = this.rendezvousCall(interpreter, "doesExist", [str]);
            if (remote !== undefined) {
                return remote;
            }
            return BrsBoolean.from(this.getElements().some((key) => key.getValue() === str.getValue().toLowerCase()));
        },
    });

    /** Appends a new node to another. If two keys are the same, the value of the original AA is replaced with the new one. */
    protected readonly append = new Callable("append", {
        signature: {
            args: [new StdlibArgument("obj", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, obj: BrsType) => {
            const remote = this.rendezvousCall(interpreter, "append", [obj]);
            if (remote !== undefined) {
                return remote;
            }
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
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "keys");
            if (remote !== undefined) {
                return remote;
            }
            return new RoArray(this.getElements());
        },
    });

    /** Returns an array of key/value pairs in lexicographical order of key. */
    protected readonly items = new Callable("items", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "items");
            if (remote !== undefined) {
                return remote;
            }
            return new RoArray(
                this.getElements().map((key: BrsString) => {
                    return toAssociativeArray({ key: key, value: this.get(key) });
                })
            );
        },
    });

    /** Given a key, returns the value associated with that key. This method is case insensitive. */
    protected readonly lookup = new Callable("lookup", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, key: BrsString) => {
            const remote = this.rendezvousCall(interpreter, "lookup", [key]);
            if (remote !== undefined) {
                return remote;
            }
            return this.get(key);
        },
    });

    /** Given a key, returns the value associated with that key. This method is case insensitive. */
    protected readonly lookupCI = new Callable("lookupCI", this.lookup.signatures[0]);

    /** Adds a new field to the node, if the field already exists it doesn't change the current value. */
    protected readonly addField = new Callable("addField", {
        signature: {
            args: [
                new StdlibArgument("fieldName", ValueKind.String),
                new StdlibArgument("type", ValueKind.String),
                new StdlibArgument("alwaysNotify", ValueKind.Boolean),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString, type: BrsString, alwaysNotify: BrsBoolean) => {
            const remote = this.rendezvousCall(interpreter, "addField", [fieldName, type, alwaysNotify]);
            if (remote !== undefined) {
                return remote;
            }
            this.location = interpreter.formatLocation();
            this.addNodeField(fieldName.getValue(), type.getValue(), alwaysNotify.toBoolean(), true);
            return BrsBoolean.True;
        },
    });

    /** Adds one or more fields defined as an associative array of key values. */
    protected readonly addFields = new Callable("addFields", {
        signature: {
            args: [new StdlibArgument("fields", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fields: RoAssociativeArray) => {
            const remote = this.rendezvousCall(interpreter, "addFields", [fields]);
            if (remote !== undefined) {
                return remote;
            }
            if (!(fields instanceof RoAssociativeArray)) {
                return BrsBoolean.False;
            }
            this.location = interpreter.formatLocation();
            this.setNodeFields(fields, true);
            return BrsBoolean.True;
        },
    });

    /** Returns an object containing thread information for debugging purposes. */
    protected readonly threadInfo = new Callable("threadInfo", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            // This method does not Rendezvous because it needs to get information about the current thread.
            return this.getThreadInfo();
        },
    });

    /** Makes subsequent operations on the node fields to queue on the node itself rather than on the Scene node render thread. */
    protected readonly queueFields = new Callable("queueFields", {
        signature: {
            args: [new StdlibArgument("queueNode", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, queueNode: BrsBoolean) => {
            const remote = this.rendezvousCall(interpreter, "queueFields", [queueNode]);
            if (remote !== undefined) {
                return remote;
            }
            // Not implemented yet. Mocking to prevent crash on usage.
            return Uninitialized.Instance;
        },
    });

    /** Moves an object into an roSGNode field, which must be an associative array. */
    protected readonly moveIntoField = new Callable("moveIntoField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String), new StdlibArgument("data", ValueKind.Object)],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString, data: RoAssociativeArray) => {
            const remote = this.rendezvousCall(interpreter, "moveIntoField", [fieldName, data]);
            if (remote !== undefined) {
                return remote;
            }
            let result: { code: number; msg?: string };
            if (data instanceof RoAssociativeArray) {
                result = this.moveObjectIntoField(fieldName.getValue(), data);
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
    protected readonly moveFromField = new Callable("moveFromField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            const remote = this.rendezvousCall(interpreter, "moveFromField", [fieldName]);
            if (remote !== undefined) {
                return remote;
            }
            const result = this.moveObjectFromField(fieldName.getValue());
            if (typeof result === "string") {
                const location = interpreter.formatLocation();
                BrsDevice.stderr.write(`warning,BRIGHTSCRIPT: ERROR: roSGNode.moveFromField: ${result}: ${location}`);
                return BrsInvalid.Instance;
            }
            return result;
        },
    });

    /** Assigns an associative array to the field of a roSGNode via reference. */
    protected readonly setRef = new Callable("setRef", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String), new StdlibArgument("data", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString, data: RoAssociativeArray) => {
            const remote = this.rendezvousCall(interpreter, "setRef", [fieldName, data]);
            if (remote !== undefined) {
                return remote;
            }
            if (sgRoot.inTaskThread() || !(data instanceof RoAssociativeArray)) {
                return BrsBoolean.False;
            }
            const result = this.setFieldByRef(fieldName.getValue(), data);
            if (result < 0) {
                const location = interpreter.formatLocation();
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGNode.setRef: Could not find field '"${fieldName.getValue()}"': ${location}`
                );
            }
            return BrsBoolean.from(result > 0);
        },
    });

    /** Indicates whether the GetRef() function will succeed in the current context. */
    protected readonly canGetRef = new Callable("canGetRef", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            const remote = this.rendezvousCall(interpreter, "canGetRef", [fieldName]);
            if (remote !== undefined) {
                return remote;
            }
            return BrsBoolean.from(this.canGetFieldByRef(fieldName.getValue()));
        },
    });

    /** Returns a reference to the value of an roSGNode field, which must be an associative array and be set by SetRef() */
    protected readonly getRef = new Callable("getRef", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            const remote = this.rendezvousCall(interpreter, "getRef", [fieldName]);
            if (remote !== undefined) {
                return remote;
            }
            const result = this.getFieldByRef(fieldName.getValue());
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
    protected readonly getField = new Callable("getField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            const remote = this.rendezvousCall(interpreter, "getField", [fieldName]);
            if (remote !== undefined) {
                return remote;
            }
            return this.get(fieldName);
        },
    });

    /** Returns the names and values of all the fields in the node. */
    protected readonly getFields = new Callable("getFields", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "getFields");
            if (remote !== undefined) {
                return remote;
            }
            return this.getNodeFieldsAsAA();
        },
    });

    /** Returns the type of a specific field of the subject node. */
    protected readonly getFieldType = new Callable("getFieldType", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            const remote = this.rendezvousCall(interpreter, "getFieldType", [fieldName]);
            if (remote !== undefined) {
                return remote;
            }
            const types = this.getNodeFieldTypes();
            const fieldType = types.get(fieldName);
            return fieldType instanceof BrsString ? fieldType : new BrsString("<NoSuchField>");
        },
    });

    /** Returns the names and types of all the fields in the node. */
    protected readonly getFieldTypes = new Callable("getFieldTypes", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "getFieldTypes");
            if (remote !== undefined) {
                return remote;
            }
            return this.getNodeFieldTypes();
        },
    });

    /** Returns true if the field exists */
    protected readonly hasField = new Callable("hasField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            const remote = this.rendezvousCall(interpreter, "hasField", [fieldName]);
            if (remote !== undefined) {
                return remote;
            }
            return BrsBoolean.from(this.hasNodeField(fieldName.getValue()));
        },
    });

    /** Registers a callback to be executed when the value of the field changes */
    protected readonly observeField = new Callable(
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
                const remote = this.rendezvousCall(interpreter, "observeField", [fieldName, funcName, infoFields]);
                if (remote !== undefined) {
                    return remote;
                }
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
                this.rendezvousCall(interpreter, "observeField", [fieldName, port, infoFields]);
                return this.addObserver(interpreter, "unscoped", fieldName, port, infoFields);
            },
        }
    );

    /** Removes all observers of a given field, regardless of whether or not the host node is the subscriber. */
    protected readonly unobserveField = new Callable("unobserveField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            this.rendezvousCall(interpreter, "unobserveField", [fieldName]);
            const name = fieldName.getValue();
            this.removeObserver(name);
            // returns true, even if the field doesn't exist
            return BrsBoolean.True;
        },
    });

    /** Sets up a connection between the observed node's field and the current component from which this call is made. */
    protected readonly observeFieldScoped = new Callable(
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
                const remote = this.rendezvousCall(interpreter, "observeFieldScoped", [
                    fieldName,
                    funcName,
                    infoFields,
                ]);
                if (remote !== undefined) {
                    return remote;
                }
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
                this.rendezvousCall(interpreter, "observeFieldScoped", [fieldName, port, infoFields]);
                return this.addObserver(interpreter, "scoped", fieldName, port, infoFields);
            },
        }
    );

    /** Sets up a connection between the observed node's field and the current component from which this call is made. */
    protected readonly observeFieldScopedEx = new Callable(
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
                const remote = this.rendezvousCall(interpreter, "observeFieldScopedEx", [
                    fieldName,
                    funcName,
                    infoFields,
                ]);
                if (remote !== undefined) {
                    return remote;
                }
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
                this.rendezvousCall(interpreter, "observeFieldScopedEx", [fieldName, port, infoFields]);
                return this.addObserver(interpreter, "scoped", fieldName, port, infoFields);
            },
        }
    );

    /** Removes the connection between the observing component and the observed node's field. */
    protected readonly unobserveFieldScoped = new Callable("unobserveFieldScoped", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            this.rendezvousCall(interpreter, "unobserveFieldScoped", [fieldName]);
            const name = fieldName.getValue();
            if (!interpreter.environment.hostNode) {
                const location = interpreter.formatLocation();
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGNode.unObserveFieldScoped: "${this.nodeSubtype}.${name}" no active host node: ${location}`
                );
                return BrsBoolean.False;
            }
            this.removeObserver(name, interpreter.environment.hostNode as RoSGNode);
            // returns true, even if the field doesn't exist
            return BrsBoolean.True;
        },
    });

    /** Removes the given field from the node */
    protected readonly removeField = new Callable("removeField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            const remote = this.rendezvousCall(interpreter, "removeField", [fieldName]);
            if (remote !== undefined) {
                return remote;
            }
            this.removeFieldEntry(fieldName.getValue());
            return BrsBoolean.True; //RBI always returns true
        },
    });

    /** Removes one or more fields from the node */
    protected readonly removeFields = new Callable("removeFields", {
        signature: {
            args: [new StdlibArgument("fieldNames", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldNames: RoArray) => {
            const remote = this.rendezvousCall(interpreter, "removeFields", [fieldNames]);
            if (remote !== undefined) {
                return remote;
            }
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
    protected readonly setField = new Callable("setField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String), new StdlibArgument("value", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString, value: BrsType) => {
            const remote = this.rendezvousCall(interpreter, "setField", [fieldName, value]);
            if (remote !== undefined) {
                return remote;
            }
            const name = fieldName.getValue();
            this.location = interpreter.formatLocation();
            if (
                !isContentNode(this) &&
                !this.getElements().some((key) => key.getValue().toLowerCase() === name.toLowerCase())
            ) {
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGNode.setField: Tried to set nonexistent field "${name}": ${this.location}`
                );
                return BrsBoolean.False;
            } else if (!this.canAcceptValue(name, value)) {
                BrsDevice.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGNode.setField: Type mismatch: ${this.location}`
                );
                // Roku always returns true if the field exists
                return BrsBoolean.True;
            }
            this.setValue(name, value);
            return BrsBoolean.True;
        },
    });

    /** Updates the value of multiple existing field only if the field exists and types match. */
    protected readonly setFields = new Callable("setFields", {
        signature: {
            args: [new StdlibArgument("fields", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fields: RoAssociativeArray) => {
            const remote = this.rendezvousCall(interpreter, "setFields", [fields]);
            if (remote !== undefined) {
                return remote;
            }
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
    protected readonly update = new Callable("update", {
        signature: {
            args: [
                new StdlibArgument("content", ValueKind.Object),
                new StdlibArgument("createFields", ValueKind.Boolean, BrsBoolean.False),
            ],
            returns: ValueKind.Uninitialized,
        },
        impl: (interpreter: Interpreter, content: RoAssociativeArray | RoArray, createFields: BrsBoolean) => {
            const remote = this.rendezvousCall(interpreter, "update", [content, createFields]);
            if (remote !== undefined) {
                return remote;
            }
            this.location = interpreter.formatLocation();
            this.updateFields(interpreter, content, createFields.toBoolean());
            return Uninitialized.Instance;
        },
    });

    /** Signals start and/or stop points for measuring app launch and Electronic Program Grid (EPG) launch times. */
    protected readonly signalBeacon = new Callable("signalBeacon", {
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
            return new Int32(validBeacons.includes(beacon.getValue()) ? 0 : 2);
        },
    });

    /**
     * Returns the current number of children in the subject node list of children.
     * This is always a non-negative number.
     */
    protected readonly getChildCount = new Callable("getChildCount", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "getChildCount");
            if (remote !== undefined) {
                return remote;
            }
            return new Int32(this.getNodeChildren().length);
        },
    });

    /* Adds a child node to the end of the subject node list of children so that it is
    traversed last (of those children) during render. */
    protected readonly appendChild = new Callable("appendChild", {
        signature: {
            args: [new StdlibArgument("child", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child: BrsType) => {
            const remote = this.rendezvousCall(interpreter, "appendChild", [child]);
            if (remote !== undefined) {
                return remote;
            }
            return BrsBoolean.from(this.appendChildToParent(child));
        },
    });

    /* Retrieves the number of child nodes specified by num_children from the subject
    node, starting at the position specified by index. Returns an array of the child nodes
    retrieved. If num_children is -1, return all the children. */
    protected readonly getChildren = new Callable("getChildren", {
        signature: {
            args: [new StdlibArgument("num_children", ValueKind.Int32), new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, num_children: Int32, index: Int32) => {
            const remote = this.rendezvousCall(interpreter, "getChildren", [num_children, index]);
            if (remote !== undefined) {
                return remote;
            }
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
    protected readonly removeChild = new Callable("removeChild", {
        signature: {
            args: [new StdlibArgument("child", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child: BrsType) => {
            const remote = this.rendezvousCall(interpreter, "removeChild", [child]);
            if (remote !== undefined) {
                return remote;
            }
            return BrsBoolean.from(this.removeChildByReference(child));
        },
    });
    /* If the subject node has been added to a parent node list of children,
    return the parent node, otherwise return invalid.*/
    protected readonly getParent = new Callable("getParent", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "getParent");
            if (remote !== undefined) {
                return remote;
            }
            return this.getNodeParent();
        },
    });

    /* Creates a child node of type nodeType, and adds the new node to the end of the
    subject node list of children */
    protected readonly createChild = new Callable("createChild", {
        signature: {
            args: [new StdlibArgument("nodeType", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, nodeType: BrsString) => {
            const remote = this.rendezvousCall(interpreter, "createChild", [nodeType]);
            if (remote !== undefined) {
                return remote;
            }
            const child = createNode(nodeType.getValue(), interpreter);
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

    protected readonly replaceChild = new Callable("replaceChild", {
        signature: {
            args: [new StdlibArgument("newChild", ValueKind.Dynamic), new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, newChild: BrsType, index: Int32) => {
            const remote = this.rendezvousCall(interpreter, "replaceChild", [newChild, index]);
            if (remote !== undefined) {
                return remote;
            }
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
    protected readonly removeChildren = new Callable("removeChildren", {
        signature: {
            args: [new StdlibArgument("child_nodes", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child_nodes: BrsType) => {
            const remote = this.rendezvousCall(interpreter, "removeChildren", [child_nodes]);
            if (remote !== undefined) {
                return remote;
            }
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
    protected readonly removeChildrenIndex = new Callable("removeChildrenIndex", {
        signature: {
            args: [new StdlibArgument("num_children", ValueKind.Int32), new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, num_children: Int32, index: Int32) => {
            const remote = this.rendezvousCall(interpreter, "removeChildrenIndex", [num_children, index]);
            if (remote !== undefined) {
                return remote;
            }
            const count = num_children.getValue();
            const idx = index.getValue();
            return BrsBoolean.from(this.removeChildrenAtIndex(idx, count));
        },
    });

    /**
     * If the subject node has a child node at the index position, return it, otherwise
     * return invalid.
     */
    protected readonly getChild = new Callable("getChild", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, index: Int32) => {
            const remote = this.rendezvousCall(interpreter, "getChild", [index]);
            if (remote !== undefined) {
                return remote;
            }
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
    protected readonly appendChildren = new Callable("appendChildren", {
        signature: {
            args: [new StdlibArgument("child_nodes", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child_nodes: BrsType) => {
            const remote = this.rendezvousCall(interpreter, "appendChildren", [child_nodes]);
            if (remote !== undefined) {
                return remote;
            }
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
    protected readonly createChildren = new Callable("createChildren", {
        signature: {
            args: [
                new StdlibArgument("num_children", ValueKind.Int32),
                new StdlibArgument("subtype", ValueKind.String),
            ],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, num_children: Int32, subtype: BrsString) => {
            const remote = this.rendezvousCall(interpreter, "createChildren", [num_children, subtype]);
            if (remote !== undefined) {
                return remote;
            }
            const numChildrenValue = num_children.getValue();
            const addedChildren: RoSGNode[] = [];
            for (let i = 0; i < numChildrenValue; i++) {
                const child = createNode(subtype.getValue(), interpreter);
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
    protected readonly replaceChildren = new Callable("replaceChildren", {
        signature: {
            args: [new StdlibArgument("child_nodes", ValueKind.Dynamic), new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child_nodes: BrsType, index: Int32) => {
            const remote = this.rendezvousCall(interpreter, "replaceChildren", [child_nodes, index]);
            if (remote !== undefined) {
                return remote;
            }
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
    protected readonly insertChildren = new Callable("insertChildren", {
        signature: {
            args: [new StdlibArgument("child_nodes", ValueKind.Dynamic), new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child_nodes: BrsType, index: Int32) => {
            const remote = this.rendezvousCall(interpreter, "insertChildren", [child_nodes, index]);
            if (remote !== undefined) {
                return remote;
            }
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
    protected readonly insertChild = new Callable("insertChild", {
        signature: {
            args: [new StdlibArgument("child", ValueKind.Dynamic), new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child: BrsType, index: Int32) => {
            const remote = this.rendezvousCall(interpreter, "insertChild", [child, index]);
            if (remote !== undefined) {
                return remote;
            }
            return BrsBoolean.from(this.insertChildAtIndex(child, index.getValue()));
        },
    });

    /**
     * If the subject node has a child node in the index position, remove that child
     * node from the subject node list of children.
     */
    protected readonly removeChildIndex = new Callable("removeChildIndex", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, index: Int32) => {
            const remote = this.rendezvousCall(interpreter, "removeChildIndex", [index]);
            if (remote !== undefined) {
                return remote;
            }
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
    protected readonly reparent = new Callable("reparent", {
        signature: {
            args: [
                new StdlibArgument("newParent", ValueKind.Dynamic),
                new StdlibArgument("adjustTransform", ValueKind.Boolean),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, newParent: BrsType, adjustTransform: BrsBoolean) => {
            const remote = this.rendezvousCall(interpreter, "reparent", [newParent, adjustTransform]);
            if (remote !== undefined) {
                return remote;
            }
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
    protected readonly boundingRect = new Callable("boundingRect", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "boundingRect");
            if (remote !== undefined) {
                return remote;
            }
            return toAssociativeArray(this.getBoundingRect("toParent", interpreter));
        },
    });

    /* Returns the Node local bounding rectangle */
    protected readonly localBoundingRect = new Callable("localBoundingRect", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "localBoundingRect");
            if (remote !== undefined) {
                return remote;
            }
            return toAssociativeArray(this.getBoundingRect("local", interpreter));
        },
    });

    /* Returns the bounding rectangle for scene components. */
    protected readonly sceneBoundingRect = new Callable("sceneBoundingRect", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "sceneBoundingRect");
            if (remote !== undefined) {
                return remote;
            }
            return toAssociativeArray(this.getBoundingRect("toScene", interpreter));
        },
    });

    /* Returns the bounding rectangle in relation to an ancestor component. */
    protected readonly ancestorBoundingRect = new Callable("ancestorBoundingRect", {
        signature: {
            args: [new StdlibArgument("ancestor", ValueKind.Object)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, ancestor: RoSGNode) => {
            const remote = this.rendezvousCall(interpreter, "ancestorBoundingRect", [ancestor]);
            if (remote !== undefined) {
                return remote;
            }
            const boundingRect = this.getBoundingRect("toParent", interpreter);
            const ancestorRect = { ...boundingRect };
            let ancestorFound = false;
            const path = this.createPath(this, false).slice(1);
            for (const node of path) {
                if (ancestor === node) {
                    ancestorFound = true;
                    break;
                }
                const nodeRect = node.getBoundingRect("toParent", interpreter);
                ancestorRect.x += nodeRect.x;
                ancestorRect.y += nodeRect.y;
            }
            return ancestorFound ? toAssociativeArray(ancestorRect) : toAssociativeArray(boundingRect);
        },
    });

    /* Returns true if the subject node has the remote control focus, and false otherwise */
    protected readonly hasFocus = new Callable("hasFocus", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "hasFocus");
            if (remote !== undefined) {
                return remote;
            }
            return BrsBoolean.from(sgRoot.focused === this);
        },
    });

    /**
     * If on is set to true, sets the current remote control focus to the subject node,
     * also automatically removing it from the node on which it was previously set.
     * If on is set to false, removes focus from the subject node if it had it.
     *
     * It also runs through all of the ancestors of the node that was focused prior to this call,
     * and the newly focused node, and sets the `focusedChild` field of each to reflect the new state.
     */
    protected readonly setFocus = new Callable("setFocus", {
        signature: {
            args: [new StdlibArgument("on", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, on: BrsBoolean) => {
            const remote = this.rendezvousCall(interpreter, "setFocus", [on]);
            if (remote !== undefined) {
                return remote;
            }
            this.location = interpreter.formatLocation();
            return BrsBoolean.from(this.setNodeFocus(on.toBoolean()));
        },
    });

    /**
     * Returns true if the subject node or any of its descendants in the SceneGraph node tree
     * has remote control focus
     */
    protected readonly isInFocusChain = new Callable("isInFocusChain", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "isInFocusChain");
            if (remote !== undefined) {
                return remote;
            }
            // loop through all children DFS and check if any children has focus
            if (sgRoot.focused === this) {
                return BrsBoolean.True;
            }
            return BrsBoolean.from(this.isChildrenFocused());
        },
    });

    /**
     * Returns the node that is a descendant of the nearest component ancestor of the subject node whose id field matches the given name,
     * otherwise return invalid.
     * Implemented as a DFS from the top of parent hierarchy to match the observed behavior as opposed to the BFS mentioned in the docs.
     */
    protected readonly findNode = new Callable("findNode", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, name: BrsString) => {
            const remote = this.rendezvousCall(interpreter, "findNode", [name]);
            if (remote !== undefined) {
                return remote;
            }
            const id = name.getValue();
            if (id.trim() === "") return BrsInvalid.Instance;
            // perform search to child nodes
            let node = this.findNodeById(this, id);
            if (node instanceof BrsInvalid) {
                // if not found, search from root
                node = this.findNodeById(this.findRootNode(), id);
            }
            return node;
        },
    });

    /**
     * Checks whether the subtype of the subject node is a descendant of the subtype nodeType
     * in the SceneGraph node class hierarchy.
     */
    protected readonly isSubtype = new Callable("isSubtype", {
        signature: {
            args: [new StdlibArgument("nodeType", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, nodeType: BrsString) => {
            const remote = this.rendezvousCall(interpreter, "isSubtype", [nodeType]);
            if (remote !== undefined) {
                return remote;
            }
            return BrsBoolean.from(isSubtypeCheck(this.nodeSubtype, nodeType.getValue()));
        },
    });

    /**
     * Checks whether the subtype of the subject node is a descendant of the subtype nodeType
     * in the SceneGraph node class hierarchy.
     */
    protected readonly parentSubtype = new Callable("parentSubtype", {
        signature: {
            args: [new StdlibArgument("nodeType", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, nodeType: BrsString) => {
            const remote = this.rendezvousCall(interpreter, "parentSubtype", [nodeType]);
            if (remote !== undefined) {
                return remote;
            }
            const parentType = subtypeHierarchy.get(nodeType.getValue().toLowerCase());
            if (parentType) {
                return new BrsString(parentType);
            }
            return BrsInvalid.Instance;
        },
    });

    /**
     * Returns a Boolean value indicating whether the roSGNode parameter
     * refers to the same node object as this node
     */
    protected readonly isSameNode = new Callable("isSameNode", {
        signature: {
            args: [new StdlibArgument("roSGNode", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, roSGNode: RoSGNode) => {
            const remote = this.rendezvousCall(interpreter, "isSameNode", [roSGNode]);
            if (remote !== undefined) {
                return remote;
            }
            return BrsBoolean.from(this.compareNodes(roSGNode));
        },
    });

    /* Returns the subtype of this node as specified when it was created */
    protected readonly subtype = new Callable("subtype", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "subtype");
            if (remote !== undefined) {
                return remote;
            }
            return new BrsString(this.nodeSubtype);
        },
    });

    /* Returns the subtype of this node as specified when it was created */
    protected readonly getSubtype = new Callable("getSubtype", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "getSubtype");
            if (remote !== undefined) {
                return remote;
            }
            return new BrsString(this.nodeSubtype);
        },
    });

    /* Returns a copy of the entire node tree or just a shallow copy. */
    protected readonly clone = new Callable("clone", {
        signature: {
            args: [new StdlibArgument("isDeepCopy", ValueKind.Boolean)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, isDeepCopy: BrsBoolean) => {
            const remote = this.rendezvousCall(interpreter, "clone", [isDeepCopy]);
            if (remote !== undefined) {
                return remote;
            }
            return this.cloneNode(isDeepCopy.toBoolean(), interpreter);
        },
    });

    /* Returns the node's root Scene. This returns a valid Scene even if the node is not parented. */
    protected readonly getScene: Callable = new Callable("getScene", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "getScene");
            if (remote !== undefined) {
                if (remote instanceof RoSGNode && remote.nodeType === "Scene") {
                    sgRoot.setScene(remote as Scene);
                }
                return remote;
            }
            return sgRoot.scene ?? BrsInvalid.Instance;
        },
    });

    /* Returns the roHttpAgent object for the node. */
    protected readonly getHttpAgent = new Callable("getHttpAgent", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "getHttpAgent");
            if (remote !== undefined) {
                return remote;
            }
            return this.httpAgent;
        },
    });

    /** Sets an roHttpAgent object for the node. */
    protected readonly setHttpAgent = new Callable("setHttpAgent", {
        signature: {
            args: [new StdlibArgument("httpAgent", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, httpAgent: RoHttpAgent) => {
            const remote = this.rendezvousCall(interpreter, "setHttpAgent", [httpAgent]);
            if (remote !== undefined) {
                return remote;
            }
            if (httpAgent instanceof RoHttpAgent) {
                this.httpAgent = httpAgent;
                this.registerHttpAgent(httpAgent);
                return BrsBoolean.True;
            }
            return BrsBoolean.False;
        },
    });
}
