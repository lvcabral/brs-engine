import { ValueKind, Comparable, BrsBoolean } from "./BrsType";
import { BrsNumber, Numeric } from "./BrsNumber";
import { BrsType, isNumberComp } from ".";
import { Boxable } from "./Boxing";
import { Float } from "./Float";
import { Double } from "./Double";
import { Int64 } from "./Int64";
import { RoInt } from "./components/RoInt";
import Long from "long";

export class Int32 implements Numeric, Comparable, Boxable {
    readonly kind = ValueKind.Int32;
    private readonly value: number;

    getValue(): number {
        return this.value;
    }

    toBoolean(): boolean {
        return this.value !== 0;
    }

    /**
     * Creates a new BrightScript 32-bit integer value representing the provided `value`.
     * @param value the value to store in the BrightScript number, truncated to a 32-bit
     *              integer.
     */
    constructor(value: number | Long) {
        const maxInt = 0x80000000;
        if (value instanceof Long) {
            // RBI ignores the 32 most significant bits when converting a 64-bit int to a 32-bit int, effectively
            // performing a bitwise AND with `0x00000000FFFFFFFF`.  Since Long already tracks the lower and upper
            // portions as separate 32-bit values, we can simply extract the least-significant portion.
            value = value.low;
        } else if (value > maxInt - 1 || value < -maxInt) {
            // RBI truncates the value to a 32-bit integer, if not identified as LongInt, so we'll do the same here
            value = value < -maxInt ? -maxInt : maxInt - 1;
        }
        this.value = Math.trunc(value);
    }

    /**
     * Creates a new BrightScript 32-bit integer value representing the integer contained in
     * `asString`.
     * @param asString the string representation of the value to store in the BrightScript 32-bit
     *                 int. Will be truncated to a 32-bit integer.
     * @returns a BrightScript 32-bit integer value representing `asString`.
     */
    static fromString(asString: string): Int32 {
        if (asString.toLowerCase().startsWith("&h")) {
            asString = asString.slice(2); // remove "&h" from the string representation
            const signedInt32 = Number.parseInt(asString, 16) | 0; // RBI coerces to 32-bit signed int when parsing hex
            return new Int32(signedInt32);
        }
        return new Int32(Number.parseFloat(asString));
    }

    add(rhs: BrsNumber): BrsNumber {
        switch (rhs.kind) {
            case ValueKind.Int32:
                return new Int32((this.getValue() + rhs.getValue()) | 0);
            case ValueKind.Int64:
                return new Int64(rhs.getValue().add(this.getValue()));
            case ValueKind.Float:
                return new Float(this.getValue() + rhs.getValue());
            case ValueKind.Double:
                return new Double(this.getValue() + rhs.getValue());
        }
    }

    subtract(rhs: BrsNumber): BrsNumber {
        switch (rhs.kind) {
            case ValueKind.Int32:
                return new Int32((this.getValue() - rhs.getValue()) | 0);
            case ValueKind.Int64:
                return new Int64(this.getValue()).subtract(rhs);
            case ValueKind.Float:
                return new Float(this.getValue() - rhs.getValue());
            case ValueKind.Double:
                return new Double(this.getValue() - rhs.getValue());
        }
    }

    multiply(rhs: BrsNumber): BrsNumber {
        switch (rhs.kind) {
            case ValueKind.Int32:
                return new Int32((this.getValue() * rhs.getValue()) | 0);
            case ValueKind.Int64:
                return new Int64(rhs.getValue().multiply(this.getValue()));
            case ValueKind.Float:
                return new Float(this.getValue() * rhs.getValue());
            case ValueKind.Double:
                return new Double(this.getValue() * rhs.getValue());
        }
    }

    divide(rhs: BrsNumber): Float | Double {
        switch (rhs.kind) {
            case ValueKind.Int32:
                return new Float(this.getValue() / rhs.getValue());
            case ValueKind.Int64:
                return new Float(this.getValue() / rhs.getValue().toNumber());
            case ValueKind.Float:
                return new Float(this.getValue() / rhs.getValue());
            case ValueKind.Double:
                return new Double(this.getValue() / rhs.getValue());
        }
    }

    modulo(rhs: BrsNumber): BrsNumber {
        switch (rhs.kind) {
            case ValueKind.Int32:
                return new Int32(this.getValue() % rhs.getValue());
            case ValueKind.Float:
                return new Float(Math.trunc(this.getValue() % rhs.getValue()));
            case ValueKind.Double:
                return new Double(Math.trunc(this.getValue() % rhs.getValue()));
            case ValueKind.Int64:
                return new Int64(this.getValue()).modulo(rhs);
        }
    }

    intDivide(rhs: BrsNumber): Int32 | Int64 {
        switch (rhs.kind) {
            case ValueKind.Int32:
            case ValueKind.Float:
            case ValueKind.Double:
                // TODO: Is 32-bit precision enough here?
                return new Int32(Math.trunc(this.getValue() / rhs.getValue()));
            case ValueKind.Int64:
                return new Int64(Math.trunc(this.getValue() / rhs.getValue().toNumber()));
        }
    }

    leftShift(rhs: BrsNumber): Int32 {
        switch (rhs.kind) {
            case ValueKind.Int32:
            case ValueKind.Float:
            case ValueKind.Double:
                return new Int32(this.getValue() << Math.trunc(rhs.getValue()));
            case ValueKind.Int64:
                return new Int32(this.getValue() << rhs.getValue().toNumber());
        }
    }

    rightShift(rhs: BrsNumber): Int32 {
        switch (rhs.kind) {
            case ValueKind.Int32:
            case ValueKind.Float:
            case ValueKind.Double:
                return new Int32(this.getValue() >>> Math.trunc(rhs.getValue()));
            case ValueKind.Int64:
                return new Int32(this.getValue() >>> rhs.getValue().toNumber());
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
            case ValueKind.Int32:
                return new Int32(this.getValue() & rhs.getValue());
            case ValueKind.Int64:
                return new Int64(this.getValue()).and(rhs);
            case ValueKind.Float:
                return new Int32(this.getValue() & rhs.getValue());
            case ValueKind.Double:
                return new Int32(this.getValue() & rhs.getValue());
            case ValueKind.Boolean:
                return BrsBoolean.from(this.toBoolean() && rhs.getValue());
        }
    }

    or(rhs: BrsNumber | BrsBoolean): BrsNumber | BrsBoolean {
        switch (rhs.kind) {
            case ValueKind.Int32:
                return new Int32(this.getValue() | rhs.getValue());
            case ValueKind.Int64:
                return new Int64(this.getValue()).or(rhs);
            case ValueKind.Float:
                return new Int32(this.getValue() | rhs.getValue());
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
        return Number.isNaN(this.value) ? "nan" : this.value.toString();
    }

    box() {
        return new RoInt(this);
    }
}
