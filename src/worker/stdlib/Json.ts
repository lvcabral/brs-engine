import { RoAssociativeArray } from "../brsTypes/components/RoAssociativeArray";
import { RoArray } from "../brsTypes/components/RoArray";
import { Interpreter, jsonOf } from "../interpreter";

import {
    BrsBoolean,
    BrsComponent,
    BrsInvalid,
    BrsString,
    BrsType,
    Callable,
    Float,
    Int32,
    Int64,
    ValueKind,
    StdlibArgument,
    isUnboxable,
} from "../brsTypes";

/**
 * Converts a value to its representation as a BrsType. If no such
 * representation is possible, throws an Error.
 * @param {any} x Some value.
 * @return {BrsType} The BrsType representation of `x`.
 * @throws {Error} If `x` cannot be represented as a BrsType.
 */
function brsValueOf(x: any): BrsType {
    if (x === null) {
        return BrsInvalid.Instance;
    }
    const maxInt = 0x80000000;
    let t: string = typeof x;
    switch (t) {
        case "boolean":
            return BrsBoolean.from(x);
        case "string":
            return new BrsString(x);
        case "number":
            if (Number.isInteger(x)) {
                return x >= -maxInt && x < maxInt ? new Int32(x) : new Int64(x);
            }
            return new Float(x);
        case "object":
            if (Array.isArray(x)) {
                return new RoArray(x.map(brsValueOf));
            }
            return new RoAssociativeArray(
                Object.getOwnPropertyNames(x).map((k: string) => ({
                    name: new BrsString(k),
                    value: brsValueOf(x[k]),
                }))
            );
        default:
            throw new Error(`brsValueOf not implemented for: ${x} <${t}>`);
    }
}


function logBrsErr(interpreter: Interpreter, functionName: string, err: Error): void {
    interpreter.stderr.write(
        `warning,BRIGHTSCRIPT: ERROR: ${functionName}: ${
            err.message
        }: ${interpreter.formatLocation()}`
    );
}

export const FormatJson = new Callable("FormatJson", {
    signature: {
        returns: ValueKind.String,
        args: [
            new StdlibArgument("x", ValueKind.Dynamic),
            new StdlibArgument("flags", ValueKind.Int32, new Int32(0)),
        ],
    },
    impl: (interpreter: Interpreter, x: BrsType, flags: Int32) => {
        try {
            return new BrsString(jsonOf(x, flags.getValue()));
        } catch (err: any) {
            if (err instanceof RangeError) {
                err = new Error("Nested object reference");
            }
            logBrsErr(interpreter, "FormatJSON", err);
            return new BrsString("");
        }
    },
});

export const ParseJson = new Callable("ParseJson", {
    signature: {
        returns: ValueKind.Dynamic,
        args: [new StdlibArgument("jsonString", ValueKind.String)],
    },
    impl: (interpreter: Interpreter, jsonString: BrsString) => {
        try {
            let s: string = jsonString.toString().trim();
            if (s === "") {
                throw new Error("Data is empty");
            }
            return brsValueOf(JSON.parse(s));
        } catch (err: any) {
            logBrsErr(interpreter, "ParseJSON", err);
            return BrsInvalid.Instance;
        }
    },
});
