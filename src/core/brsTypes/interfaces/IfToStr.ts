import {
    BrsInvalid,
    BrsString,
    Callable,
    isBoxedNumber,
    isComparable,
    nonFiniteText,
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
import { vsprintf } from "@lvcabral/sprintf";

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
            const formatText = typeof value === "number" ? formatSignedSpecial(format.value, value) : format.value;
            const tokens = formatText.split("%").length - 1;
            if (tokens === 0) {
                return new BrsString(formatText);
            }
            const params = new Array(tokens).fill(value);
            try {
                return new BrsString(vsprintf(formatText, params));
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

/**
 * Writes `-0` or a non-finite number into the floating-point conversions (`%f`, `%g`, `%e`, `%a`) of a format string
 * the way C's printf does on a device, which the sprintf library gets wrong: `nan`/`inf` with the sign and width
 * flags (no precision or zero padding), and `-0` with its sign.
 * @param format the format string.
 * @param value the number being formatted.
 * @returns the format string, with those conversions already written when `value` is one of these numbers.
 */
function formatSignedSpecial(format: string, value: number) {
    const text = nonFiniteText(value);
    if (text === undefined && !Object.is(value, -0)) {
        return format;
    }
    const spec = /%([-+ 0#]*)(\d*)((?:\.\d*)?)([aAeEfFgG])/g;
    return format.replaceAll(spec, (_spec, flags: string, width: string, precision: string, conversion: string) => {
        const size = Number(width);
        if (text === undefined) {
            // -0: format a zero without sign flags or width, then add the sign.
            const zero = vsprintf(`%${flags.replaceAll(/[-+ 0]/g, "")}${precision}${conversion}`, [0]);
            if (flags.includes("-")) {
                return ("-" + zero).padEnd(size);
            }
            return flags.includes("0") ? "-" + zero.padStart(size - 1, "0") : ("-" + zero).padStart(size);
        }
        let sign = "";
        if (!text.startsWith("-") && flags.includes("+")) {
            sign = "+";
        } else if (!text.startsWith("-") && flags.includes(" ")) {
            sign = " ";
        }
        return flags.includes("-") ? (sign + text).padEnd(size) : (sign + text).padStart(size);
    });
}
