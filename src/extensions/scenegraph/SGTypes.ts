import {
    BrsString,
    BrsType,
    Callable,
    Environment,
    Interpreter,
    isUnboxable,
    RoArray,
    RoMessagePort,
    ValueKind,
} from "brs-engine";
import { Node } from "./nodes/Node";
import type { Field } from "./nodes/Field";

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


/** Represents a field entry with its display name and Field object. */
export type FieldEntry = {
    name: string;
    field: Field;
};

/** Represents an alias for a field on a child node. */
export type FieldAlias = {
    nodeId: string;
    fieldName: string;
    aliasName: string;
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
    /**
     * Converts a string type name to a FieldKind enum value.
     * @param type Type name as string (case-insensitive)
     * @returns FieldKind enum value or undefined if not recognized
     */
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

    /**
     * Converts a BrsType to a FieldKind enum value.
     * Handles unboxing and component name mapping.
     * @param brsType BrsType instance to convert
     * @returns FieldKind enum value or undefined if not recognized
     */
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

// Definitions to avoid circular dependencies
type ContentNodeLike = Node & {
    addParentField(parentField: Field): void;
    removeParentField(parentField: Field): void;
};

/**
 * Type guard to check if a BrsType is a ContentNode.
 * Verifies presence of addParentField and removeParentField methods.
 * @param value BrsType to check
 * @returns True if value is a ContentNode, false otherwise
 */
export function isContentNode(value: BrsType): value is ContentNodeLike {
    return (
        value instanceof Node &&
        typeof (value as ContentNodeLike).addParentField === "function" &&
        typeof (value as ContentNodeLike).removeParentField === "function"
    );
}

type FontLike = Node & {
    setSize(fontSize: number): void;
    setSystemFont(fontName: string): boolean;
};

/**
 * Type guard to check if a BrsType is a Font node.
 * Verifies presence of setSize and setSystemFont methods.
 * @param value BrsType to check
 * @returns True if value is a Font node, false otherwise
 */
export function isFont(value: BrsType): value is FontLike {
    return (
        value instanceof Node &&
        typeof (value as FontLike).setSize === "function" &&
        typeof (value as FontLike).setSystemFont === "function"
    );
}

type TaskLike = Node & { id: number };

/**
 * Gets the task ID from a Node if it is a Task.
 * @param node Node to extract task ID from
 * @returns Task ID number or undefined if not a Task node
 */
export function getTaskId(node: Node): number | undefined {
    if (!(node instanceof Node) || !("id" in node)) {
        return undefined;
    }
    const maybeTask = node as Partial<TaskLike>;
    return typeof maybeTask.id === "number" ? maybeTask.id : undefined;
}
