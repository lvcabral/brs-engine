import { ValueKind, BrsString, BrsInvalid, getValueKindFromFieldType } from "../BrsType";
import { RoSGNodeEvent } from "../events/RoSGNodeEvent";
import {
    BrsType,
    Font,
    isBrsString,
    Int32,
    Int64,
    Float,
    Double,
    RoArray,
    RoInvalid,
    RoAssociativeArray,
    toAssociativeArray,
    RoSGNode,
    RoMessagePort,
    isBrsBoolean,
    isBoxable,
    isUnboxable,
    isAnyNumber,
    isBoxedNumber,
} from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Environment, Scope } from "../../interpreter/Environment";
import { BlockEnd } from "../../parser/Statement";

interface BrsCallback {
    interpreter: Interpreter;
    environment: Environment;
    hostNode: RoSGNode;
    callable: Callable | RoMessagePort;
    eventParams: {
        fieldName: BrsString;
        node: RoSGNode;
        infoFields?: RoArray;
    };
}

/** Set of value types that a field could be. */
export enum FieldKind {
    Interface = "interface",
    Array = "array",
    AssocArray = "assocarray",
    Int32 = "integer",
    Int64 = "longinteger",
    Double = "double",
    Float = "float",
    Font = "font",
    Node = "node",
    Boolean = "boolean",
    String = "string",
    Function = "function",
    Object = "object",
    Color = "color",
}

export namespace FieldKind {
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
            case "font":
                return FieldKind.Font;
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
            case "object":
                return FieldKind.Object;
            case "color":
                return FieldKind.Color;
            default:
                return undefined;
        }
    }

    export function fromBrsType(brsType: BrsType): FieldKind | undefined {
        if (isUnboxable(brsType)) {
            return fromBrsType(brsType.unbox());
        }
        if (brsType.kind !== ValueKind.Object) {
            return fromString(ValueKind.toString(brsType.kind));
        }
        let componentName = brsType.getComponentName();
        switch (componentName.toLowerCase()) {
            case "roarray":
                return FieldKind.Array;
            case "roassociativearray":
                return FieldKind.AssocArray;
            case "rosgnode":
                return brsType instanceof Font ? FieldKind.Font : FieldKind.Node;
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

export type FieldAlias = {
    nodeId: string;
    fieldName: string;
};

export class Field {
    private readonly permanentObservers: BrsCallback[] = [];
    private readonly unscopedObservers: BrsCallback[] = [];
    private readonly scopedObservers: Map<RoSGNode, BrsCallback[]> = new Map();

    constructor(
        private value: BrsType,
        private readonly type: FieldKind,
        private readonly alwaysNotify: boolean,
        private hidden: boolean = false
    ) {
        this.value = this.constraintValue(value);
    }

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

    isAlwaysNotify() {
        return this.alwaysNotify;
    }

    setHidden(isHidden: boolean) {
        this.hidden = isHidden;
    }

    getType(): FieldKind {
        return this.type;
    }

    getValue(unhide: boolean = true): BrsType {
        // Once a field is accessed, it is no longer hidden.
        if (unhide) {
            this.hidden = false;
        }

        return this.value;
    }

    setValue(value: BrsType, notify: boolean = true) {
        // Once a field is set, it is no longer hidden.
        this.hidden = false;

        value = this.constraintValue(value);
        let oldValue = this.value;
        this.value = value;
        if (notify && (this.alwaysNotify || !this.isEqual(oldValue, value))) {
            this.permanentObservers.forEach(this.executeCallbacks.bind(this));
            this.unscopedObservers.forEach(this.executeCallbacks.bind(this));
            this.scopedObservers.forEach((callbacks) =>
                callbacks.map(this.executeCallbacks.bind(this))
            );
        }
    }

    canAcceptValue(value: BrsType) {
        // Objects are allowed to be set to invalid.
        const fieldIsObject = getValueKindFromFieldType(this.type) === ValueKind.Object;
        if (
            (fieldIsObject && (value === BrsInvalid.Instance || value instanceof RoInvalid)) ||
            (isAnyNumber(this.value) && isAnyNumber(value)) ||
            (isBrsString(this.value) && isBrsString(value)) ||
            (isBrsString(this.value) && isAnyNumber(value)) ||
            (isBrsString(this.value) && isBrsBoolean(value))
        ) {
            return true;
        }

        const result = this.type === FieldKind.fromBrsType(value);
        return result;
    }

    addObserver(
        mode: "permanent" | "unscoped" | "scoped",
        interpreter: Interpreter,
        callable: Callable | RoMessagePort,
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

    isObserved() {
        return (
            this.permanentObservers.length > 0 ||
            this.unscopedObservers.length > 0 ||
            this.scopedObservers.size > 0
        );
    }

    isPortObserved(hostNode: RoSGNode) {
        return (
            this.unscopedObservers.some((callback) => callback.callable instanceof RoMessagePort) ||
            this.scopedObservers
                .get(hostNode)
                ?.some((callback) => callback.callable instanceof RoMessagePort) ||
            false
        );
    }

    private constraintValue(value: BrsType) {
        if (isAnyNumber(value) && value.kind !== getValueKindFromFieldType(this.type)) {
            if (isBoxedNumber(value)) {
                value = value.unbox();
            }
            if (this.type === FieldKind.Float) {
                value = new Float(value.getValue());
            } else if (this.type === FieldKind.Int32) {
                value = new Int32(value.getValue());
            } else if (this.type === FieldKind.Int64) {
                value = new Int64(value.getValue());
            } else if (this.type === FieldKind.Double) {
                value = new Double(value.getValue());
            } else if (this.type === FieldKind.String) {
                value = new BrsString(value.toString());
            }
        } else if (isBrsBoolean(value) && this.type === FieldKind.String) {
            value = new BrsString(value.toBoolean() ? "1" : "0");
        }
        if (isBoxable(value)) {
            value = value.box();
        }
        return value;
    }

    private isEqual(oldValue: BrsType, newValue: BrsType) {
        if (isAnyNumber(oldValue) && isAnyNumber(newValue)) {
            return oldValue.getValue() === newValue.getValue();
        } else if (isBrsString(oldValue) && isBrsString(newValue)) {
            return oldValue.getValue() === newValue.getValue();
        } else if (isBrsBoolean(oldValue) && isBrsBoolean(newValue)) {
            return oldValue.toBoolean() === newValue.toBoolean();
        } else if (oldValue instanceof RoSGNode && newValue instanceof RoSGNode) {
            return oldValue === newValue && !newValue.changed;
        } else {
            return oldValue === newValue;
        }
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
                    fieldsMap.set(element.getValue(), hostNode.get(element));
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

        if (callable instanceof RoMessagePort) {
            callable.pushMessage(event);
            return;
        }

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
