import { AssociativeArray } from "../brsTypes/components/AssociativeArray";
import { BrsArray } from "../brsTypes/components/BrsArray";
import { Interpreter } from "../interpreter";
import { Literal } from "../parser/Expression";

import {
    BrsBoolean,
    BrsInvalid,
    BrsString,
    BrsType,
    Callable,
    Float,
    Int32,
    Int64,
    ValueKind,
    StdlibArgument
} from "../brsTypes";

/**
 * Converts a value to its representation as a BrsType. If no such
 * representation is possible, throws an Error.
 * @param {any} x Some value.
 * @return {BrsType} The BrsType representaion of `x`.
 * @throws {Error} If `x` cannot be represented as a BrsType.
 */
function brsValueOf(x: any): BrsType {
    if (x === null) { return BrsInvalid.Instance; }
    let t: string = typeof x;
    switch (t) {
    case "boolean":
        return BrsBoolean.from(x);
    case "string":
        return new BrsString(x);
    case "number":
        if (Number.isInteger(x)) {
            return x >= -2_147_483_648 && x <= 2_147_483_647 ? new Int32(x) : new Int64(x);
        }
        return new Float(x);
    case "object":
        if (Array.isArray(x)) {
            return new BrsArray(x.map(brsValueOf));
        }
        return new AssociativeArray(
            Object.getOwnPropertyNames(x).map((k: string) => ({
                name: new BrsString(k),
                value: brsValueOf(x[k])
            }))
        );
    default:
        throw new Error(`brsValueOf not implemented for: ${x} <${t}>`);
    }
}

type BrsAggregate = AssociativeArray | BrsArray;

function visit(x: BrsAggregate, visited: Set<BrsAggregate>): void {
    if (visited.has(x)) { throw new Error("Nested object reference"); }
    visited.add(x);
}

/**
 * Converts a BrsType value to its representation as a JSON string. If no such
 * representation is possible, throws an Error. Objects with cyclical references
 * are rejected.
 * @param {Interpreter} interpreter An Interpreter.
 * @param {BrsType} x Some BrsType value.
 * @param {Set<BrsAggregate>} visited An optional Set of visited of BrsArray or
 *   AssociativeArray. If not provided, a new Set will be created.
 * @return {string} The JSON string representation of `x`.
 * @throws {Error} If `x` cannot be represented as a JSON string.
 */
function jsonOf(interpreter: Interpreter, x: BrsType, visited: Set<BrsAggregate> = new Set()): string {
    switch (x.kind) {
    case ValueKind.Invalid:
        return "null";
    case ValueKind.String:
        return `"${x.toString()}"`;
    case ValueKind.Boolean:
    case ValueKind.Double:
    case ValueKind.Float:
    case ValueKind.Int32:
    case ValueKind.Int64:
        return x.toString();
    case ValueKind.Object:
        if (x instanceof AssociativeArray) {
            visit(x, visited);
            return `{${x.getElements().map((k: BrsString) => {
                return `"${k.toString()}":${jsonOf(interpreter, x.get(k), visited)}`;
            }).join(",")}}`;
        }
        if (x instanceof BrsArray) {
            visit(x, visited);
            return `[${x.getElements().map((el: BrsType) => {
                return jsonOf(interpreter, el, visited);
            }).join(",")}]`;
        }
        break;
    case ValueKind.Callable:
    case ValueKind.Uninitialized:
        break;
    default:
        // Exhaustive check as per:
        // https://basarat.gitbooks.io/typescript/content/docs/types/discriminated-unions.html
        const _: never = x;
        break;
    }
    throw new Error(`jsonOf not implemented for: ${x}`);
}

function logBrsErr(functionName: string, err: Error): void {
    if (process.env.NODE_ENV === "test") { return; }
    console.error(`BRIGHTSCRIPT: ERROR: ${functionName}: ${err.message}`);
}

export const FormatJson = new Callable("FormatJson", {
    signature: { returns: ValueKind.String, args: [
        new StdlibArgument("x", ValueKind.Object),
        new StdlibArgument("flags", ValueKind.Int32, new Int32(0))
    ]},
    impl: (interpreter: Interpreter, x: BrsType, _flags: Int32) => {
        try {
            return new BrsString(jsonOf(interpreter, x));
        } catch (err) {
            // example RBI error:
            // "BRIGHTSCRIPT: ERROR: FormatJSON: Value type not supported: roFunction: pkg:/source/main.brs(14)"
            logBrsErr("FormatJSON", err);
            return new BrsString("");
        }
    }
});

export const ParseJson = new Callable("ParseJson", {
    signature: { returns: ValueKind.Dynamic, args: [
        new StdlibArgument("jsonString", ValueKind.String)
    ]},
    impl: (_: Interpreter, jsonString: BrsString) => {
        try {
            let s: string = jsonString.toString().trim();

            if (s === "") { throw new Error("Data is empty"); }

            return brsValueOf(JSON.parse(s));
        } catch (err) {
            // example RBI error:
            // "BRIGHTSCRIPT: ERROR: ParseJSON: Unknown identifier 'x': pkg:/source/main.brs(25)"
            logBrsErr("ParseJSON", err);
            return BrsInvalid.Instance;
        }
    }
});
