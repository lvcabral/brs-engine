import { BrsValue, ValueKind, BrsInvalid, BrsBoolean, BrsString } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoAssociativeArray, RoMessagePort } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter, jsonOf } from "../../interpreter";

export class RoNDK extends BrsComponent implements BrsValue {
    private port?: RoMessagePort;
    readonly kind = ValueKind.Object;

    constructor() {
        super("roNDK");
        this.registerMethods({
            ifNDK: [this.start],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roNDK>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    // ifNDK ------------------------------------------------------------------------------------

    /** Starts a NDK application. */
    private readonly start = new Callable("start", {
        signature: {
            args: [
                new StdlibArgument("app", ValueKind.String),
                new StdlibArgument("params", ValueKind.Object),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, app: BrsString, params: RoAssociativeArray) => {
            // Start the NDK application
            if (app.value === "RokuBrowser") {
                let paramsJson = jsonOf(params);
                if (paramsJson) {
                    postMessage(`ndk,browser,${paramsJson}`);
                }
            }
            return BrsInvalid.Instance;
        },
    });
}

/**
 * Converts a BrsType value to its representation as a JSON string. If no such
 * representation is possible, throws an Error. Objects with cyclical references
 * are rejected.
 * @param {Interpreter} interpreter An Interpreter.
 * @param {BrsType} x Some BrsType value.
 * @param {Set<BrsAggregate>} visited An optional Set of visited of RoArray or
 *   RoAssociativeArray. If not provided, a new Set will be created.
 * @return {string} The JSON string representation of `x`.
 * @throws {Error} If `x` cannot be represented as a JSON string.
 */
// function jsonOf(x: BrsType, flags: number = 0, key: string = ""): string {
//     switch (x.kind) {
//         case ValueKind.Invalid:
//             return "null";
//         case ValueKind.String:
//             return `"${x.toString()}"`;
//         case ValueKind.Boolean:
//         case ValueKind.Double:
//         case ValueKind.Float:
//         case ValueKind.Int32:
//         case ValueKind.Int64:
//             return x.toString();
//         case ValueKind.Object:
//             if (x instanceof RoAssociativeArray) {
//                 return `{${x
//                     .getElements()
//                     .map((k: BrsString) => {
//                         key = k.toString();
//                         return `"${key}":${jsonOf(x.get(k), flags, key)}`;
//                     })
//                     .join(",")}}`;
//             }
//             if (x instanceof RoArray) {
//                 return `[${x
//                     .getElements()
//                     .map((el: BrsType) => {
//                         return jsonOf(el, flags, key);
//                     })
//                     .join(",")}]`;
//             }
//             if (isUnboxable(x)) {
//                 return jsonOf(x.unbox(), flags, key);
//             }
//             break;
//         case ValueKind.Callable:
//         case ValueKind.Uninitialized:
//         case ValueKind.Interface:
//             break;
//         default:
//             // Exhaustive check as per:
//             // https://basarat.gitbooks.io/typescript/content/docs/types/discriminated-unions.html
//             const _: never = x;
//             break;
//     }
//     let xType = x instanceof BrsComponent ? x.getComponentName() : x;
//     if (flags & 256) {
//         // UnsupportedIgnore
//         return "null";
//     } else if (flags & 512) {
//         // UnsupportedAnnotate
//         return `"<${xType}>"`;
//     }
//     let errMessage = `Value type not supported: ${xType}`;
//     if (key !== "") {
//         errMessage = `${key}: ${errMessage}`;
//     }
//     throw new Error(errMessage);
// }
