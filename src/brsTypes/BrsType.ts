import { BrsType } from ".";

/** Set of values supported in BrightScript. */
export enum ValueKind {
    Invalid,
    Boolean,
    String,
    Int32,
    Int64,
    Float,
    Double,
    // TODO: Add Object types (associative arrays, lists, etc.)
    Array,
    Callable,
    Dynamic,
    Void,
    Uninitialized
}

export namespace ValueKind {
    /**
     * Converts a `ValueKind` enum member to a human-readable string representation.
     * @returns a textual representation of the provided value kind.
     */
    export function toString(kind: ValueKind): string {
        switch (kind) {
            case ValueKind.Invalid: return "Invalid";
            case ValueKind.Boolean: return "Boolean";
            case ValueKind.String: return "String";
            case ValueKind.Int32: return "Integer";
            case ValueKind.Int64: return "LongInteger";
            case ValueKind.Float: return "Float";
            case ValueKind.Double: return "Double";
            case ValueKind.Array: return "Array";
            case ValueKind.Callable: return "Function";
            case ValueKind.Dynamic: return "Dynamic";
            case ValueKind.Void: return "Void";
            case ValueKind.Uninitialized: return "<UNINITIALIZED>";
        }
    }

    /**
     * Fetches a `ValueKind` enum member by its string representation.
     * @param kind the string representation of a `ValueKind`
     * @returns the corresponding `ValueKind` if one exists, otherwise `undefined`.
     */
    export function fromString(kind: string): ValueKind | undefined {
        switch (kind.toLowerCase()) {
            case "invalid": return ValueKind.Invalid;
            case "boolean": return ValueKind.Boolean;
            case "string": return ValueKind.String;
            case "integer": return ValueKind.Int32;
            case "longinteger": return ValueKind.Int64;
            case "float": return ValueKind.Float;
            case "double": return ValueKind.Double;
            case "callable": return ValueKind.Callable;
            case "dynamic": return ValueKind.Dynamic;
            case "void": return ValueKind.Void;
            case "<uninitialized>": return ValueKind.Uninitialized;
            default: return undefined;
        }
    }
}

/** The base for all BrightScript types. */
export interface BrsValue {
    /** Type differentiator for all BrightScript values. */
    readonly kind: ValueKind;

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
     * Determines whether or not this value is equal to some `other` value.
     * @param other The value to compare this value to.
     * @returns `true` if this value is strictly equal to the `other` value, otherwise `false`.
     */
    equalTo(other: BrsType): BrsBoolean;

    /**
     * Converts the current value to a human-readable string.
     * @returns A human-readable representation of this value.
     */
    toString(): string;
}

/** Internal representation of a string in BrightScript. */
export class BrsString implements BrsValue {
    readonly kind = ValueKind.String;
    constructor(readonly value: string) {}

    lessThan(other: BrsType): BrsBoolean {
        if (other.kind === ValueKind.String) {
            return BrsBoolean.from(this.value < other.value);
        }
        return BrsBoolean.False;
    }

    greaterThan(other: BrsType): BrsBoolean {
        if (other.kind === ValueKind.String) {
            return BrsBoolean.from(this.value > other.value);
        }
        return BrsBoolean.False;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other.kind === ValueKind.String) {
            return BrsBoolean.from(this.value === other.value);
        }
        return BrsBoolean.False;
    }

    toString() {
        return this.value;
    }

    concat(other: BrsString) {
        return new BrsString(this.value + other.value);
    }
}

/** Internal representation of a boolean in BrightScript. */
export class BrsBoolean implements BrsValue {
    readonly kind = ValueKind.Boolean;
    private constructor(private readonly value: boolean) {}

    toBoolean(): boolean {
        return this.value;
    }

    static False = new BrsBoolean(false);
    static True = new BrsBoolean(true);
    static from(value: boolean) {
        return value ? BrsBoolean.True : BrsBoolean.False;
    }

    lessThan(other: BrsType): BrsBoolean {
        // booleans aren't less than anything
        // TODO: Validate on a Roku
        return BrsBoolean.False;
    }

    greaterThan(other: BrsType): BrsBoolean {
        // but isn't greater than anything either
        // TODO: Validate on a Roku
        return BrsBoolean.False;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other.kind === ValueKind.Boolean) {
            return BrsBoolean.from(this === other);
        }
        return BrsBoolean.False;
    }

    toString() {
        return this.value.toString();
    }

    /**
     * Returns the boolean AND of this value with another value.
     * @param other the other value to AND with this one.
     * @returns `BrsBoolean.True` if both this value and the other are true, otherwise
     *          `BrsBoolean.False`.
     */
    and(other: BrsBoolean): BrsBoolean {
        return BrsBoolean.from(this.value && other.value);
    }

    /**
     * Returns the boolean OR of this value with another value.
     * @param other the other value to AND with this one.
     * @returns `BrsBoolean.True` if either this value or the other are true, otherwise
     *          `BrsBoolean.False`.
     */
    or(other: BrsBoolean): BrsBoolean {
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
export class BrsInvalid implements BrsValue {
    readonly kind = ValueKind.Invalid;
    static Instance = new BrsInvalid();

    lessThan(other: BrsType): BrsBoolean {
        // invalid isn't less than anything
        // TODO: Validate on a Roku
        return BrsBoolean.False;
    }

    greaterThan(other: BrsType): BrsBoolean {
        // but isn't greater than anything either
        // TODO: Validate on a Roku
        return BrsBoolean.False;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other.kind === ValueKind.Invalid) {
            return BrsBoolean.True;
        }
        return BrsBoolean.False;
    }

    toString() {
        return "invalid";
    }
}

/** Internal representation of uninitialized BrightScript variables. */
export class Uninitialized implements BrsValue {
    readonly kind = ValueKind.Uninitialized;
    static Instance = new Uninitialized();

    lessThan(other: BrsType): BrsBoolean {
        // uninitialized values aren't less than anything
        return BrsBoolean.False;
    }

    greaterThan(other: BrsType): BrsBoolean {
        // uninitialized values aren't less than anything
        return BrsBoolean.False;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other.kind === ValueKind.String) {
            // Allow variables to be compared to the string "<UNINITIALIZED>" to test if they've
            // been initialized
            return BrsBoolean.from(
                other.value === this.toString()
            );
        }

        return BrsBoolean.False;
    }

    toString() {
        return "<UNINITIALIZED>";
    }
}