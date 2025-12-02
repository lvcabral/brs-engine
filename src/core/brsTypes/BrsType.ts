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

/** Check if the passed value implements the Comparable interface
 * @param value the BrightScript value to be checked.
 * @returns `true` if `value` is comparable, otherwise `false`.
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

    lessThan(other: BrsType): BrsBoolean {
        if (isStringComp(other)) {
            return BrsBoolean.from(this.value < other.getValue());
        }
        return BrsBoolean.False;
    }

    greaterThan(other: BrsType): BrsBoolean {
        if (isStringComp(other)) {
            return BrsBoolean.from(this.value > other.getValue());
        }
        return BrsBoolean.False;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (isStringComp(other)) {
            return BrsBoolean.from(this.value === other.getValue());
        }
        return BrsBoolean.False;
    }

    getValue() {
        return this.value;
    }

    toString(parent?: BrsType) {
        if (parent) return `"${this.value}"`;
        return this.value;
    }

    concat(other: BrsType): BrsString {
        if (isStringComp(other)) {
            return new BrsString(this.value + other.getValue());
        }
        return new BrsString(this.value + other.toString());
    }

    box() {
        return new RoString(this);
    }
}

/** Internal representation of a boolean in BrightScript. */
export class BrsBoolean implements BrsValue, Comparable, Boxable {
    readonly kind = ValueKind.Boolean;
    private constructor(private readonly value: boolean, public inArray: boolean = false) {}

    toBoolean(): boolean {
        return this.value;
    }

    static readonly False = new BrsBoolean(false);
    static readonly True = new BrsBoolean(true);
    static from(value: boolean) {
        return value ? BrsBoolean.True : BrsBoolean.False;
    }

    lessThan(other: BrsType): BrsBoolean {
        // booleans aren't less than anything
        return BrsBoolean.False;
    }

    greaterThan(other: BrsType): BrsBoolean {
        // but isn't greater than anything either
        return BrsBoolean.False;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other.kind === ValueKind.Boolean || isBrsNumber(other)) {
            return BrsBoolean.from(this.toBoolean() === other.toBoolean());
        }
        return BrsBoolean.False;
    }

    getValue() {
        return this.value;
    }

    toString(parent?: BrsType) {
        return this.value.toString();
    }

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

    lessThan(other: BrsType): BrsBoolean {
        // invalid isn't less than anything
        return BrsBoolean.False;
    }

    greaterThan(other: BrsType): BrsBoolean {
        // but isn't greater than anything either
        return BrsBoolean.False;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other.kind === ValueKind.Invalid || other instanceof RoInvalid) {
            return BrsBoolean.True;
        }
        return BrsBoolean.False;
    }

    getValue() {
        return BrsInvalid.Instance;
    }

    toString(parent?: BrsType) {
        return "invalid";
    }

    box() {
        return new RoInvalid();
    }
}

/** Internal representation of uninitialized BrightScript variables. */
export class Uninitialized implements BrsValue, Comparable {
    readonly kind = ValueKind.Uninitialized;
    static readonly Instance = new Uninitialized();

    lessThan(other: BrsType): BrsBoolean {
        // uninitialized values aren't less than anything
        return BrsBoolean.False;
    }

    greaterThan(other: BrsType): BrsBoolean {
        // uninitialized values aren't less than anything
        return BrsBoolean.False;
    }

    getValue() {
        return undefined;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other.kind === ValueKind.String) {
            // Allow variables to be compared to the string "<uninitialized>" to test if they've
            // been initialized
            return BrsBoolean.from(other.value === this.toString().toLowerCase());
        }

        return BrsBoolean.False;
    }

    toString(parent?: BrsType) {
        return "<UNINITIALIZED>";
    }
}
