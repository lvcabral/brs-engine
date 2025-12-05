import { BrsComponent, BrsNumber, BrsType, isBrsNumber, isStringComp, RoBoolean, RoInvalid, RoString } from ".";
import { Boxable } from "./Boxing";

/** Set of values supported in BrightScript. */
export enum ValueKind {
    Interface,
    Invalid,
    Boolean,
    String,
    Int32,
    Int64,
    Float,
    Double,
    Callable,
    Uninitialized,
    Dynamic,
    Void,
    Object,
}

export namespace ValueKind {
    /**
     * Converts a `ValueKind` enum member to a human-readable string representation.
     * @returns a textual representation of the provided value kind.
     */
    export function toString(kind: ValueKind, legacy: boolean = false): string {
        switch (kind) {
            case ValueKind.Interface:
                return "Interface";
            case ValueKind.Invalid:
                return legacy ? "roInvalid" : "Invalid";
            case ValueKind.Boolean:
                return legacy ? "roBoolean" : "Boolean";
            case ValueKind.String:
                return legacy ? "roString" : "String";
            case ValueKind.Int32:
                return legacy ? "roInteger" : "Integer";
            case ValueKind.Int64:
                return "LongInteger";
            case ValueKind.Float:
                return legacy ? "roFloat" : "Float";
            case ValueKind.Double:
                return legacy ? "roFloat" : "Double";
            case ValueKind.Callable:
                return "Function";
            case ValueKind.Dynamic:
                return "Dynamic";
            case ValueKind.Void:
                return "Void";
            case ValueKind.Uninitialized:
                return "<uninitialized>";
            case ValueKind.Object:
                return "Object";
        }
    }

    /**
     * Fetches a `ValueKind` enum member by its string representation.
     * @param kind the string representation of a `ValueKind`
     * @returns the corresponding `ValueKind` if one exists, otherwise `undefined`.
     */
    export function fromString(kind: string): ValueKind | undefined {
        switch (kind.toLowerCase()) {
            case "interface":
                return ValueKind.Interface;
            case "invalid":
                return ValueKind.Invalid;
            case "boolean":
                return ValueKind.Boolean;
            case "string":
                return ValueKind.String;
            case "integer":
                return ValueKind.Int32;
            case "longinteger":
                return ValueKind.Int64;
            case "float":
                return ValueKind.Float;
            case "double":
                return ValueKind.Double;
            case "function":
                return ValueKind.Callable;
            case "dynamic":
                return ValueKind.Dynamic;
            case "void":
                return ValueKind.Void;
            case "<uninitialized>":
                return ValueKind.Uninitialized;
            case "object":
                return ValueKind.Object;
            default:
                return undefined;
        }
    }
}

/**
 * Checks if the passed value implements the Comparable interface.
 * @param value BrightScript value to be checked
 * @returns True if value is comparable, false otherwise
 */
export function isComparable(value: BrsType | BrsComponent): value is BrsType & Comparable {
    return "lessThan" in value && "greaterThan" in value && "getValue" in value;
}

/** The base for all BrightScript types. */
export interface BrsValue {
    /**
     * Type differentiator for all BrightScript values. Used to allow comparisons of `.kind` to
     * produce valuable compile-time type inferences.
     */
    readonly kind: ValueKind;

    /**
     * Converts the current value to a human-readable string.
     * @param parent The (optional) BrightScript value that this value is being printed in the context of.
     * @returns A human-readable representation of this value.
     */
    toString(parent?: BrsType): string;

    /**
     * Determines whether or not this value is equal to some `other` value.
     * @param other The value to compare this value to.
     * @returns `true` if this value is strictly equal to the `other` value, otherwise `false`.
     */
    equalTo(other: BrsType): BrsBoolean;
}

/** The set of operations required for a BrightScript datatype to be compared to another. */
export interface Comparable {
    /**
     * Determines whether or not this value is less than some `other` value.
     * @param other The value to compare this value to.
     * @returns `true` if this value is less than the `other` value, otherwise `false`.
     */
    lessThan(other: BrsType): BrsBoolean;

    /**
     * Determines whether or not this value is greater than some `other` value.
     * @param other The value to compare this value to.
     * @returns `true` if this value is greater than the `other` value, otherwise `false`.
     */
    greaterThan(other: BrsType): BrsBoolean;

    /**
     * Returns the value to be used on comparisons
     * @returns the current value, the type will depend on the object
     */
    getValue(): any;
}

/** Internal representation of a string in BrightScript. */
export class BrsString implements BrsValue, Comparable, Boxable {
    readonly kind = ValueKind.String;
    constructor(readonly value: string, public inArray: boolean = false) {}

    /**
     * Compares if this string is less than another value.
     * @param other Value to compare against
     * @returns True if this string is lexicographically less than other, false otherwise
     */
    lessThan(other: BrsType): BrsBoolean {
        if (isStringComp(other)) {
            return BrsBoolean.from(this.value < other.getValue());
        }
        return BrsBoolean.False;
    }

    /**
     * Compares if this string is greater than another value.
     * @param other Value to compare against
     * @returns True if this string is lexicographically greater than other, false otherwise
     */
    greaterThan(other: BrsType): BrsBoolean {
        if (isStringComp(other)) {
            return BrsBoolean.from(this.value > other.getValue());
        }
        return BrsBoolean.False;
    }

    /**
     * Checks if this string is equal to another value.
     * @param other Value to compare against
     * @returns True if values are equal, false otherwise
     */
    equalTo(other: BrsType): BrsBoolean {
        if (isStringComp(other)) {
            return BrsBoolean.from(this.value === other.getValue());
        }
        return BrsBoolean.False;
    }

    /**
     * Gets the underlying string value.
     * @returns JavaScript string value
     */
    getValue() {
        return this.value;
    }

    /**
     * Converts this string to a string representation.
     * @param parent Optional parent context; if present, wraps value in quotes
     * @returns String representation
     */
    toString(parent?: BrsType) {
        if (parent) return `"${this.value}"`;
        return this.value;
    }

    /**
     * Concatenates this string with another BrsType value.
     * Converts the other value to string if it's not a string type.
     * @param other BrsType value to concatenate
     * @returns New BrsString with concatenated values
     */
    concat(other: BrsType): BrsString {
        if (isStringComp(other)) {
            return new BrsString(this.value + other.getValue());
        }
        return new BrsString(this.value + other.toString());
    }

    /**
     * Boxes this primitive string into a RoString component.
     * @returns RoString boxed representation
     */
    box() {
        return new RoString(this);
    }
}

/** Internal representation of a boolean in BrightScript. */
export class BrsBoolean implements BrsValue, Comparable, Boxable {
    readonly kind = ValueKind.Boolean;
    private constructor(private readonly value: boolean, public inArray: boolean = false) {}

    /**
     * Converts this BrsBoolean to a JavaScript boolean.
     * @returns JavaScript boolean value
     */
    toBoolean(): boolean {
        return this.value;
    }

    static readonly False = new BrsBoolean(false);
    static readonly True = new BrsBoolean(true);

    /**
     * Creates a BrsBoolean from a JavaScript boolean value.
     * Returns the static True or False instance.
     * @param value JavaScript boolean value
     * @returns BrsBoolean.True or BrsBoolean.False
     */
    static from(value: boolean) {
        return value ? BrsBoolean.True : BrsBoolean.False;
    }

    /**
     * Compares if this boolean is less than another value.
     * Booleans are never less than any value.
     * @param other Value to compare against
     * @returns Always BrsBoolean.False
     */
    lessThan(other: BrsType): BrsBoolean {
        // booleans aren't less than anything
        return BrsBoolean.False;
    }

    /**
     * Compares if this boolean is greater than another value.
     * Booleans are never greater than any value.
     * @param other Value to compare against
     * @returns Always BrsBoolean.False
     */
    greaterThan(other: BrsType): BrsBoolean {
        // but isn't greater than anything either
        return BrsBoolean.False;
    }

    /**
     * Checks if this boolean is equal to another value.
     * @param other Value to compare against
     * @returns True if values are equal, false otherwise
     */
    equalTo(other: BrsType): BrsBoolean {
        if (other.kind === ValueKind.Boolean || isBrsNumber(other)) {
            return BrsBoolean.from(this.toBoolean() === other.toBoolean());
        }
        return BrsBoolean.False;
    }

    /**
     * Gets the underlying boolean value.
     * @returns JavaScript boolean value
     */
    getValue() {
        return this.value;
    }

    /**
     * Converts this boolean to a string representation.
     * @param parent Optional parent context (unused for booleans)
     * @returns String representation ("true" or "false")
     */
    toString(parent?: BrsType) {
        return this.value.toString();
    }

    /**
     * Boxes this primitive boolean into a RoBoolean component.
     * @returns RoBoolean boxed representation
     */
    box() {
        return new RoBoolean(this);
    }

    /**
     * Returns the boolean AND of this value with another value.
     * @param other the other value to AND with this one.
     * @returns `BrsBoolean.True` if both this value and the other are true, otherwise
     *          `BrsBoolean.False`.
     */
    and(other: BrsBoolean | BrsNumber): BrsBoolean {
        if (other.kind !== ValueKind.Boolean) {
            return BrsBoolean.from(this.value && other.toBoolean());
        }
        return BrsBoolean.from(this.value && other.value);
    }

    /**
     * Returns the boolean OR of this value with another value.
     * @param other the other value to AND with this one.
     * @returns `BrsBoolean.True` if either this value or the other are true, otherwise
     *          `BrsBoolean.False`.
     */
    or(other: BrsBoolean | BrsNumber): BrsBoolean {
        if (other.kind !== ValueKind.Boolean) {
            return BrsBoolean.from(this.value || other.toBoolean());
        }
        return BrsBoolean.from(this.value || other.value);
    }

    /**
     * Returns the boolean negation of this value with another value.
     * @returns `BrsBoolean.True` if either this value is false, otherwise
     *          `BrsBoolean.False`.
     */
    not(): BrsBoolean {
        return BrsBoolean.from(!this.value);
    }
}

/** Internal representation of the BrightScript `invalid` value. */
export class BrsInvalid implements BrsValue, Comparable, Boxable {
    readonly kind = ValueKind.Invalid;
    inArray: boolean = false;
    static readonly Instance = new BrsInvalid();

    /**
     * Compares if invalid is less than another value.
     * Invalid is never less than any value.
     * @param other Value to compare against
     * @returns Always BrsBoolean.False
     */
    lessThan(other: BrsType): BrsBoolean {
        // invalid isn't less than anything
        return BrsBoolean.False;
    }

    /**
     * Compares if invalid is greater than another value.
     * Invalid is never greater than any value.
     * @param other Value to compare against
     * @returns Always BrsBoolean.False
     */
    greaterThan(other: BrsType): BrsBoolean {
        // but isn't greater than anything either
        return BrsBoolean.False;
    }

    /**
     * Checks if this invalid value is equal to another value.
     * @param other Value to compare against
     * @returns True if other is also invalid, false otherwise
     */
    equalTo(other: BrsType): BrsBoolean {
        if (other.kind === ValueKind.Invalid || other instanceof RoInvalid) {
            return BrsBoolean.True;
        }
        return BrsBoolean.False;
    }

    /**
     * Gets the invalid value instance.
     * @returns BrsInvalid singleton instance
     */
    getValue() {
        return BrsInvalid.Instance;
    }

    /**
     * Converts invalid to a string representation.
     * @param parent Optional parent context (unused for invalid)
     * @returns String "invalid"
     */
    toString(parent?: BrsType) {
        return "invalid";
    }

    /**
     * Boxes this primitive invalid into a RoInvalid component.
     * @returns RoInvalid boxed representation
     */
    box() {
        return new RoInvalid();
    }
}

/** Internal representation of uninitialized BrightScript variables. */
export class Uninitialized implements BrsValue, Comparable {
    readonly kind = ValueKind.Uninitialized;
    static readonly Instance = new Uninitialized();

    /**
     * Compares if uninitialized is less than another value.
     * Uninitialized values are never less than any value.
     * @param other Value to compare against
     * @returns Always BrsBoolean.False
     */
    lessThan(other: BrsType): BrsBoolean {
        // uninitialized values aren't less than anything
        return BrsBoolean.False;
    }

    /**
     * Compares if uninitialized is greater than another value.
     * Uninitialized values are never greater than any value.
     * @param other Value to compare against
     * @returns Always BrsBoolean.False
     */
    greaterThan(other: BrsType): BrsBoolean {
        // uninitialized values aren't less than anything
        return BrsBoolean.False;
    }

    /**
     * Gets the uninitialized value.
     * @returns JavaScript undefined
     */
    getValue() {
        return undefined;
    }

    /**
     * Checks if this uninitialized value is equal to another value.
     * Special case: allows comparison to the string "<uninitialized>".
     * @param other Value to compare against
     * @returns True if other is the string "<uninitialized>" (case-insensitive), false otherwise
     */
    equalTo(other: BrsType): BrsBoolean {
        if (other.kind === ValueKind.String) {
            // Allow variables to be compared to the string "<uninitialized>" to test if they've
            // been initialized
            return BrsBoolean.from(other.value === this.toString().toLowerCase());
        }

        return BrsBoolean.False;
    }

    /**
     * Converts uninitialized to a string representation.
     * @param parent Optional parent context (unused for uninitialized)
     * @returns String "<UNINITIALIZED>"
     */
    toString(parent?: BrsType) {
        return "<UNINITIALIZED>";
    }
}
