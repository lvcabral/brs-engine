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
    observer: Callable | RoMessagePort;
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

/** Represents an alias for one or more fields on child nodes. */
export type FieldAlias = {
    aliasName: string;
    targets: FieldAliasTarget[];
};

export type FieldAliasTarget = {
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
    Vector2D = "vector2d",
    Vector2DArray = "vector2darray",
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
            case "vector2d":
                return FieldKind.Vector2D;
            case "vector2darray":
                return FieldKind.Vector2DArray;
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
        const componentName = brsType.getComponentName();
        switch (componentName.toLowerCase()) {
            case "roarray":
                return FieldKind.Array;
            case "roassociativearray":
                return FieldKind.AssocArray;
            case "rosgnode": {
                const node = brsType as Node;
                if (node.nodeType.toLowerCase() === "font") {
                    return FieldKind.Font;
                }
                return FieldKind.Node;
            }
            default:
                return undefined;
        }
    }
}

// Definition of ContentNode-like type to avoid circular dependencies
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

// Definition of Font-like type to avoid circular dependency
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

// Definition of Task-like type to avoid circular dependency
type TaskLike = Node & { threadId: number; active: boolean; started: boolean };

export function isTaskLike(value: any): value is TaskLike {
    return (
        value instanceof Node &&
        typeof (value as TaskLike).threadId === "number" &&
        typeof (value as TaskLike).active === "boolean" &&
        typeof (value as TaskLike).started === "boolean"
    );
}

/** Represents an observed field with optional info fields. */
export type ObservedField = { name: string; info?: string[] };

// Thread information type
export type ThreadInfo = {
    id: string;
    type: "Main" | "Render" | "Task";
    name?: string;
};

// Method call payload type
export type MethodCallPayload = {
    host: string;
    args?: any[];
};

export function isMethodCallPayload(obj: any): obj is MethodCallPayload {
    return obj && typeof obj.host === "string" && (obj.args === undefined || Array.isArray(obj.args));
}

// Observer scope definitions
export type ObserverScope = "permanent" | "scoped" | "unscoped";

/**
 * Type guard to check if a value is a valid ObserverScope.
 * @param value The value to check.
 * @returns True if the value is an ObserverScope, false otherwise.
 */
export function isObserverScope(value: any): value is ObserverScope {
    return value === "permanent" || value === "scoped" || value === "unscoped";
}

// Fresh field constants and state type
export const FreshFieldWindowMS = 10;
export const FreshFieldBudget = 4;

export type FreshFieldState = {
    remaining: number;
    timestamp: number;
};
