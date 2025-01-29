import {
    BrsValue,
    ValueKind,
    BrsString,
    BrsInvalid,
    BrsBoolean,
    Uninitialized,
    getBrsValueFromFieldType,
    getValueKindFromFieldType,
} from "../BrsType";
import { RoSGNodeEvent } from "../events/RoSGNodeEvent";
import { BrsComponent, BrsIterable } from "./BrsComponent";
import { BrsType, isBrsNumber, isBrsString, RoMessagePort, toAssociativeArray } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { Int64 } from "../Int64";
import { Float } from "../Float";
import { Double } from "../Double";
import { RoAssociativeArray } from "./RoAssociativeArray";
import { RoArray } from "./RoArray";
import { AAMember } from "./RoAssociativeArray";
import { ComponentDefinition, ComponentNode } from "../../scenegraph";
import { NodeFactory, BrsNodeType } from "../nodes/NodeFactory";
import { Environment, Scope } from "../../interpreter/Environment";
import { RoInvalid } from "./RoInvalid";
import { BlockEnd } from "../../parser/Statement";
import { Stmt } from "../../parser";
import { generateArgumentMismatchError } from "../../interpreter/ArgumentMismatch";

interface BrsCallback {
    interpreter: Interpreter;
    environment: Environment;
    hostNode: RoSGNode;
    callable: Callable;
    eventParams: {
        fieldName: BrsString;
        node: RoSGNode;
        infoFields?: RoArray;
    };
}

/** Set of value types that a field could be. */
enum FieldKind {
    Interface = "interface",
    Array = "array",
    AssocArray = "assocarray",
    Int32 = "integer",
    Int64 = "longinteger",
    Double = "double",
    Float = "float",
    Node = "node",
    Boolean = "boolean",
    String = "string",
    Function = "function",
}

namespace FieldKind {
    export function fromString(type: string): FieldKind | undefined {
        switch (type.toLowerCase()) {
            case "interface":
                return FieldKind.Interface;
            case "array":
            case "roarray":
                return FieldKind.Array;
            case "roassociativearray":
            case "assocarray":
                return FieldKind.AssocArray;
            case "node":
                return FieldKind.Node;
            case "bool":
            case "boolean":
                return FieldKind.Boolean;
            case "int":
            case "integer":
                return FieldKind.Int32;
            case "longint":
            case "longinteger":
                return FieldKind.Int64;
            case "float":
                return FieldKind.Float;
            case "double":
                return FieldKind.Double;
            case "uri":
            case "str":
            case "string":
                return FieldKind.String;
            case "function":
                return FieldKind.Function;
            default:
                return undefined;
        }
    }

    export function fromBrsType(brsType: BrsType): FieldKind | undefined {
        if (brsType.kind !== ValueKind.Object) {
            return fromString(ValueKind.toString(brsType.kind));
        }

        let componentName = brsType.getComponentName();
        switch (componentName.toLowerCase()) {
            case "roarray":
                return FieldKind.Array;
            case "roassociativearray":
                return FieldKind.AssocArray;
            case "node":
                return FieldKind.Node;
            default:
                return undefined;
        }
    }
}

/** This is used to define a field (usually a default/built-in field in a component definition). */
export type FieldModel = {
    name: string;
    type: string;
    value?: string;
    hidden?: boolean;
    alwaysNotify?: boolean;
};

export class Field {
    private permanentObservers: BrsCallback[] = [];
    private unscopedObservers: BrsCallback[] = [];
    private scopedObservers: Map<RoSGNode, BrsCallback[]> = new Map();

    constructor(
        private value: BrsType,
        private type: FieldKind,
        private alwaysNotify: boolean,
        private hidden: boolean = false
    ) {}

    toString(parent?: BrsType): string {
        return this.value.toString(parent);
    }

    /**
     * Returns whether or not the field is "hidden".
     *
     * The reason for this is that some fields (content metadata fields) are
     * by default "hidden". This means they are accessible on the
     * node without an access error, but they don't show up when you print the node.
     */
    isHidden() {
        return this.hidden;
    }

    setHidden(isHidden: boolean) {
        this.hidden = isHidden;
    }

    getType(): FieldKind {
        return this.type;
    }

    getValue(): BrsType {
        // Once a field is accessed, it is no longer hidden.
        this.hidden = false;

        return this.value;
    }

    setValue(value: BrsType) {
        // Once a field is set, it is no longer hidden.
        this.hidden = false;

        if (isBrsNumber(value) && value.kind !== getValueKindFromFieldType(this.type)) {
            if (this.type === FieldKind.Float) {
                value = new Float(value.getValue());
            } else if (this.type === FieldKind.Int32) {
                value = new Int32(value.getValue());
            } else if (this.type === FieldKind.Int64) {
                value = new Int64(value.getValue());
            } else if (this.type === FieldKind.Double) {
                value = new Double(value.getValue());
            }
        }

        let oldValue = this.value;
        this.value = value;
        if (this.alwaysNotify || oldValue !== value) {
            this.permanentObservers.map(this.executeCallbacks.bind(this));
            this.unscopedObservers.map(this.executeCallbacks.bind(this));
            this.scopedObservers.forEach((callbacks) =>
                callbacks.map(this.executeCallbacks.bind(this))
            );
        }
    }

    canAcceptValue(value: BrsType) {
        // Objects are allowed to be set to invalid.
        let fieldIsObject = getValueKindFromFieldType(this.type) === ValueKind.Object;
        if (fieldIsObject && (value === BrsInvalid.Instance || value instanceof RoInvalid)) {
            return true;
        } else if (isBrsNumber(this.value) && isBrsNumber(value)) {
            // can convert between number types
            return true;
        }

        return this.type === FieldKind.fromBrsType(value);
    }

    addObserver(
        mode: "permanent" | "unscoped" | "scoped",
        interpreter: Interpreter,
        callable: Callable,
        subscriber: RoSGNode,
        target: RoSGNode,
        fieldName: BrsString,
        infoFields?: RoArray
    ) {
        // Once a field is accessed, it is no longer hidden.
        this.hidden = false;

        let brsCallback: BrsCallback = {
            interpreter,
            environment: interpreter.environment,
            hostNode: subscriber,
            callable,
            eventParams: {
                node: target,
                fieldName,
                infoFields,
            },
        };
        if (mode === "scoped") {
            let maybeCallbacks = this.scopedObservers.get(subscriber) || [];
            this.scopedObservers.set(subscriber, [...maybeCallbacks, brsCallback]);
        } else if (mode === "unscoped") {
            this.unscopedObservers.push(brsCallback);
        } else {
            this.permanentObservers.push(brsCallback);
        }
    }

    removeUnscopedObservers() {
        this.unscopedObservers.splice(0);
    }

    removeScopedObservers(hostNode: RoSGNode) {
        this.scopedObservers.get(hostNode)?.splice(0);
        this.scopedObservers.delete(hostNode);
    }

    private executeCallbacks(callback: BrsCallback) {
        const { interpreter, callable, hostNode, environment, eventParams } = callback;

        // Get info fields current value, if exists.
        let infoFields: RoAssociativeArray | undefined;
        if (eventParams.infoFields) {
            const fieldsMap = new Map();
            eventParams.infoFields.elements?.forEach((element) => {
                if (isBrsString(element)) {
                    // TODO: Check how to handle object values (by reference or by value)
                    fieldsMap.set(element.value, hostNode.get(element));
                }
            });
            infoFields = toAssociativeArray(fieldsMap);
        }
        // Every time a callback happens, a new event is created.
        let event = new RoSGNodeEvent(
            eventParams.node,
            eventParams.fieldName,
            this.value,
            infoFields
        );

        interpreter.inSubEnv((subInterpreter) => {
            subInterpreter.environment.hostNode = hostNode;
            subInterpreter.environment.setRootM(hostNode.m);

            try {
                // Check whether the callback is expecting an event parameter.
                const satisfiedSignature = callable.getFirstSatisfiedSignature([event]);
                if (satisfiedSignature) {
                    let { signature, impl } = satisfiedSignature;
                    subInterpreter.environment.define(
                        Scope.Function,
                        signature.args[0].name.text,
                        event
                    );
                    impl(subInterpreter, event);
                } else {
                    // Check whether the callback has a signature without parameters.
                    // Silently ignore if the callback has no signature that matches.
                    callable.getFirstSatisfiedSignature([])?.impl(subInterpreter);
                }
            } catch (err) {
                if (!(err instanceof BlockEnd)) {
                    throw err;
                }
            }
            return BrsInvalid.Instance;
        }, environment);
    }
}

/* Hierarchy of all node Types. Used to discover is a current node is a subtype of another node */
const subtypeHierarchy = new Map<string, string>();

/**
 *  Checks the node sub type hierarchy to see if the current node is a sub component of the given node type
 *
 * @param {string} currentNodeType
 * @param {string} checkType
 * @returns {boolean}
 */
function isSubtypeCheck(currentNodeType: string, checkType: string): boolean {
    checkType = checkType.toLowerCase();
    currentNodeType = currentNodeType.toLowerCase();
    if (currentNodeType === checkType) {
        return true;
    }
    let nextNodeType = subtypeHierarchy.get(currentNodeType);
    if (nextNodeType == null) {
        return false;
    }
    return isSubtypeCheck(nextNodeType, checkType);
}

export class RoSGNode extends BrsComponent implements BrsValue, BrsIterable {
    readonly kind = ValueKind.Object;
    private fields = new Map<string, Field>();
    private children: RoSGNode[] = [];
    private parent: RoSGNode | BrsInvalid = BrsInvalid.Instance;

    readonly defaultFields: FieldModel[] = [
        { name: "id", type: "string" },
        { name: "focusedchild", type: "node", alwaysNotify: true },
        { name: "focusable", type: "boolean" },
        { name: "change", type: "roAssociativeArray" },
    ];
    m: RoAssociativeArray = new RoAssociativeArray([]);

    constructor(initializedFields: AAMember[], readonly nodeSubtype: string = "Node") {
        super("Node");
        this.setExtendsType();

        // All nodes start have some built-in fields when created.
        this.registerDefaultFields(this.defaultFields);

        // After registering default fields, then register fields instantiated with initial values.
        this.registerInitializedFields(initializedFields);

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
                this.observeFieldScoped,
                this.unobserveFieldScoped,
                this.removeField,
                this.setField,
                this.setFields,
                this.update,
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
            ],
            ifSGNodeFocus: [this.hasFocus, this.setFocus, this.isInFocusChain],
            ifSGNodeDict: [
                this.findNode,
                this.isSameNode,
                this.subtype,
                this.callFunc,
                this.isSubtype,
                this.parentSubtype,
            ],
            ifSGNodeBoundingRect: [this.boundingRect],
        });
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
        let componentName = "roSGNode:" + this.nodeSubtype;

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

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (index.kind !== ValueKind.String) {
            throw new Error("RoSGNode indexes must be strings");
        }

        let mapKey = index.value.toLowerCase();
        let fieldType = kind || FieldKind.fromBrsType(value);
        let field = this.fields.get(mapKey);

        if (!field) {
            // RBI does not create a new field if the value isn't valid.
            if (fieldType) {
                field = new Field(value, fieldType, alwaysNotify);
                this.fields.set(mapKey, field);
            }
        } else if (field.canAcceptValue(value)) {
            // Fields are not overwritten if they haven't the same type.
            field.setValue(value);
            this.fields.set(mapKey, field);
        }

        return BrsInvalid.Instance;
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
            if (interpreter.environment.getFocusedNode() === childNode) {
                return true;
            } else if (childNode.isChildrenFocused(interpreter)) {
                return true;
            }
        }
        return false;
    }

    /* searches the node tree for a node with the given id */
    private findNodeById(node: RoSGNode, id: BrsString): RoSGNode | BrsInvalid {
        // test current node in tree
        let currentId = node.get(new BrsString("id"));
        if (currentId.toString() === id.toString()) {
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

    private removeChildByReference(child: BrsType): boolean {
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

    private appendChildToParent(child: BrsType): boolean {
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

    private replaceChildAtIndex(newchild: BrsType, index: Int32): boolean {
        let childrenSize = this.children.length;
        let indexValue = index.getValue();
        if (newchild instanceof RoSGNode && indexValue < childrenSize) {
            // If newchild is already a child, remove it first.
            this.removeChildByReference(newchild);
            if (indexValue >= 0) {
                // The check is done to see if indexValue is inside the
                // new length of this.children (in case newchild was
                // removed above)
                if (indexValue < this.children.length) {
                    // Remove the parent of the child at indexValue
                    this.children[indexValue].removeParent();
                }
                newchild.setNodeParent(this);
                this.children.splice(indexValue, 1, newchild);
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

    /**
     * Calls the function specified on this node.
     */
    private callFunc = new Callable(
        "callfunc",
        ...Callable.variadic({
            signature: {
                args: [new StdlibArgument("functionname", ValueKind.String)],
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
                            interpreter.stderr.write(
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

                interpreter.stderr.write(
                    `Warning calling function in ${this.nodeSubtype}: no function interface specified for ${functionName}`
                );
                return BrsInvalid.Instance;
            },
        })
    );

    /** Removes all fields from the node */
    // ToDo: Built-in fields shouldn't be removed
    private clear = new Callable("clear", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter) => {
            this.fields.clear();
            return BrsInvalid.Instance;
        },
    });

    /** Removes a given item from the node */
    // ToDo: Built-in fields shouldn't be removed
    private delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, str: BrsString) => {
            this.fields.delete(str.value.toLowerCase());
            return BrsBoolean.True; //RBI always returns true
        },
    });

    /** Given a key and value, adds an item to the node if it doesn't exist
     * Or replaces the value of a key that already exists in the node
     */
    private addReplace = new Callable("addreplace", {
        signature: {
            args: [
                new StdlibArgument("key", ValueKind.String),
                new StdlibArgument("value", ValueKind.Dynamic),
            ],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, key: BrsString, value: BrsType) => {
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
        impl: (interpreter: Interpreter) => {
            return new Int32(this.fields.size);
        },
    });

    /** Returns a boolean indicating whether or not a given key exists in the node */
    private doesExist = new Callable("doesexist", {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, str: BrsString) => {
            return this.get(str) !== BrsInvalid.Instance ? BrsBoolean.True : BrsBoolean.False;
        },
    });

    /** Appends a new node to another. If two keys are the same, the value of the original AA is replaced with the new one. */
    private append = new Callable("append", {
        signature: {
            args: [new StdlibArgument("obj", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (interpreter: Interpreter, obj: BrsType) => {
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
    protected keys = new Callable("keys", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            return new RoArray(this.getElements());
        },
    });

    /** Returns an array of key/value pairs in lexicographical order of key. */
    protected items = new Callable("items", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            return new RoArray(
                this.getElements().map((key: BrsString) => {
                    return toAssociativeArray({ key: key, value: this.get(key) });
                })
            );
        },
    });

    /** Given a key, returns the value associated with that key. This method is case insensitive. */
    private lookup = new Callable("lookup", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, key: BrsString) => {
            let lKey = key.value.toLowerCase();
            return this.get(new BrsString(lKey));
        },
    });

    /** Given a key, returns the value associated with that key. This method is case insensitive. */
    private lookupCI = new Callable("lookupCI", this.lookup.signatures[0]);

    /** Adds a new field to the node, if the field already exists it doesn't change the current value. */
    private addField = new Callable("addfield", {
        signature: {
            args: [
                new StdlibArgument("fieldname", ValueKind.String),
                new StdlibArgument("type", ValueKind.String),
                new StdlibArgument("alwaysnotify", ValueKind.Boolean),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (
            interpreter: Interpreter,
            fieldname: BrsString,
            type: BrsString,
            alwaysnotify: BrsBoolean
        ) => {
            let defaultValue = getBrsValueFromFieldType(type.value);
            let fieldKind = FieldKind.fromString(type.value);

            if (defaultValue !== Uninitialized.Instance && !this.fields.has(fieldname.value)) {
                this.set(fieldname, defaultValue, alwaysnotify.toBoolean(), fieldKind);
            }

            return BrsBoolean.True;
        },
    });

    /** Adds one or more fields defined as an associative aray of key values. */
    private addFields = new Callable("addfields", {
        signature: {
            args: [new StdlibArgument("fields", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fields: RoAssociativeArray) => {
            if (!(fields instanceof RoAssociativeArray)) {
                return BrsBoolean.False;
            }

            fields.getValue().forEach((value, key) => {
                let fieldName = new BrsString(key);
                if (!this.fields.has(key)) {
                    this.set(fieldName, value);
                }
            });

            return BrsBoolean.True;
        },
    });

    /** Returns the value of the field passed as argument, if the field doesn't exist it returns invalid. */
    private getField = new Callable("getfield", {
        signature: {
            args: [new StdlibArgument("fieldname", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, fieldname: BrsString) => {
            return this.get(fieldname);
        },
    });

    /** Returns the names and values of all the fields in the node. */
    private getFields = new Callable("getfields", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
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
    protected hasField = new Callable("hasfield", {
        signature: {
            args: [new StdlibArgument("fieldname", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldname: BrsString) => {
            return this.fields.has(fieldname.value.toLowerCase())
                ? BrsBoolean.True
                : BrsBoolean.False;
        },
    });

    /** Registers a callback to be executed when the value of the field changes */
    private observeField = new Callable(
        "observefield",
        {
            signature: {
                args: [
                    new StdlibArgument("fieldname", ValueKind.String),
                    new StdlibArgument("functionname", ValueKind.String),
                    new StdlibArgument("infoFields", ValueKind.Object, BrsInvalid.Instance),
                ],
                returns: ValueKind.Boolean,
            },
            impl: (
                interpreter: Interpreter,
                fieldName: BrsString,
                functionName: BrsString,
                infoFields: RoArray
            ) => {
                let result = BrsBoolean.False;
                const field = this.fields.get(fieldName.value.toLowerCase());
                if (field instanceof Field) {
                    const callableFunction = interpreter.getCallableFunction(functionName.value);
                    const subscriber = interpreter.environment.hostNode;
                    if (!subscriber) {
                        const location = interpreter.formatLocation();
                        interpreter.stderr.write(
                            `warning,BRIGHTSCRIPT: ERROR: roSGNode.ObserveField: no active host node: ${location}`
                        );
                    } else if (callableFunction instanceof Callable) {
                        field.addObserver(
                            "unscoped",
                            interpreter,
                            callableFunction,
                            subscriber,
                            this,
                            fieldName,
                            infoFields
                        );
                        result = BrsBoolean.True;
                    }
                }
                return result;
            },
        },
        {
            signature: {
                args: [
                    new StdlibArgument("fieldname", ValueKind.String),
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
                let result = BrsBoolean.False;
                // TODO: Implement this signature
                return result;
            },
        }
    );

    /**
     * Removes all observers of a given field, regardless of whether or not the host node is the subscriber.
     */
    private unobserveField = new Callable("unobservefield", {
        signature: {
            args: [new StdlibArgument("fieldname", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldname: BrsString, functionname: BrsString) => {
            if (!interpreter.environment.hostNode) {
                let location = interpreter.formatLocation();
                interpreter.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGNode.unObserveField: no active host node: ${location}`
                );
                return BrsBoolean.False;
            }

            let field = this.fields.get(fieldname.value.toLowerCase());
            if (field instanceof Field) {
                field.removeUnscopedObservers();
            }
            // returns true, even if the field doesn't exist
            return BrsBoolean.True;
        },
    });

    private observeFieldScoped = new Callable("observeFieldSCoped", {
        signature: {
            args: [
                new StdlibArgument("fieldname", ValueKind.String),
                new StdlibArgument("functionname", ValueKind.String),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldname: BrsString, functionname: BrsString) => {
            let field = this.fields.get(fieldname.value.toLowerCase());
            if (field instanceof Field) {
                let callableFunction = interpreter.getCallableFunction(functionname.value);
                let subscriber = interpreter.environment.hostNode;
                if (!subscriber) {
                    let location = interpreter.formatLocation();
                    interpreter.stderr.write(
                        `warning,BRIGHTSCRIPT: ERROR: roSGNode.ObserveField: no active host node: ${location}`
                    );
                    return BrsBoolean.False;
                }

                if (callableFunction instanceof Callable && subscriber) {
                    field.addObserver(
                        "scoped",
                        interpreter,
                        callableFunction,
                        subscriber,
                        this,
                        fieldname
                    );
                } else {
                    return BrsBoolean.False;
                }
            }
            return BrsBoolean.True;
        },
    });

    private unobserveFieldScoped = new Callable("unobserveFieldScoped", {
        signature: {
            args: [new StdlibArgument("fieldname", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldname: BrsString, functionname: BrsString) => {
            if (!interpreter.environment.hostNode) {
                let location = interpreter.formatLocation();
                interpreter.stderr.write(
                    `warning,BRIGHTSCRIPT: ERROR: roSGNode.unObserveField: no active host node: ${location}`
                );
                return BrsBoolean.False;
            }

            let field = this.fields.get(fieldname.value.toLowerCase());
            if (field instanceof Field) {
                field.removeScopedObservers(interpreter.environment.hostNode);
            }
            // returns true, even if the field doesn't exist
            return BrsBoolean.True;
        },
    });

    /** Removes the given field from the node */
    /** TODO: node built-in fields shouldn't be removable (i.e. id, change, focusable,) */
    private removeField = new Callable("removefield", {
        signature: {
            args: [new StdlibArgument("fieldname", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldname: BrsString) => {
            this.fields.delete(fieldname.value.toLowerCase());
            return BrsBoolean.True; //RBI always returns true
        },
    });

    /** Updates the value of an existing field only if the types match. */
    private setField = new Callable("setfield", {
        signature: {
            args: [
                new StdlibArgument("fieldname", ValueKind.String),
                new StdlibArgument("value", ValueKind.Dynamic),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldname: BrsString, value: BrsType) => {
            let field = this.fields.get(fieldname.value.toLowerCase());
            if (!field) {
                return BrsBoolean.False;
            }

            if (!field.canAcceptValue(value)) {
                return BrsBoolean.False;
            }

            this.set(fieldname, value);
            return BrsBoolean.True;
        },
    });

    /** Updates the value of multiple existing field only if the types match. */
    private setFields = new Callable("setfields", {
        signature: {
            args: [new StdlibArgument("fields", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fields: RoAssociativeArray) => {
            if (!(fields instanceof RoAssociativeArray)) {
                return BrsBoolean.False;
            }

            fields.getValue().forEach((value, key) => {
                let fieldName = new BrsString(key);
                if (this.fields.has(key)) {
                    this.set(fieldName, value);
                }
            });

            return BrsBoolean.True;
        },
    });

    /* Updates the value of multiple existing field only if the types match.
    In contrast to setFields method, update always return Uninitialized */
    private update = new Callable("update", {
        signature: {
            args: [
                new StdlibArgument("aa", ValueKind.Object),
                new StdlibArgument("createFields", ValueKind.Boolean, BrsBoolean.False),
            ],
            returns: ValueKind.Uninitialized,
        },
        impl: (interpreter: Interpreter, aa: RoAssociativeArray, createFields: BrsBoolean) => {
            if (!(aa instanceof RoAssociativeArray)) {
                return Uninitialized.Instance;
            }

            aa.getValue().forEach((value, key) => {
                let fieldName = new BrsString(key);
                if (this.fields.has(key.toLowerCase()) || createFields.toBoolean()) {
                    this.set(fieldName, value);
                }
            });

            return Uninitialized.Instance;
        },
    });

    /* Return the current number of children in the subject node list of children.
    This is always a non-negative number. */
    private getChildCount = new Callable("getchildcount", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            return new Int32(this.children.length);
        },
    });

    /* Adds a child node to the end of the subject node list of children so that it is
    traversed last (of those children) during render. */
    private appendChild = new Callable("appendchild", {
        signature: {
            args: [new StdlibArgument("child", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child: BrsType) => {
            return BrsBoolean.from(this.appendChildToParent(child));
        },
    });

    /* Retrieves the number of child nodes specified by num_children from the subject
    node, starting at the position specified by index. Returns an array of the child nodes
    retrieved. If num_children is -1, return all the children. */
    private getChildren = new Callable("getchildren", {
        signature: {
            args: [
                new StdlibArgument("num_children", ValueKind.Int32),
                new StdlibArgument("index", ValueKind.Int32),
            ],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, num_children: Int32, index: Int32) => {
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
    private removeChild = new Callable("removechild", {
        signature: {
            args: [new StdlibArgument("child", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child: BrsType) => {
            return BrsBoolean.from(this.removeChildByReference(child));
        },
    });
    /* If the subject node has been added to a parent node list of children,
    return the parent node, otherwise return invalid.*/
    private getParent = new Callable("getparent", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            return this.parent;
        },
    });

    /* Creates a child node of type nodeType, and adds the new node to the end of the
    subject node list of children */
    private createChild = new Callable("createchild", {
        signature: {
            args: [new StdlibArgument("nodetype", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, nodetype: BrsString) => {
            // currently we can't create a custom subclass object of roSGNode,
            // so we'll always create generic RoSGNode object as child
            let child = createNodeByType(interpreter, nodetype);
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

    private replaceChild = new Callable("replacechild", {
        signature: {
            args: [
                new StdlibArgument("newchild", ValueKind.Dynamic),
                new StdlibArgument("index", ValueKind.Int32),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, newchild: BrsType, index: Int32) => {
            return BrsBoolean.from(this.replaceChildAtIndex(newchild, index));
        },
    });

    /**
     * Removes the child nodes specified by child_nodes from the subject node. Returns
     * true if the child nodes were successfully removed.
     */
    private removeChildren = new Callable("removechildren", {
        signature: {
            args: [new StdlibArgument("child_nodes", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child_nodes: BrsType) => {
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
    private removeChildrenIndex = new Callable("removechildrenindex", {
        signature: {
            args: [
                new StdlibArgument("num_children", ValueKind.Int32),
                new StdlibArgument("index", ValueKind.Int32),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, num_children: Int32, index: Int32) => {
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
    private getChild = new Callable("getchild", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, index: Int32) => {
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
    private appendChildren = new Callable("appendchildren", {
        signature: {
            args: [new StdlibArgument("child_nodes", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child_nodes: BrsType) => {
            if (child_nodes instanceof RoArray) {
                let childNodesElements = child_nodes.getElements();
                if (childNodesElements.length !== 0) {
                    childNodesElements.forEach((childNode) => {
                        if (childNode instanceof RoSGNode) {
                            // Remove if it exists to reappend
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
    private createChildren = new Callable("createchildren", {
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
    private replaceChildren = new Callable("replacechildren", {
        signature: {
            args: [
                new StdlibArgument("child_nodes", ValueKind.Dynamic),
                new StdlibArgument("index", ValueKind.Int32),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child_nodes: BrsType, index: Int32) => {
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
    private insertChildren = new Callable("insertchildren", {
        signature: {
            args: [
                new StdlibArgument("child_nodes", ValueKind.Dynamic),
                new StdlibArgument("index", ValueKind.Int32),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child_nodes: BrsType, index: Int32) => {
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
    private insertChild = new Callable("insertchild", {
        signature: {
            args: [
                new StdlibArgument("child", ValueKind.Dynamic),
                new StdlibArgument("index", ValueKind.Int32),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, child: BrsType, index: Int32) => {
            return BrsBoolean.from(this.insertChildAtIndex(child, index));
        },
    });

    /**
     * If the subject node has a child node in the index position, remove that child
     * node from the subject node list of children.
     */
    private removeChildIndex = new Callable("removechildindex", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, index: Int32) => {
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
     * transformation factor fields, in which case, the reparenting operation could cause the node to jump to a
     * new position on the screen.
     */
    private reparent = new Callable("reparent", {
        signature: {
            args: [
                new StdlibArgument("newParent", ValueKind.Dynamic),
                new StdlibArgument("adjustTransform", ValueKind.Boolean),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, newParent: BrsType, adjustTransform: BrsBoolean) => {
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

    /* Returns true if the subject node has the remote control focus, and false otherwise */
    private hasFocus = new Callable("hasfocus", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter) => {
            return BrsBoolean.from(interpreter.environment.getFocusedNode() === this);
        },
    });

    private boundingRect = new Callable("boundingRect", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            return toAssociativeArray({ x: 0, y: 0, width: 0, height: 0 });
        },
    });

    /**
     * Starting with a leaf node, traverses upward through the parents until it reaches
     * a node without a parent (root node).
     * @param {RoSGNode} node The leaf node to create the tree with
     * @returns RoSGNode[] The parent chain starting with root-most parent
     */
    private createPath(node: RoSGNode): RoSGNode[] {
        let path: RoSGNode[] = [node];

        while (node.parent instanceof RoSGNode) {
            path.push(node.parent);
            node = node.parent;
        }

        return path.reverse();
    }

    /**
     *  If on is set to true, sets the current remote control focus to the subject node,
     *  also automatically removing it from the node on which it was previously set.
     *  If on is set to false, removes focus from the subject node if it had it.
     *
     *  It also runs through all of the ancestors of the node that was focused prior to this call,
     *  and the newly focused node, and sets the `focusedChild` field of each to reflect the new state.
     */
    private setFocus = new Callable("setfocus", {
        signature: {
            args: [new StdlibArgument("on", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, on: BrsBoolean) => {
            let focusedChildString = new BrsString("focusedchild");
            let currFocusedNode = interpreter.environment.getFocusedNode();

            if (on.toBoolean()) {
                interpreter.environment.setFocusedNode(this);

                // Get the focus chain, with lowest ancestor first.
                let newFocusChain = this.createPath(this);

                // If there's already a focused node somewhere, we need to remove focus
                // from it and its ancestors.
                if (currFocusedNode instanceof RoSGNode) {
                    // Get the focus chain, with root-most ancestor first.
                    let currFocusChain = this.createPath(currFocusedNode);

                    // Find the lowest common ancestor (LCA) between the newly focused node
                    // and the current focused node.
                    let lcaIndex = 0;
                    while (lcaIndex < newFocusChain.length && lcaIndex < currFocusChain.length) {
                        if (currFocusChain[lcaIndex] !== newFocusChain[lcaIndex]) break;
                        lcaIndex++;
                    }

                    // Unset all of the not-common ancestors of the current focused node.
                    for (let i = lcaIndex; i < currFocusChain.length; i++) {
                        currFocusChain[i].set(focusedChildString, BrsInvalid.Instance);
                    }
                }

                // Set the focusedChild for each ancestor to the next node in the chain,
                // which is the current node's child.
                for (let i = 0; i < newFocusChain.length - 1; i++) {
                    newFocusChain[i].set(focusedChildString, newFocusChain[i + 1]);
                }

                // Finally, set the focusedChild of the newly focused node to itself (to mimic RBI behavior).
                this.set(focusedChildString, this);
            } else {
                interpreter.environment.setFocusedNode(BrsInvalid.Instance);

                // If we're unsetting focus on ourself, we need to unset it on all ancestors as well.
                if (currFocusedNode === this) {
                    // Get the focus chain, with root-most ancestor first.
                    let currFocusChain = this.createPath(currFocusedNode);
                    currFocusChain.forEach((node) => {
                        node.set(focusedChildString, BrsInvalid.Instance);
                    });
                } else {
                    // If the node doesn't have focus already, and it's not gaining focus,
                    // we don't need to notify any ancestors.
                    this.set(focusedChildString, BrsInvalid.Instance);
                }
            }

            return BrsBoolean.False; //brightscript always returns false for some reason
        },
    });

    /**
     *  Returns true if the subject node or any of its descendants in the SceneGraph node tree
     *  has remote control focus
     */
    private isInFocusChain = new Callable("isinfocuschain", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter) => {
            // loop through all children DFS and check if any children has focus
            if (interpreter.environment.getFocusedNode() === this) {
                return BrsBoolean.True;
            }

            return BrsBoolean.from(this.isChildrenFocused(interpreter));
        },
    });

    /* Returns the node that is a descendant of the nearest component ancestor of the subject node whose id field matches the given name,
        otherwise return invalid.
        Implemented as a DFS from the top of parent hierarchy to match the observed behavior as opposed to the BFS mentioned in the docs. */
    private findNode = new Callable("findnode", {
        signature: {
            args: [new StdlibArgument("name", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, name: BrsString) => {
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
    private isSubtype = new Callable("issubtype", {
        signature: {
            args: [new StdlibArgument("nodeType", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, nodeType: BrsString) => {
            return BrsBoolean.from(isSubtypeCheck(this.nodeSubtype, nodeType.value));
        },
    });

    /* Checks whether the subtype of the subject node is a descendant of the subtype nodeType
     * in the SceneGraph node class hierarchy.
     */
    private parentSubtype = new Callable("parentsubtype", {
        signature: {
            args: [new StdlibArgument("nodeType", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, nodeType: BrsString) => {
            const parentType = subtypeHierarchy.get(nodeType.value.toLowerCase());
            if (parentType) {
                return new BrsString(parentType);
            }
            return BrsInvalid.Instance;
        },
    });

    /* Returns a Boolean value indicating whether the roSGNode parameter
            refers to the same node object as this node */
    private isSameNode = new Callable("issamenode", {
        signature: {
            args: [new StdlibArgument("roSGNode", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, roSGNode: RoSGNode) => {
            return BrsBoolean.from(this === roSGNode);
        },
    });

    /* Returns the subtype of this node as specified when it was created */
    private subtype = new Callable("subtype", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(this.nodeSubtype);
        },
    });

    /* Takes a list of models and creates fields with default values, and adds them to this.fields. */
    protected registerDefaultFields(fields: FieldModel[]) {
        fields.forEach((field) => {
            let fieldType: FieldKind | undefined;
            let value: BrsType | undefined;
            if (field.name === "change") {
                value = toAssociativeArray({ Index1: 0, Index2: 0, Operation: "none" });
                fieldType = FieldKind.AssocArray;
            } else if (field.name === "font") {
                value = NodeFactory.createNode(BrsNodeType.Font) ?? BrsInvalid.Instance;
                fieldType = FieldKind.Node;
            } else {
                value = getBrsValueFromFieldType(field.type, field.value);
                fieldType = FieldKind.fromString(field.type);
            }
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
}

// A node that represents the m.global, referenced by all other nodes
export const mGlobal = new RoSGNode([]);

export function createNodeByType(interpreter: Interpreter, type: BrsString): RoSGNode | BrsInvalid {
    // If this is a built-in node component, then return it.
    let node = NodeFactory.createNode(type.value as BrsNodeType);
    if (node) {
        return node;
    }

    let typeDef = interpreter.environment.nodeDefMap.get(type.value.toLowerCase());
    if (typeDef) {
        //use typeDef object to tack on all the bells & whistles of a custom node
        let typeDefStack: ComponentDefinition[] = [];
        let currentEnv = typeDef.environment?.createSubEnvironment();

        // Adding all component extensions to the stack to call init methods
        // in the correct order.
        typeDefStack.push(typeDef);
        while (typeDef) {
            // Add the current typedef to the subtypeHierarchy
            subtypeHierarchy.set(typeDef.name!.toLowerCase(), typeDef.extends || "Node");

            typeDef = interpreter.environment.nodeDefMap.get(typeDef.extends?.toLowerCase());
            if (typeDef) typeDefStack.push(typeDef);
        }

        // Start from the "basemost" component of the tree.
        typeDef = typeDefStack.pop();

        // If this extends a built-in node component, create it.
        let node = NodeFactory.createNode(typeDef!.extends as BrsNodeType, type.value);

        // Default to Node as parent.
        if (!node) {
            node = new RoSGNode([], type.value);
        }
        let mPointer = new RoAssociativeArray([]);
        currentEnv?.setM(new RoAssociativeArray([]));

        // Add children, fields and call each init method starting from the
        // "basemost" component of the tree.
        while (typeDef) {
            let init: BrsType;

            interpreter.inSubEnv((subInterpreter) => {
                addChildren(subInterpreter, node!, typeDef!);
                addFields(subInterpreter, node!, typeDef!);
                return BrsInvalid.Instance;
            }, currentEnv);

            interpreter.inSubEnv((subInterpreter) => {
                init = subInterpreter.getInitMethod();
                return BrsInvalid.Instance;
            }, typeDef.environment);

            interpreter.inSubEnv((subInterpreter) => {
                subInterpreter.environment.hostNode = node;

                mPointer.set(new BrsString("top"), node!);
                mPointer.set(new BrsString("global"), mGlobal);
                subInterpreter.environment.setM(mPointer);
                subInterpreter.environment.setRootM(mPointer);
                node!.m = mPointer;
                if (init instanceof Callable) {
                    init.call(subInterpreter);
                }
                return BrsInvalid.Instance;
            }, currentEnv);

            typeDef = typeDefStack.pop();
        }

        return node;
    } else {
        interpreter.stderr.write(
            `warning,BRIGHTSCRIPT: ERROR: roSGNode: Failed to create roSGNode with type ${
                type.value
            }: ${interpreter.formatLocation()}`
        );
        return BrsInvalid.Instance;
    }
}

function addFields(interpreter: Interpreter, node: RoSGNode, typeDef: ComponentDefinition) {
    let fields = typeDef.fields;
    for (let [key, value] of Object.entries(fields)) {
        if (value instanceof Object) {
            // Roku throws a run-time error if any fields are duplicated between inherited components.
            // TODO: throw exception when fields are duplicated.
            let fieldName = new BrsString(key);

            let addField = node.getMethod("addField");
            if (addField) {
                addField.call(
                    interpreter,
                    fieldName,
                    new BrsString(value.type),
                    BrsBoolean.from(value.alwaysNotify === "true")
                );
            }

            // set default value if it was specified in xml
            let setField = node.getMethod("setField");
            if (setField && value.value) {
                setField.call(
                    interpreter,
                    fieldName,
                    getBrsValueFromFieldType(value.type, value.value)
                );
            }

            // Add the onChange callback if it exists.
            if (value.onChange) {
                let field = node.getNodeFields().get(fieldName.value.toLowerCase());
                let callableFunction = interpreter.getCallableFunction(value.onChange);
                if (callableFunction instanceof Callable && field) {
                    // observers set via `onChange` can never be removed, despite RBI's documentation claiming
                    // that "[i]t is equivalent to calling the ifSGNodeField observeField() method".
                    field.addObserver(
                        "permanent",
                        interpreter,
                        callableFunction,
                        node,
                        node,
                        fieldName
                    );
                }
            }
        }
    }
}

function addChildren(
    interpreter: Interpreter,
    node: RoSGNode,
    typeDef: ComponentDefinition | ComponentNode
) {
    let children = typeDef.children;
    let appendChild = node.getMethod("appendchild");

    for (let child of children) {
        let newChild = createNodeByType(interpreter, new BrsString(child.name));
        if (newChild instanceof RoSGNode) {
            if (appendChild) {
                appendChild.call(interpreter, newChild);
                let setField = newChild.getMethod("setfield");
                if (setField) {
                    let nodeFields = newChild.getNodeFields();
                    for (let [key, value] of Object.entries(child.fields)) {
                        let field = nodeFields.get(key.toLowerCase());
                        if (field) {
                            setField.call(
                                interpreter,
                                new BrsString(key),
                                // use the field type to construct the field value
                                getBrsValueFromFieldType(field.getType(), value)
                            );
                        }
                    }
                }
            }

            if (child.children.length > 0) {
                // we need to add the child's own children
                addChildren(interpreter, newChild, child);
            }
        }
    }
}
