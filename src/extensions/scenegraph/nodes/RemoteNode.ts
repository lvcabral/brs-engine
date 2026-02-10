import {
    BrsBoolean,
    BrsString,
    BrsType,
    BrsValue,
    isBrsString,
    RoArray,
    RoAssociativeArray,
    Uninitialized,
    ValueKind,
    Callable,
    Interpreter,
    SyncType,
    StdlibArgument,
    Int32,
    RoMessagePort,
    BrsInvalid,
    BrsDevice,
} from "brs-engine";
import { FieldKind, MethodCallPayload } from "../SGTypes";
import { Node } from "../nodes/Node";
import { sgRoot } from "../SGRoot";
import { SGNodeType } from ".";

/**
 * Base implementation for a SceneGraph node that is used in task threads to perform remote field and method requests.
 */
export class RemoteNode extends Node implements BrsValue {
    /**
     * Creates a new remote node instance.
     * @param nodeSubtype Concrete subtype identifier used for serialization and debugging.
     * @param syncType Sync type used for remote field and method requests.
     */
    constructor(
        readonly nodeType: SGNodeType,
        readonly nodeSubtype: string,
        readonly syncType: SyncType
    ) {
        super([], nodeSubtype);
        this.setExtendsType(nodeSubtype, nodeType);
        this.owner = 0; // Remote node is always owned by render thread
        const methods = [
            // ifAssociativeArray
            this.clear,
            this.delete,
            this.addReplace,
            this.count,
            this.doesExist,
            this.append,
            this.keys,
            this.items,
            this.lookup,
            // ifSGNodeField
            this.addField,
            this.addFields,
            this.getField,
            this.getFields,
            this.getFieldType,
            this.getFieldTypes,
            this.hasField,
            this.observeField,
            this.unobserveField,
            this.observeFieldScoped,
            this.unobserveFieldScoped,
            this.removeField,
            this.removeFields,
            this.setField,
            this.setFields,
            this.update,
            // ifSGNodeChildren
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
            // ifSGNodeFocus
            this.hasFocus,
            this.setFocus,
            this.isInFocusChain,
            // ifSGNodeDict
            this.findNode,
            this.isSameNode,
            this.subtype,
            this.callFunc,
            this.isSubtype,
            this.parentSubtype,
            this.clone,
        ];
        this.overrideMethods(methods);
        BrsDevice.stdout.write(
            `debug, [node:${sgRoot.threadId}] Created RemoteNode "${this.nodeType}:${this.nodeSubtype}" with sync type "${this.syncType}"`
        );
    }
    // Scene properties mocked for RemoteNode
    ui: undefined;
    dialog: undefined;

    /**
     * @override
     * Looks up a field or method by name, mimicking BrightScript associative-array semantics.
     * @param index Field or method name as a BrightScript string value.
     * @throws Error when an unsupported index type is provided.
     * @returns Field value, method, or invalid when missing.
     */
    get(index: BrsType): BrsType {
        if (sgRoot.inTaskThread() && isBrsString(index)) {
            const key = index.toString().toLowerCase();
            if (this.fields.has(key)) {
                const task = sgRoot.getCurrentThreadTask();
                if (task?.active && !this.consumeFreshField(key)) {
                    task.requestFieldValue(this.syncType, this.address, key);
                }
            } else {
                const method = this.getMethod(key);
                if (method) {
                    return method;
                }
            }
        }
        return super.get(index);
    }

    /**
     * @override
     * Sets or aliases a field value, performing type validation and notification.
     * @param index Field name to update.
     * @param value New BrightScript value.
     * @param alwaysNotify When provided, controls observer notification behavior for new fields.
     * @param kind Optional explicit field kind used when creating new dynamic fields.
     * @param sync When true, synchronizes the field change to remote observers.
     */
    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind, sync: boolean = true) {
        BrsDevice.stdout.write(
            `debug, [node:${sgRoot.threadId}] RemoteNode.setValue() called for field "${
                this.getId() || this.nodeSubtype
            }.${index}"`
        );
        const fieldName = index.toLowerCase();
        super.setValue(index, value, alwaysNotify, kind);
        if (sync && this.changed) {
            this.syncRemoteField(fieldName);
            this.changed = false;
        }
    }

    /**
     * @override
     * Remote node owner cannot be changed.
     */
    setOwner(_threadId: number): void {
        // Remote node owner cannot be changed
        return;
    }

    /**
     * Synchronizes field back to the main thread when applicable.
     * @param key Field to synchronize.
     */
    protected syncRemoteField(key: string) {
        const field = this.fields.get(key.toLowerCase());
        if (!field) {
            return;
        }
        if (sgRoot.inTaskThread() && this.owner !== sgRoot.threadId) {
            // Sync all fields owned by the main thread back to the main thread
            const fieldValue = field.getValue(false);
            const deep = fieldValue instanceof Node;
            this.sendThreadUpdate(sgRoot.threadId, "set", this.syncType, this.address, key, fieldValue, deep);
        }
    }

    /**
     * Helper to perform a remote method call via the current task.
     * @param interpreter Current BrightScript interpreter.
     * @param methodName Name of the method to call.
     * @param args Arguments to pass to the remote method.
     * @returns Result of the remote method call, or undefined if not available.
     */
    private remoteMethodCall(interpreter: Interpreter, methodName: string, args?: BrsType[]): BrsType | undefined {
        let result: BrsType | undefined;
        const task = sgRoot.getCurrentThreadTask();
        if (task?.active) {
            let host = this.address;
            const hostNode = interpreter.environment.hostNode;
            if (hostNode instanceof Node) {
                host = hostNode.getAddress();
            }
            const location = interpreter.location;
            const payload: MethodCallPayload = args ? { host, args, location } : { host, location };
            result = task.requestMethodCall(this.syncType, this.address, methodName, payload);
        }
        return result;
    }

    /**
     * @override
     * Returns true if the field exists
     * */
    protected readonly hasField = new Callable("hasField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            const result = this.remoteMethodCall(interpreter, "hasField", [fieldName]);
            return result ?? BrsBoolean.False;
        },
    });

    /**
     * @override
     * Registers a callback to be executed when the value of the field changes
     */
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
                const result = this.remoteMethodCall(interpreter, "observeField", [fieldName, funcName, infoFields]);
                return result ?? BrsBoolean.False;
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
                const result = this.remoteMethodCall(interpreter, "observeField", [fieldName, port, infoFields]);
                return result ?? BrsBoolean.False;
            },
        }
    );

    /**
     * @override
     * Returns the current number of children in the subject node list of children.
     * This is always a non-negative number.
     */
    protected readonly getChildCount = new Callable("getChildCount", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            const result = this.remoteMethodCall(interpreter, "getChildCount");
            return result ?? new Int32(0);
        },
    });

    // ---- ifAssociativeArray methods ----

    /**
     * @override
     * Removes all fields from the node
     */
    protected readonly clear = new Callable("clear", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter) => {
            this.remoteMethodCall(interpreter, "clear");
            return Uninitialized.Instance;
        },
    });

    /**
     * @override
     * Removes a given item from the node
     */
    protected readonly delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, str: BrsString) => {
            const result = this.remoteMethodCall(interpreter, "delete", [str]);
            return result ?? BrsBoolean.True;
        },
    });

    /**
     * @override
     * Given a key and value, adds an item to the node if it doesn't exist
     * Or replaces the value of a key that already exists in the node
     */
    protected readonly addReplace = new Callable("addReplace", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String), new StdlibArgument("value", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, key: BrsString, value: BrsType) => {
            this.remoteMethodCall(interpreter, "addReplace", [key, value]);
            return Uninitialized.Instance;
        },
    });

    /**
     * @override
     * Returns the number of items in the node
     */
    protected readonly count = new Callable("count", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            const result = this.remoteMethodCall(interpreter, "count");
            return result ?? new Int32(0);
        },
    });

    /**
     * @override
     * Returns a boolean indicating whether or not a given key exists in the node
     */
    protected readonly doesExist = new Callable("doesExist", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, str: BrsString) => {
            const result = this.remoteMethodCall(interpreter, "doesExist", [str]);
            return result ?? BrsBoolean.False;
        },
    });

    /**
     * @override
     * Appends a new node to another. If two keys are the same, the value of the original AA is replaced with the new one.
     */
    protected readonly append = new Callable("append", {
        signature: {
            args: [new StdlibArgument("obj", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, obj: BrsType) => {
            this.remoteMethodCall(interpreter, "append", [obj]);
            return Uninitialized.Instance;
        },
    });

    /**
     * @override
     * Returns an array of keys from the node in lexicographical order
     */
    protected readonly keys = new Callable("keys", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const result = this.remoteMethodCall(interpreter, "keys");
            return result ?? new RoArray([]);
        },
    });

    /**
     * @override
     * Returns an array of key/value pairs in lexicographical order of key.
     */
    protected readonly items = new Callable("items", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const result = this.remoteMethodCall(interpreter, "items");
            return result ?? new RoArray([]);
        },
    });

    /**
     * @override
     * Given a key, returns the value associated with that key. This method is case insensitive.
     */
    protected readonly lookup = new Callable("lookup", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, key: BrsString) => {
            const result = this.remoteMethodCall(interpreter, "lookup", [key]);
            return result ?? BrsInvalid.Instance;
        },
    });

    // ---- ifSGNodeField methods ----

    /**
     * @override
     * Adds a new field to the node, if the field already exists it doesn't change the current value.
     */
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
            const result = this.remoteMethodCall(interpreter, "addField", [fieldName, type, alwaysNotify]);
            return result ?? BrsBoolean.True;
        },
    });

    /**
     * @override
     * Adds one or more fields defined as an associative array of key values.
     */
    protected readonly addFields = new Callable("addFields", {
        signature: {
            args: [new StdlibArgument("fields", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fields: RoAssociativeArray) => {
            const result = this.remoteMethodCall(interpreter, "addFields", [fields]);
            return result ?? BrsBoolean.False;
        },
    });

    /**
     * @override
     * Returns the value of the field passed as argument, if the field doesn't exist it returns invalid.
     */
    protected readonly getField = new Callable("getField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            const result = this.remoteMethodCall(interpreter, "getField", [fieldName]);
            return result ?? BrsInvalid.Instance;
        },
    });

    /**
     * @override
     * Returns the names and values of all the fields in the node.
     */
    protected readonly getFields = new Callable("getFields", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const result = this.remoteMethodCall(interpreter, "getFields");
            return result ?? new RoAssociativeArray([]);
        },
    });

    /**
     * @override
     * Returns the type of a specific field of the subject node.
     */
    protected readonly getFieldType = new Callable("getFieldType", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            const result = this.remoteMethodCall(interpreter, "getFieldType", [fieldName]);
            return result ?? new BrsString("<NoSuchField>");
        },
    });

    /**
     * @override
     * Returns the names and types of all the fields in the node.
     */
    protected readonly getFieldTypes = new Callable("getFieldTypes", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const result = this.remoteMethodCall(interpreter, "getFieldTypes");
            return result ?? new RoAssociativeArray([]);
        },
    });

    /**
     * @override
     * Removes all observers of a given field.
     */
    protected readonly unobserveField = new Callable("unobserveField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            const result = this.remoteMethodCall(interpreter, "unobserveField", [fieldName]);
            return result ?? BrsBoolean.True;
        },
    });

    /**
     * @override
     * Sets up a connection between the observed node's field and the current component from which this call is made.
     */
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
                const result = this.remoteMethodCall(interpreter, "observeFieldScoped", [
                    fieldName,
                    funcName,
                    infoFields,
                ]);
                return result ?? BrsBoolean.False;
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
                const result = this.remoteMethodCall(interpreter, "observeFieldScoped", [fieldName, port, infoFields]);
                return result ?? BrsBoolean.False;
            },
        }
    );

    /**
     * @override
     * Removes the connection between the observing component and the observed node's field.
     */
    protected readonly unobserveFieldScoped = new Callable("unobserveFieldScoped", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            const result = this.remoteMethodCall(interpreter, "unobserveFieldScoped", [fieldName]);
            return result ?? BrsBoolean.True;
        },
    });

    /**
     * @override
     * Removes the given field from the node
     */
    protected readonly removeField = new Callable("removeField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString) => {
            const result = this.remoteMethodCall(interpreter, "removeField", [fieldName]);
            return result ?? BrsBoolean.True;
        },
    });

    /**
     * @override
     * Removes one or more fields from the node
     */
    protected readonly removeFields = new Callable("removeFields", {
        signature: {
            args: [new StdlibArgument("fieldNames", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldNames: RoArray) => {
            const result = this.remoteMethodCall(interpreter, "removeFields", [fieldNames]);
            return result ?? BrsBoolean.False;
        },
    });

    /**
     * @override
     * Updates the value of an existing field only if the field exists and types match.
     */
    protected readonly setField = new Callable("setField", {
        signature: {
            args: [new StdlibArgument("fieldName", ValueKind.String), new StdlibArgument("value", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldName: BrsString, value: BrsType) => {
            const result = this.remoteMethodCall(interpreter, "setField", [fieldName, value]);
            return result ?? BrsBoolean.True;
        },
    });

    /**
     * @override
     * Updates the value of multiple existing field only if the field exists and types match.
     */
    protected readonly setFields = new Callable("setFields", {
        signature: {
            args: [new StdlibArgument("fields", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fields: RoAssociativeArray) => {
            const result = this.remoteMethodCall(interpreter, "setFields", [fields]);
            return result ?? BrsBoolean.True;
        },
    });

    /**
     * @override
     * Updates the value of multiple existing field only if the types match.
     */
    protected readonly update = new Callable("update", {
        signature: {
            args: [
                new StdlibArgument("content", ValueKind.Object),
                new StdlibArgument("createFields", ValueKind.Boolean, BrsBoolean.False),
            ],
            returns: ValueKind.Uninitialized,
        },
        impl: (interpreter: Interpreter, content: RoAssociativeArray | RoArray, createFields: BrsBoolean) => {
            this.remoteMethodCall(interpreter, "update", [content, createFields]);
            return Uninitialized.Instance;
        },
    });

    // ---- ifSGNodeChildren methods ----

    /**
     * @override
     * Adds a child node to the end of the subject node list of children.
     */
    protected readonly appendChild = new Callable("appendChild", {
        signature: {
            args: [new StdlibArgument("child", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child: BrsType) => {
            const result = this.remoteMethodCall(interpreter, "appendChild", [child]);
            return result ?? BrsBoolean.False;
        },
    });

    /**
     * @override
     * Retrieves the number of child nodes specified by num_children from the subject node.
     */
    protected readonly getChildren = new Callable("getChildren", {
        signature: {
            args: [new StdlibArgument("num_children", ValueKind.Int32), new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, num_children: Int32, index: Int32) => {
            const result = this.remoteMethodCall(interpreter, "getChildren", [num_children, index]);
            return result ?? new RoArray([]);
        },
    });

    /**
     * @override
     * Finds a child node in the subject node list of children, and if found, removes it.
     */
    protected readonly removeChild = new Callable("removeChild", {
        signature: {
            args: [new StdlibArgument("child", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child: BrsType) => {
            const result = this.remoteMethodCall(interpreter, "removeChild", [child]);
            return result ?? BrsBoolean.False;
        },
    });

    /**
     * @override
     * Returns the parent node, otherwise returns invalid.
     */
    protected readonly getParent = new Callable("getParent", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            const result = this.remoteMethodCall(interpreter, "getParent");
            return result ?? BrsInvalid.Instance;
        },
    });

    /**
     * @override
     * Creates a child node of type nodeType, and adds the new node to the end of the subject node list of children.
     */
    protected readonly createChild = new Callable("createChild", {
        signature: {
            args: [new StdlibArgument("nodeType", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, nodeType: BrsString) => {
            const result = this.remoteMethodCall(interpreter, "createChild", [nodeType]);
            return result ?? BrsInvalid.Instance;
        },
    });

    /**
     * @override
     * Replaces a child node at the index position with the newChild node.
     */
    protected readonly replaceChild = new Callable("replaceChild", {
        signature: {
            args: [new StdlibArgument("newChild", ValueKind.Dynamic), new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, newChild: BrsType, index: Int32) => {
            const result = this.remoteMethodCall(interpreter, "replaceChild", [newChild, index]);
            return result ?? BrsBoolean.False;
        },
    });

    /**
     * @override
     * Removes the child nodes specified by child_nodes from the subject node.
     */
    protected readonly removeChildren = new Callable("removeChildren", {
        signature: {
            args: [new StdlibArgument("child_nodes", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child_nodes: BrsType) => {
            const result = this.remoteMethodCall(interpreter, "removeChildren", [child_nodes]);
            return result ?? BrsBoolean.False;
        },
    });

    /**
     * @override
     * Appends the nodes specified by child_nodes to the subject node.
     */
    protected readonly appendChildren = new Callable("appendChildren", {
        signature: {
            args: [new StdlibArgument("child_nodes", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child_nodes: BrsType) => {
            const result = this.remoteMethodCall(interpreter, "appendChildren", [child_nodes]);
            return result ?? BrsBoolean.False;
        },
    });

    /**
     * @override
     * Returns the child node at the index position, otherwise returns invalid.
     */
    protected readonly getChild = new Callable("getChild", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, index: Int32) => {
            const result = this.remoteMethodCall(interpreter, "getChild", [index]);
            return result ?? BrsInvalid.Instance;
        },
    });

    /**
     * @override
     * Inserts a previously-created child node at the position index.
     */
    protected readonly insertChild = new Callable("insertChild", {
        signature: {
            args: [new StdlibArgument("child", ValueKind.Dynamic), new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child: BrsType, index: Int32) => {
            const result = this.remoteMethodCall(interpreter, "insertChild", [child, index]);
            return result ?? BrsBoolean.False;
        },
    });

    /**
     * @override
     * Removes the number of child nodes specified by num_children from the subject node starting at the position specified by index.
     */
    protected readonly removeChildrenIndex = new Callable("removeChildrenIndex", {
        signature: {
            args: [new StdlibArgument("num_children", ValueKind.Int32), new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, num_children: Int32, index: Int32) => {
            const result = this.remoteMethodCall(interpreter, "removeChildrenIndex", [num_children, index]);
            return result ?? BrsBoolean.False;
        },
    });

    /**
     * @override
     * Removes the child node at the index position from the subject node list of children.
     */
    protected readonly removeChildIndex = new Callable("removeChildIndex", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, index: Int32) => {
            const result = this.remoteMethodCall(interpreter, "removeChildIndex", [index]);
            return result ?? BrsBoolean.False;
        },
    });

    /**
     * @override
     * Moves the subject node to another node.
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
            const result = this.remoteMethodCall(interpreter, "reparent", [newParent, adjustTransform]);
            return result ?? BrsBoolean.False;
        },
    });

    /**
     * @override
     * Creates the number of children specified by num_children for the subject node.
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
            const result = this.remoteMethodCall(interpreter, "createChildren", [num_children, subtype]);
            return result ?? new RoArray([]);
        },
    });

    /**
     * @override
     * Replaces the child nodes in the subject node, starting at the position specified by index.
     */
    protected readonly replaceChildren = new Callable("replaceChildren", {
        signature: {
            args: [new StdlibArgument("child_nodes", ValueKind.Dynamic), new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child_nodes: BrsType, index: Int32) => {
            const result = this.remoteMethodCall(interpreter, "replaceChildren", [child_nodes, index]);
            return result ?? BrsBoolean.False;
        },
    });

    /**
     * @override
     * Inserts the child nodes specified by child_nodes to the subject node starting at the position specified by index.
     */
    protected readonly insertChildren = new Callable("insertChildren", {
        signature: {
            args: [new StdlibArgument("child_nodes", ValueKind.Dynamic), new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child_nodes: BrsType, index: Int32) => {
            const result = this.remoteMethodCall(interpreter, "insertChildren", [child_nodes, index]);
            return result ?? BrsBoolean.False;
        },
    });

    // ---- ifSGNodeFocus methods ----

    /**
     * @override
     * Returns true if the subject node has the remote control focus.
     */
    protected readonly hasFocus = new Callable("hasFocus", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter) => {
            const result = this.remoteMethodCall(interpreter, "hasFocus");
            return result ?? BrsBoolean.False;
        },
    });

    /**
     * @override
     * Sets or removes the current remote control focus on the subject node.
     */
    protected readonly setFocus = new Callable("setFocus", {
        signature: {
            args: [new StdlibArgument("on", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, on: BrsBoolean) => {
            const result = this.remoteMethodCall(interpreter, "setFocus", [on]);
            return result ?? BrsBoolean.False;
        },
    });

    /**
     * @override
     * Returns true if the subject node or any of its descendants in the SceneGraph node tree has remote control focus.
     */
    protected readonly isInFocusChain = new Callable("isInFocusChain", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter) => {
            const result = this.remoteMethodCall(interpreter, "isInFocusChain");
            return result ?? BrsBoolean.False;
        },
    });

    // ---- ifSGNodeDict methods ----

    /**
     * @override
     * Returns the node that is a descendant of the nearest component ancestor whose id field matches the given name.
     */
    protected readonly findNode = new Callable("findNode", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, name: BrsString) => {
            const result = this.remoteMethodCall(interpreter, "findNode", [name]);
            return result ?? BrsInvalid.Instance;
        },
    });

    /**
     * @override
     * Returns a Boolean value indicating whether the roSGNode parameter refers to the same node object as this node.
     */
    protected readonly isSameNode = new Callable("isSameNode", {
        signature: {
            args: [new StdlibArgument("roSGNode", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, roSGNode: BrsType) => {
            const result = this.remoteMethodCall(interpreter, "isSameNode", [roSGNode]);
            return result ?? BrsBoolean.False;
        },
    });

    /**
     * @override
     * Returns the subtype of this node as specified when it was created.
     */
    protected readonly subtype = new Callable("subtype", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            const result = this.remoteMethodCall(interpreter, "subtype");
            return result ?? new BrsString(this.nodeSubtype);
        },
    });

    /**
     * @override
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
                const result = this.remoteMethodCall(interpreter, "callFunc", [functionName, ...functionArgs]);
                return result ?? BrsInvalid.Instance;
            },
        })
    );

    /**
     * @override
     * Checks whether the subtype of the subject node is a descendant of the subtype nodeType.
     */
    protected readonly isSubtype = new Callable("isSubtype", {
        signature: {
            args: [new StdlibArgument("nodeType", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, nodeType: BrsString) => {
            const result = this.remoteMethodCall(interpreter, "isSubtype", [nodeType]);
            return result ?? BrsBoolean.False;
        },
    });

    /**
     * @override
     * Returns the parent subtype of the specified nodeType.
     */
    protected readonly parentSubtype = new Callable("parentSubtype", {
        signature: {
            args: [new StdlibArgument("nodeType", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, nodeType: BrsString) => {
            const result = this.remoteMethodCall(interpreter, "parentSubtype", [nodeType]);
            return result ?? BrsInvalid.Instance;
        },
    });

    /**
     * @override
     * Returns a copy of the entire node tree or just a shallow copy.
     */
    protected readonly clone = new Callable("clone", {
        signature: {
            args: [new StdlibArgument("isDeepCopy", ValueKind.Boolean)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, isDeepCopy: BrsBoolean) => {
            const result = this.remoteMethodCall(interpreter, "clone", [isDeepCopy]);
            return result ?? BrsInvalid.Instance;
        },
    });
}
