import {
    BrsComponent,
    BrsInvalid,
    BrsString,
    Callable,
    isBoxedNumber,
    isBrsString,
    StdlibArgument,
    ValueKind,
} from "..";
import { RuntimeError, RuntimeErrorDetail } from "../../Error";
import { Interpreter } from "../../interpreter";
import { vsprintf } from "sprintf-js";

export class IfToStr {
    private readonly component: any;
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
                } else if (isBoxedNumber(this.component)) {
                    return new BrsString(this.component.toString());
                } else if (this.defaultRegEx) {
                    return new BrsString(this.component.toString().replace(this.defaultRegEx, ""));
                } else {
                    return new BrsString(this.component.getValue().toString());
                }
            } else if (!isBoxedNumber(this.component) && !isBrsString(this.component)) {
                throw new RuntimeError(
                    RuntimeErrorDetail.MemberFunctionNotFound,
                    interpreter.location,
                    interpreter.stack.slice(0, -1)
                );
            }
            const tokens = format.value.split("%").length - 1;
            if (tokens === 0) {
                return new BrsString(format.value);
            }
            const params = Array(tokens).fill(this.component.getValue());
            try {
                return new BrsString(vsprintf(format.value, params));
            } catch (err: any) {
                if (interpreter.isDevMode) {
                    interpreter.stderr.write(
                        `warning,ifToStr.toStr() Error: ${err.message} - ${format.value}`
                    );
                }
                const errorDetail = err.message?.includes("expecting number")
                    ? RuntimeErrorDetail.TypeMismatch
                    : RuntimeErrorDetail.InvalidFormatSpecifier;
                throw new RuntimeError(
                    errorDetail,
                    interpreter.location,
                    interpreter.stack.slice(0, -1)
                );
            }
        },
    });
}
