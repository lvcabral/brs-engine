import { BrsString, BrsType, Callable, Environment, Interpreter, isUnboxable, RoArray, RoMessagePort, ValueKind } from "brs-engine";
import { Node } from "./nodes/Node";

/** This interface is used to define a callback for field change notifications and events. */
export interface BrsCallback {
    interpreter: Interpreter;
    environment: Environment;
    hostNode: Node;
    callable: Callable | RoMessagePort;
    eventParams: {
        fieldName: BrsString;
        node: Node;
        infoFields?: RoArray;
    };
    running?: boolean;
}

/** This is used to define a field (usually a default/built-in field in a component definition). */
export type FieldModel = {
    name: string;
    type: string;
    value?: string;
    alwaysNotify?: boolean;
    system?: boolean;
    hidden?: boolean;
};

export type FieldAlias = {
    nodeId: string;
    fieldName: string;
};

/** Set of value types that a field could be. */
export enum FieldKind {
    Interface = "interface",
    Array = "array",
    AssocArray = "assocarray",
    Int32 = "integer",
    IntArray = "intarray",
    Int64 = "longinteger",
    Double = "double",
    Float = "float",
    FloatArray = "floatarray",
    Font = "font",
    Node = "node",
    Boolean = "boolean",
    BoolArray = "boolarray",
    String = "string",
    StringArray = "stringarray",
    Function = "function",
    Object = "object",
    Color = "color",
    ColorArray = "colorarray",
    Time = "time",
    TimeArray = "timearray",
    Rect2D = "rect2d",
}

export namespace FieldKind {
    export function fromString(type: string): FieldKind | undefined {
        switch (type.toLowerCase()) {
            case "interface":
                return FieldKind.Interface;
            case "array":
            case "roarray":
            case "nodearray":
            case "vector2d":
            case "vector2darray":
            case "rect2darray":
                return FieldKind.Array;
            case "boolarray":
                return FieldKind.BoolArray;
            case "colorarray":
                return FieldKind.ColorArray;
            case "intarray":
                return FieldKind.IntArray;
            case "floatarray":
                return FieldKind.FloatArray;
            case "stringarray":
                return FieldKind.StringArray;
            case "timearray":
                return FieldKind.TimeArray;
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
                if (brsType instanceof Node && brsType.nodeSubtype.toLowerCase() === "font") {
                    return FieldKind.Font;
                }
                return FieldKind.Node;
            default:
                return undefined;
        }
    }
}
