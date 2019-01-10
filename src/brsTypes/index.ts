import { ValueKind, BrsInvalid, BrsBoolean, BrsString, Uninitialized, Comparable } from "./BrsType";
import { BrsArray } from "./components/BrsArray";
import { AssociativeArray } from "./components/AssociativeArray";
import { Int32 } from "./Int32";
import { Int64 } from "./Int64";
import { Float } from "./Float";
import { Double } from "./Double";
import { Callable, CallableImplementation } from "./Callable";
import { Lexeme } from "../lexer";

export * from "./BrsType";
export * from "./Int32";
export * from "./Int64";
export * from "./Float";
export * from "./Double";
export * from "./components/BrsArray";
export * from "./components/AssociativeArray";
export * from "./components/Timespan";
export * from "./components/BrsObjects";
export * from "./Callable";

/**
 * Determines whether or not the given value is a number.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` is a numeric value, otherwise `false`.
 */
export function isBrsNumber(value: BrsType): value is BrsNumber {
    switch (value.kind) {
        case ValueKind.Int32:
        case ValueKind.Int64:
        case ValueKind.Float:
        case ValueKind.Double:
            return true;
        default:
            return false;
    }
}

/**
 * Determines whether or not the given value is a string.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` is a string, otherwise `false`.
 */
export function isBrsString(value: BrsType): value is BrsString {
    return value.kind === ValueKind.String;
}

/**
 * Determines whether or not the given value is a boolean.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` if a boolean, otherwise `false`.
 */
export function isBrsBoolean(value: BrsType): value is BrsBoolean {
    return value.kind === ValueKind.Boolean;
}

/**
 * Determines whether or not the given value is a BrightScript callable.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` is a Callable value, otherwise `false`.
 */
export function isBrsCallable(value: BrsType): value is Callable {
    return value.kind === ValueKind.Callable;
}

/**
 * Determines whether or not the provided value is an instance of a iterable BrightScript type.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` can be iterated across, otherwise `false`.
 */
export function isIterable(value: BrsType): value is Iterable {
    if (value.kind !== ValueKind.Object) {
        return false;
    }

    return value.getElements != null;
}

/** The set of BrightScript numeric types. */
export type BrsNumber = Int32 | Int64 | Float | Double;

/**
 * The set of all comparable BrightScript types. Only primitive (i.e. intrinsic * and unboxed)
 * BrightScript types are comparable to each other.
 */
export type BrsPrimitive = BrsInvalid | BrsBoolean | BrsString | BrsNumber;

/** The set of BrightScript iterable types. */
export type Iterable = BrsArray | AssociativeArray;

/** The set of all supported types in BrightScript. */
export type BrsType =
    BrsPrimitive |
    Iterable |
    Callable |
    Uninitialized;
