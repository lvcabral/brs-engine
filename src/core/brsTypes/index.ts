import { ValueKind, BrsInvalid, BrsBoolean, BrsString, Uninitialized, BrsValue, Comparable } from "./BrsType";
import { RoArray } from "./components/RoArray";
import { RoAssociativeArray } from "./components/RoAssociativeArray";
import { RoList } from "./components/RoList";
import { RoByteArray } from "./components/RoByteArray";
import { Int32 } from "./Int32";
import { Int64 } from "./Int64";
import { Float } from "./Float";
import { Double } from "./Double";
import { Callable } from "./Callable";
import { BrsComponent } from "./components/BrsComponent";
import { RoString } from "./components/RoString";
import { BrsInterface } from "./interfaces/BrsInterface";
import { RoXMLList } from "./components/RoXMLList";
import { RoXMLElement } from "./components/RoXMLElement";
import { RoPath } from "./components/RoPath";
import { RoInt } from "./components/RoInt";
import { RoFloat } from "./components/RoFloat";
import { RoDouble } from "./components/RoDouble";
import { RoLongInteger } from "./components/RoLongInteger";
import { RoBoolean } from "./components/RoBoolean";
import { RoURLEvent } from "./events/RoURLEvent";
import { RoUniversalControlEvent } from "./events/RoUniversalControlEvent";
import { RoSystemLogEvent } from "./events/RoSystemLogEvent";
import { RoInputEvent } from "./events/RoInputEvent";
import { RoAudioPlayerEvent } from "./events/RoAudioPlayerEvent";
import { RoVideoPlayerEvent } from "./events/RoVideoPlayerEvent";
import { RoTextureRequestEvent } from "./events/RoTextureRequestEvent";
import { RoChannelStoreEvent } from "./events/RoChannelStoreEvent";
import { RoDeviceInfoEvent } from "./events/RoDeviceInfoEvent";
import { RoCECStatusEvent } from "./events/RoCECStatusEvent";
import { RoHdmiStatusEvent } from "./events/RoHdmiStatusEvent";
import { isUnboxable } from "./Boxing";

export * from "./BrsType";
export * from "./Int32";
export * from "./Int64";
export * from "./Float";
export * from "./Double";
export * from "./interfaces/BrsInterface";
export * from "./components/BrsComponent";
export * from "./components/RoArray";
export * from "./components/RoByteArray";
export * from "./components/RoEVPCipher";
export * from "./components/RoEVPDigest";
export * from "./components/RoHMAC";
export * from "./components/RoDeviceCrypto";
export * from "./components/RoList";
export * from "./components/RoAssociativeArray";
export * from "./components/RoDateTime";
export * from "./components/RoTimespan";
export * from "./components/BrsObjects";
export * from "./components/RoFunction";
export * from "./components/RoRegex";
export * from "./components/RoString";
export * from "./components/RoBitmap";
export * from "./components/RoRegion";
export * from "./components/RoScreen";
export * from "./components/RoSprite";
export * from "./components/RoCompositor";
export * from "./components/RoImageMetadata";
export * from "./components/RoMessagePort";
export * from "./components/RoFontRegistry";
export * from "./components/RoFont";
export * from "./components/RoXMLElement";
export * from "./components/RoXMLList";
export * from "./components/RoBoolean";
export * from "./components/RoDouble";
export * from "./components/RoFloat";
export * from "./components/RoInt";
export * from "./components/RoLongInteger";
export * from "./components/RoInvalid";
export * from "./components/RoAppInfo";
export * from "./components/RoAppManager";
export * from "./components/RoPath";
export * from "./components/RoURLTransfer";
export * from "./components/RoHttpAgent";
export * from "./components/RoAudioPlayer";
export * from "./components/RoAudioResource";
export * from "./components/RoAudioMetadata";
export * from "./components/RoVideoPlayer";
export * from "./components/RoInput";
export * from "./components/RoSystemLog";
export * from "./components/RoLocalization";
export * from "./components/RoRegistry";
export * from "./components/RoRegistrySection";
export * from "./components/RoDeviceInfo";
export * from "./components/RoRemoteInfo";
export * from "./components/RoAppMemoryMonitor";
export * from "./components/RoFileSystem";
export * from "./components/RoChannelStore";
export * from "./components/RoSocketAddress";
export * from "./components/RoTextureRequest";
export * from "./components/RoTextureManager";
export * from "./components/RoUtils";
export * from "./events/RoURLEvent";
export * from "./events/RoInputEvent";
export * from "./events/RoAudioPlayerEvent";
export * from "./events/RoVideoPlayerEvent";
export * from "./events/RoSystemLogEvent";
export * from "./events/RoDeviceInfoEvent";
export * from "./events/RoChannelStoreEvent";
export * from "./events/RoUniversalControlEvent";
export * from "./Boxing";
export * from "./Callable";
export * from "./Coercion";

/**
 * Determines whether or not the given value is a number.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` is a numeric value, otherwise `false`.
 */
export function isBrsNumber(value: BrsType): value is BrsNumber {
    return value instanceof Int32 || value instanceof Int64 || value instanceof Float || value instanceof Double;
}

export const NumberKinds = new Set([ValueKind.Int32, ValueKind.Float, ValueKind.Double, ValueKind.Int64]);

export function isNumberKind(kind: ValueKind): boolean {
    return NumberKinds.has(kind);
}

export const PrimitiveKinds = new Set([
    ValueKind.Uninitialized,
    ValueKind.Invalid,
    ValueKind.Boolean,
    ...NumberKinds,
    ValueKind.String,
    ValueKind.Callable,
]);

/**
 * Determines whether or not the given value is a string.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` is a string, otherwise `false`.
 */
export function isBrsString(value: BrsType): value is BrsString | RoString {
    return value?.kind === ValueKind.String || value instanceof RoString;
}

/**
 * Determines whether or not the given value is a boolean.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` if a boolean, otherwise `false`.
 */
export function isBrsBoolean(value: BrsType): value is BrsBoolean | RoBoolean {
    return value?.kind === ValueKind.Boolean || value instanceof RoBoolean;
}

/**
 * Determines whether or not the given value is a BrightScript callable.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` is a Callable value, otherwise `false`.
 */
export function isBrsCallable(value: BrsType): value is Callable {
    return value?.kind === ValueKind.Callable;
}

/**
 * Determines whether or not the provided value is an instance of a iterable BrightScript type.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` can be iterated across, otherwise `false`.
 */
export function isIterable(value: BrsType): value is Iterable {
    return (
        "get" in value &&
        "getElements" in value &&
        "set" in value &&
        "hasNext" in value &&
        "getNext" in value &&
        "resetNext" in value
    );
}

/**
 * Determines whether or not the given value can be compared as a number.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` can be compared as a number, otherwise `false`.
 */
export function isNumberComp(value: BrsType): value is BrsType & Comparable {
    return isBrsNumber(value) || isBoxedNumber(value) || value instanceof RoUniversalControlEvent;
}

/**
 * Determines whether or not the given value can be compared as a string.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` can be compared as a string, otherwise `false`.
 */
export function isStringComp(value: BrsType): value is BrsString & Comparable {
    return isBrsString(value) || value instanceof RoPath || value instanceof RoURLEvent;
}

/**
 * Determines whether or not the given value is a BrightScript boxed number.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` is a boxed number, otherwise `false`.
 */
export function isBoxedNumber(value: BrsType | BrsComponent): value is BoxedNumber {
    return (
        value instanceof RoInt ||
        value instanceof RoFloat ||
        value instanceof RoDouble ||
        value instanceof RoLongInteger
    );
}

/** The set of BrightScript numeric types. */
export type BrsNumber = Int32 | Int64 | Float | Double;

/** The set of BrightScript boxed numeric types. */
export type BoxedNumber = RoInt | RoFloat | RoDouble | RoLongInteger;

/**
 * Determines whether or not the given value can be converted to a number.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` can be converted to a number, otherwise `false`.
 */
export function isAnyNumber(value: BrsType): value is BrsNumber | BoxedNumber {
    return isBrsNumber(value) || isBoxedNumber(value);
}

/**
 * Determines whether or not the given value is a BrightScript event component.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` is a BrightScript event component, otherwise `false`.
 */
export function isBrsEvent(value: BrsType): value is BrsEvent {
    return (
        value instanceof RoURLEvent ||
        value instanceof RoUniversalControlEvent ||
        value instanceof RoSystemLogEvent ||
        value instanceof RoInputEvent ||
        value instanceof RoAudioPlayerEvent ||
        value instanceof RoVideoPlayerEvent ||
        value instanceof RoTextureRequestEvent ||
        value instanceof RoChannelStoreEvent ||
        value instanceof RoDeviceInfoEvent ||
        value instanceof RoCECStatusEvent ||
        value instanceof RoHdmiStatusEvent
    );
}

// The set of BrightScript Event components
export type BrsEvent =
    | RoURLEvent
    | RoUniversalControlEvent
    | RoSystemLogEvent
    | RoInputEvent
    | RoAudioPlayerEvent
    | RoVideoPlayerEvent
    | RoTextureRequestEvent
    | RoChannelStoreEvent
    | RoDeviceInfoEvent
    | RoCECStatusEvent
    | RoHdmiStatusEvent;

/**
 * The set of all comparable BrightScript types. Only primitive (i.e. intrinsic * and unboxed)
 * BrightScript types are comparable to each other.
 */
export type BrsPrimitive = BrsInterface | BrsInvalid | BrsBoolean | BrsString | BrsNumber;

/** The set of BrightScript iterable types. */
export type Iterable = RoArray | RoAssociativeArray | RoList | RoByteArray | RoXMLList | RoXMLElement;

// this is getting weird - we need a lesThan and greaterThan function?!
export type AllComponents = { kind: ValueKind.Object } & BrsComponent & BrsValue;

/** The set of all supported types in BrightScript. */
export type BrsType = BrsPrimitive | Iterable | Callable | AllComponents | Uninitialized;

// Function to check if the value is a BrightScript Type
export function isBrsType(value: any): value is BrsType {
    return (
        isBrsBoolean(value) ||
        isBrsString(value) ||
        isBrsNumber(value) ||
        value === BrsInvalid.Instance ||
        value instanceof BrsComponent ||
        value instanceof BrsInterface ||
        value instanceof Callable ||
        value instanceof Uninitialized
    );
}

/** The valid ISO Date formats for roDateTime and roTimeSpan parsing */
export const ValidDateFormats = [
    "YYYY-MM-DDTHH:mm:ss.SSS[Z]",
    "YYYY-MM-DDTHH:mm:ss.SSS",
    "YYYY-MM-DDTHH:mm:ss[Z]",
    "YYYY-MM-DDTHH:mm:ss",
    "YYYY-MM-DDTHH:mm[Z]",
    "YYYY-MM-DDTHH:mm",
    "YYYY-MM-DDTHH[Z]",
    "YYYY-MM-DDTHH",
    "YYYY-MM-DDT",
    "YYYY-MM-DD[Z]",
    "YYYY-MM-DD",
    "YYYY-MM[Z]",
    "YYYY-MM",
    "YYYY[Z]",
    "YYYY",
];

/**
 * Interface for a flexible object with string keys and convertible values.
 * This is to be used to behave like and convert to a BrightScript Associative Array.
 */
export interface FlexObject {
    [key: string]: BrsConvertible | BrsConvertible[] | FlexObject | FlexObject[] | Map<string, any>;
}

/**
 * A type that can be converted to a BrightScript type.
 */
export type BrsConvertible = boolean | number | string | BrsType | null | undefined;

/**
 * Converts a JavaScript object or Map to a RoAssociativeArray, converting each property or entry to the corresponding BrightScript type.
 * @param input The JavaScript object or Map to convert.
 * @param {boolean} cs Whether to return an AA as case sensitive.
 * @returns A RoAssociativeArray with the converted properties or entries.
 */
export function toAssociativeArray(input: Map<string, any> | FlexObject, cs?: boolean): RoAssociativeArray {
    const associativeArray = new RoAssociativeArray([], cs);
    if (input instanceof Map) {
        for (const [key, value] of input) {
            associativeArray.set(new BrsString(key), brsValueOf(value, cs), true);
        }
    } else if (typeof input === "object" && input !== null) {
        for (const key in input) {
            if (input.hasOwnProperty(key)) {
                associativeArray.set(new BrsString(key), brsValueOf(input[key], cs), true);
            }
        }
    } else {
        throw new Error(`Unsupported input type: ${typeof input}`);
    }
    return associativeArray;
}

/**
 * Converts a value to its representation as a BrsType. If no such
 * representation is possible, throws an Error.
 * @param {any} x Some value.
 * @param {boolean} cs Whether to return an AA as case sensitive.
 * @return {BrsType} The BrsType representation of `x`.
 * @throws {Error} If `x` cannot be represented as a BrsType.
 */
export function brsValueOf(x: any, cs?: boolean): BrsType {
    if (x === null || x === undefined) {
        return BrsInvalid.Instance;
    }
    const maxInt = 0x80000000;
    const t: string = typeof x;
    switch (t) {
        case "boolean":
            return BrsBoolean.from(x);
        case "string":
            return new BrsString(x);
        case "number":
            if (Number.isInteger(x)) {
                return x >= -maxInt && x < maxInt ? new Int32(x) : new Int64(x);
            } else if (Number.isNaN(x)) {
                return new Float(x);
            }
            return x >= -3.4e38 && x <= 3.4e38 ? new Float(x) : new Double(x);
        case "object":
            return fromObject(x, cs);
        case "undefined":
            return Uninitialized.Instance;
        default:
            throw new Error(`brsValueOf not implemented for: ${x} <${t}>`);
    }
}

/**
 * Converts a JavaScript object to a BrsType.
 * @param x The JavaScript object to convert.
 * @param {boolean} cs Whether to return an AA as case sensitive.
 * @returns A BrsType with the converted object or Invalid if the object is not transferable.
 */
function fromObject(x: any, cs?: boolean): BrsType {
    if (isBrsType(x)) {
        return x;
    } else if (x === null) {
        return BrsInvalid.Instance;
    } else if (x instanceof Uint8Array) {
        return new RoByteArray(x);
    } else if (Array.isArray(x)) {
        return new RoArray(
            x.map(function (el: any) {
                return brsValueOf(el, cs);
            })
        );
    }
    return toAssociativeArray(x, cs);
}

/**
 * Converts a RoAssociativeArray to a JavaScript object, converting each property to the corresponding JavaScript type.
 * @param associativeArray The RoAssociativeArray to convert.
 * @returns A JavaScript object with the converted properties.
 */
export function fromAssociativeArray(associativeArray: RoAssociativeArray): FlexObject {
    const result: FlexObject = {};

    for (const [key, value] of associativeArray.elements) {
        if (isUnboxable(value)) {
            result[key] = jsValueOf(value.unbox());
        } else {
            result[key] = jsValueOf(value);
        }
    }

    return result;
}

/**
 * Converts a BrsType value to its representation as a JavaScript type.
 * @param {BrsType} x Some BrsType value.
 * @return {any} The JavaScript representation of `x`.
 */
export function jsValueOf(x: BrsType): any {
    if (isUnboxable(x)) {
        x = x.unbox();
    }
    switch (x.kind) {
        case ValueKind.Invalid:
            return null;
        case ValueKind.Uninitialized:
            return undefined;
        case ValueKind.Boolean:
            return x.toBoolean();
        case ValueKind.String:
            return x.value;
        case ValueKind.Int32:
        case ValueKind.Float:
        case ValueKind.Double:
            return x.getValue();
        case ValueKind.Int64:
            return x.getValue().toNumber();
        case ValueKind.Interface:
        case ValueKind.Object:
            if (x instanceof RoArray || x instanceof RoList) {
                return x.elements.map(jsValueOf);
            } else if (x instanceof RoByteArray) {
                return x.elements;
            } else if (x instanceof RoAssociativeArray) {
                return fromAssociativeArray(x);
            }
            break;
        default:
            throw new Error(`jsValueOf not implemented for: ${x} <${x.kind}>`);
    }
}

/**
 * Checks if a string represents a number and returns its precision.
 * The precision is equivalent to the Number.toPrecision() parameter (total significant digits).
 * @param {string} str - The string to check
 * @returns {number | null} - The precision (significant digits count) or null if not a valid number
 */
export function getFloatingPointPrecision(str: string): number | null {
    // Remove leading/trailing whitespace
    const trimmed = str.trim();

    // Early return for empty string
    if (!trimmed) {
        return null;
    }
    // Check if it's a valid number format (including scientific notation)
    // More efficient regex that captures the parts we need
    const numberRegex = /^([+-]?)(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
    const numberMatch = numberRegex.exec(trimmed);
    if (!numberMatch) {
        return null;
    }
    const [, _sign, mantissa, exponent] = numberMatch;
    // Parse the number to ensure it's valid (but we already validated format)
    const num = Number.parseFloat(trimmed);
    if (!Number.isFinite(num)) {
        return null;
    }
    // Quick check for integer without decimal point or scientific notation
    if (!mantissa.includes(".") && !exponent) {
        return 0; // Integer numbers return precision 0
    }
    // For scientific notation, we only need to count digits in the mantissa
    // No need to convert to decimal form
    let workingStr = mantissa;
    // Count significant digits more efficiently
    let significantDigits = 0;
    let foundFirstNonZero = false;
    for (const char of workingStr) {
        if (char === ".") {
            continue; // Skip decimal point
        }

        if (char !== "0" || foundFirstNonZero) {
            significantDigits++;
            foundFirstNonZero = true;
        }
    }
    return significantDigits;
}
