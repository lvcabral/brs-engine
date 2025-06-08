import { ValueKind, BrsString, BrsInvalid, getValueKindFromFieldType, BrsBoolean } from "../BrsType";
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
    Task,
    jsValueOf,
    fromAssociativeArray,
    FlexObject,
    BrsNumber,
    BrsComponent,
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
    running?: boolean;
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
    Time = "time",
    Rect2D = "rect2d",
}

export namespace FieldKind {
    export function fromString(type: string): FieldKind | undefined {
        switch (type.toLowerCase()) {
            case "interface":
                return FieldKind.Interface;
            case "array":
            case "roarray":
            case "floatarray":
            case "intarray":
            case "timearray":
            case "vector2d":
                return FieldKind.Array;
            case "rect2d":
                return FieldKind.Rect2D;
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
            case "time":
                return FieldKind.Time;
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
        this.value = this.convertValue(value);
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

        value = this.convertValue(value);
        let oldValue = this.value;
        this.value = value;
        if (notify && (this.alwaysNotify || !this.isEqual(oldValue, value))) {
            this.permanentObservers.forEach(this.executeCallbacks.bind(this));
            this.unscopedObservers.forEach(this.executeCallbacks.bind(this));
            this.scopedObservers.forEach((callbacks) => callbacks.map(this.executeCallbacks.bind(this)));
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
            (isBrsString(this.value) && isBrsBoolean(value)) ||
            (isBrsBoolean(this.value) && isBrsString(value))
        ) {
            return true;
        } else if (this.type === FieldKind.Rect2D && value instanceof RoArray) {
            return value.elements.length === 4 && value.elements.every((element) => isAnyNumber(element));
        } else if (this.type === FieldKind.Rect2D && value instanceof RoAssociativeArray) {
            const valueObj = fromAssociativeArray(value);
            return (
                valueObj &&
                typeof valueObj.x === "number" &&
                typeof valueObj.y === "number" &&
                typeof valueObj.width === "number" &&
                typeof valueObj.height === "number"
            );
        }
        const result = this.type === FieldKind.fromBrsType(value);
        return result;
    }

    addObserver(
        mode: "permanent" | "unscoped" | "scoped",
        interpreter: Interpreter,
        callable: Callable | RoMessagePort,
        target: RoSGNode,
        fieldName: BrsString,
        infoFields?: RoArray
    ) {
        // Once a field is accessed, it is no longer hidden.
        this.hidden = false;
        const subscriber = interpreter.environment.hostNode ?? target;
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
        return this.permanentObservers.length > 0 || this.unscopedObservers.length > 0 || this.scopedObservers.size > 0;
    }

    isPortObserved(hostNode: Task) {
        return (
            this.unscopedObservers.some(
                (callback) =>
                    callback.callable instanceof RoMessagePort &&
                    callback.hostNode instanceof Task &&
                    callback.hostNode.id === hostNode.id
            ) ||
            this.scopedObservers.get(hostNode)?.some((callback) => callback.callable instanceof RoMessagePort) ||
            false
        );
    }

    private convertValue(value: BrsType) {
        if (isAnyNumber(value) && value.kind !== getValueKindFromFieldType(this.type)) {
            if (isBoxedNumber(value)) {
                value = value.unbox();
            }
            value = this.convertNumber(value);
        } else if (isBrsBoolean(value) && this.type === FieldKind.String) {
            value = new BrsString(value.toBoolean() ? "1" : "0");
        } else if (isBrsString(value) && this.type === FieldKind.Boolean) {
            value = BrsBoolean.from(value.getValue().toLowerCase() === "true");
        } else if (this.type === FieldKind.Rect2D) {
            value = this.convertRect2D(value);
        }
        if (isBoxable(value)) {
            value = value.box();
        }
        return value;
    }

    private convertNumber(value: BrsNumber): BrsType {
        let newValue: BrsType = value;
        if (this.type === FieldKind.Float) {
            newValue = new Float(value.getValue());
        } else if (this.type === FieldKind.Int32) {
            newValue = new Int32(value.getValue());
        } else if (this.type === FieldKind.Int64) {
            newValue = new Int64(value.getValue());
        } else if (this.type === FieldKind.Double) {
            newValue = new Double(value.getValue());
        } else if (this.type === FieldKind.String) {
            newValue = new BrsString(value.toString());
        }
        return newValue;
    }

    private convertRect2D(value: BrsType): RoAssociativeArray {
        const rectObject: FlexObject = { x: 0, y: 0, width: 0, height: 0 };
        if (value instanceof RoArray) {
            const rectArray = jsValueOf(value);
            if (
                Array.isArray(rectArray) &&
                rectArray.length === 4 &&
                rectArray.every((item: any) => typeof item === "number")
            ) {
                rectObject.x = rectArray[0];
                rectObject.y = rectArray[1];
                rectObject.width = rectArray[2];
                rectObject.height = rectArray[3];
            }
        } else if (value instanceof RoAssociativeArray) {
            const rectValue = fromAssociativeArray(value);
            if (
                typeof rectValue.x === "number" &&
                typeof rectValue.y === "number" &&
                typeof rectValue.width === "number" &&
                typeof rectValue.height === "number"
            ) {
                rectObject.x = rectValue.x;
                rectObject.y = rectValue.y;
                rectObject.width = rectValue.width;
                rectObject.height = rectValue.height;
            }
        }
        return toAssociativeArray(rectObject);
    }

    private isEqual(oldValue: BrsType, newValue: BrsType): boolean {
        if (isAnyNumber(oldValue) && isAnyNumber(newValue)) {
            return oldValue.getValue() === newValue.getValue();
        } else if (isBrsString(oldValue) && isBrsString(newValue)) {
            return oldValue.getValue() === newValue.getValue();
        } else if (isBrsBoolean(oldValue) && isBrsBoolean(newValue)) {
            return oldValue.toBoolean() === newValue.toBoolean();
        } else if (oldValue instanceof BrsComponent && newValue instanceof BrsComponent) {
            return oldValue === newValue;
        } else {
            return oldValue.equalTo(newValue).toBoolean();
        }
    }

    private executeCallbacks(callback: BrsCallback) {
        if (callback.running) {
            return;
        }
        callback.running = true;
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
        let event = new RoSGNodeEvent(eventParams.node, eventParams.fieldName, this.value, infoFields);

        if (callable instanceof RoMessagePort) {
            callable.pushMessage(event);
            callback.running = false;
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
                    subInterpreter.environment.define(Scope.Function, signature.args[0].name.text, event);
                    impl(subInterpreter, event);
                } else {
                    // Check whether the callback has a signature without parameters.
                    // Silently ignore if the callback has no signature that matches.
                    callable.getFirstSatisfiedSignature([])?.impl(subInterpreter);
                }
            } catch (err) {
                if (!(err instanceof BlockEnd)) {
                    callback.running = false;
                    throw err;
                }
            }
            callback.running = false;
            return BrsInvalid.Instance;
        }, environment);
    }
}
