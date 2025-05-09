import { BrsType, BrsBoolean, isNumberComp } from ".";
import { ValueKind, Comparable } from "./BrsType";
import { BrsNumber, Numeric } from "./BrsNumber";
import { Int32 } from "./Int32";
import { Int64 } from "./Int64";
import { Float } from "./Float";
import { RoDouble } from "./components/RoDouble";
import { Boxable } from "./Boxing";
import Long from "long";

export class Double implements Numeric, Comparable, Boxable {
    readonly kind = ValueKind.Double;
    private readonly value: number;

    getValue(): number {
        return this.value;
    }

    toBoolean(): boolean {
        return Math.trunc(this.value) !== 0;
    }

    /**
     * Creates a new BrightScript double-precision value representing the provided `value`.
     * @param value the value to store in the BrightScript double, rounded to 64-bit (double)
     *              precision.
     */
    constructor(value: number | Long, public inArray: boolean = false) {
        this.value = value instanceof Long ? value.toNumber() : value;
    }

    /**
     * Creates a new BrightScript double-precision value representing the floating point value
     * contained in `asString`.
     * @param asString the string representation of the value to store in the BrightScript double.
     *                 Will be rounded to 64-bit (double) precision.
     * @returns a BrightScript double value representing `asString`.
     */
    static fromString(asString: string): Double {
        return new Double(Number.parseFloat(asString));
    }

    add(rhs: BrsNumber): BrsNumber {
        switch (rhs.kind) {
            case ValueKind.Int64:
                // TODO: Confirm that (double) + (int64) -> (double)
                return new Double(this.getValue() + rhs.getValue().toNumber());
            case ValueKind.Int32:
            case ValueKind.Float:
            case ValueKind.Double:
                return new Double(this.getValue() + rhs.getValue());
        }
    }

    subtract(rhs: BrsNumber): BrsNumber {
        switch (rhs.kind) {
            case ValueKind.Int64:
                return new Double(this.getValue() - rhs.getValue().toNumber());
            case ValueKind.Int32:
            case ValueKind.Float:
            case ValueKind.Double:
                return new Double(this.getValue() - rhs.getValue());
        }
    }

    multiply(rhs: BrsNumber): BrsNumber {
        switch (rhs.kind) {
            case ValueKind.Int64:
                return new Double(this.getValue() * rhs.getValue().toNumber());
            case ValueKind.Int32:
            case ValueKind.Float:
            case ValueKind.Double:
                return new Double(this.getValue() * rhs.getValue());
        }
    }

    divide(rhs: BrsNumber): Float | Double {
        switch (rhs.kind) {
            case ValueKind.Int64:
                return new Double(this.getValue() / rhs.getValue().toNumber());
            case ValueKind.Int32:
            case ValueKind.Float:
            case ValueKind.Double:
                return new Double(this.getValue() / rhs.getValue());
        }
    }

    modulo(rhs: BrsNumber): BrsNumber {
        switch (rhs.kind) {
            case ValueKind.Int32:
            case ValueKind.Float:
            case ValueKind.Double:
                return new Double(Math.trunc(this.getValue() % rhs.getValue()));
            case ValueKind.Int64:
                return new Double(Math.trunc(this.getValue() % rhs.getValue().toNumber()));
        }
    }

    intDivide(rhs: BrsNumber): Int32 | Int64 {
        switch (rhs.kind) {
            case ValueKind.Int64:
                return new Int64(Math.trunc(this.getValue() / rhs.getValue().toNumber()));
            case ValueKind.Int32:
            case ValueKind.Float:
            case ValueKind.Double:
                return new Int32(Math.trunc(this.getValue() / rhs.getValue()));
        }
    }

    leftShift(rhs: BrsNumber): Int32 {
        switch (rhs.kind) {
            case ValueKind.Int32:
            case ValueKind.Float:
            case ValueKind.Double:
                return new Int32(Math.trunc(this.getValue()) << Math.trunc(rhs.getValue()));
            case ValueKind.Int64:
                return new Int32(Math.trunc(this.getValue()) << rhs.getValue().toNumber());
        }
    }

    rightShift(rhs: BrsNumber): Int32 {
        switch (rhs.kind) {
            case ValueKind.Int32:
            case ValueKind.Float:
            case ValueKind.Double:
                return new Int32(Math.trunc(this.getValue()) >> Math.trunc(rhs.getValue()));
            case ValueKind.Int64:
                return new Int32(Math.trunc(this.getValue()) >> rhs.getValue().toNumber());
        }
    }

    pow(exponent: BrsNumber): BrsNumber {
        switch (exponent.kind) {
            case ValueKind.Int32:
                return new Float(Math.pow(this.getValue(), exponent.getValue()));
            case ValueKind.Int64:
                return new Int64(this.getValue()).pow(exponent);
            case ValueKind.Float:
                return new Float(Math.pow(this.getValue(), exponent.getValue()));
            case ValueKind.Double:
                return new Double(Math.pow(this.getValue(), exponent.getValue()));
        }
    }

    and(rhs: BrsNumber | BrsBoolean): BrsNumber | BrsBoolean {
        switch (rhs.kind) {
            case ValueKind.Int64:
                return new Int64(this.getValue()).and(rhs);
            case ValueKind.Int32:
            case ValueKind.Float:
            case ValueKind.Double:
                return new Int32(this.getValue() & rhs.getValue());
            case ValueKind.Boolean:
                return BrsBoolean.from(this.toBoolean() && rhs.getValue());
        }
    }

    or(rhs: BrsNumber | BrsBoolean): BrsNumber | BrsBoolean {
        switch (rhs.kind) {
            case ValueKind.Int64:
                return new Int64(this.getValue()).or(rhs);
            case ValueKind.Int32:
            case ValueKind.Float:
            case ValueKind.Double:
                return new Int32(this.getValue() | rhs.getValue());
            case ValueKind.Boolean:
                return BrsBoolean.from(this.toBoolean() || rhs.getValue());
        }
    }

    not(): BrsNumber {
        return new Int32(~this.getValue());
    }

    lessThan(other: BrsType): BrsBoolean {
        if (other.kind === ValueKind.Int64) {
            return BrsBoolean.from(this.getValue() < other.getValue().toNumber());
        } else if (isNumberComp(other)) {
            return BrsBoolean.from(this.getValue() < other.getValue());
        }
        return BrsBoolean.False;
    }

    greaterThan(other: BrsType): BrsBoolean {
        if (other.kind === ValueKind.Int64) {
            return BrsBoolean.from(this.getValue() > other.getValue().toNumber());
        } else if (isNumberComp(other)) {
            return BrsBoolean.from(this.getValue() > other.getValue());
        }
        return BrsBoolean.False;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other.kind === ValueKind.Int64) {
            return BrsBoolean.from(this.getValue() === other.getValue().toNumber());
        } else if (other.kind === ValueKind.Boolean) {
            return other.equalTo(BrsBoolean.from(this.toBoolean()));
        } else if (isNumberComp(other)) {
            return BrsBoolean.from(this.getValue() === other.getValue());
        }
        return BrsBoolean.False;
    }

    toString(parent?: BrsType): string {
        return Number.isNaN(this.value) ? "nan" : this.value.toPrecision();
    }

    box() {
        return new RoDouble(this);
    }
}
