import {
    BrsInvalid,
    BrsString,
    Callable,
    isBoxedNumber,
    isComparable,
    RoBoolean,
    RoInvalid,
    RoString,
    StdlibArgument,
    ValueKind,
} from "..";
import { BrsComponent } from "../components/BrsComponent";
import { BrsDevice } from "../../device/BrsDevice";
import { RuntimeError, RuntimeErrorDetail } from "../../error/BrsError";
import { Interpreter } from "../../interpreter";
import { sprintf } from "@lvcabral/sprintf";

/**
 * BrightScript Interface ifToStr
 * https://developer.roku.com/docs/references/brightscript/interfaces/iftostr.md
 */
export class IfToStr {
    private readonly component: BrsComponent;
    private readonly defaultFormat?: string;
    private readonly defaultRegEx?: RegExp;

    constructor(value: BrsComponent, format: string | RegExp = "") {
        this.component = value;
        if (format instanceof RegExp) {
            this.defaultRegEx = format;
        } else {
            this.defaultFormat = format;
        }
    }

    /** Returns the object's value formatted as a string according to the specified printf-like format string. */
    readonly toStr = new Callable("toStr", {
        signature: {
            args: [new StdlibArgument("format", ValueKind.String, BrsInvalid.Instance)],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter, format: BrsString | BrsInvalid) => {
            if (format instanceof BrsInvalid) {
                if (this.defaultFormat?.length) {
                    format = new BrsString(this.defaultFormat);
                } else if (this.defaultRegEx) {
                    return new BrsString(this.component.toString().replace(this.defaultRegEx, ""));
                } else if (isBoxedNumber(this.component)) {
                    return new BrsString(this.component.toString());
                } else if (
                    isComparable(this.component) ||
                    this.component instanceof RoBoolean ||
                    this.component instanceof RoInvalid
                ) {
                    return new BrsString(this.component.getValue().toString());
                } else {
                    throw new RuntimeError(
                        RuntimeErrorDetail.MemberFunctionNotFound,
                        interpreter.location,
                        interpreter.getBacktrace()
                    );
                }
            }
            if (!(isBoxedNumber(this.component) || this.component instanceof RoString)) {
                throw new RuntimeError(
                    RuntimeErrorDetail.MemberFunctionNotFound,
                    interpreter.location,
                    interpreter.getBacktrace()
                );
            }
            const value = this.component.getValue();
            const tokens = format.value.split("%").length - 1;
            if (tokens === 0) {
                return new BrsString(format.value);
            }
            // Starting with the format keeps the array untyped: V8 clears the sign of a NaN stored in a numeric array.
            const args: [string, ...any[]] = [format.value];
            for (let i = 0; i < tokens; i++) {
                args.push(value);
            }
            try {
                checkFormatSpecifiers(format.value);
                return new BrsString(sprintf(...args));
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(
                        `warning,ifToStr.toStr() Error: ${err.message} - ${
                            format.value
                        } at ${interpreter.formatLocation()}`
                    );
                }
                const errorDetail = err.message?.includes("expecting number")
                    ? RuntimeErrorDetail.TypeMismatch
                    : RuntimeErrorDetail.InvalidFormatSpecifier;
                throw new RuntimeError(errorDetail, interpreter.location, interpreter.getBacktrace());
            }
        },
    });
}

const unsupportedConversions = new Set(["a", "A", "i", "u"]);

/**
 * Rejects the conversions and flag the sprintf library accepts but a device does not: `%a`, `%A`, `%i`, `%u` and `#`.
 * @param format the format string.
 * @throws an `Error` with an "unsupported placeholder" message.
 */
export function checkFormatSpecifiers(format: string) {
    for (const [spec, flags, conversion] of format.matchAll(/%([-+ 0#]*)\d*(?:\.\d*)?(.?)/g)) {
        if (conversion !== "%" && (flags.includes("#") || unsupportedConversions.has(conversion))) {
            throw new Error(`[sprintf] unsupported placeholder ${spec}`);
        }
    }
}
