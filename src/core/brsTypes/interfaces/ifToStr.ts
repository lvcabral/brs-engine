import { BrsComponent, BrsInvalid, BrsString, Callable, StdlibArgument, ValueKind } from "..";
import { RuntimeError, RuntimeErrorDetail } from "../../Error";
import { Interpreter } from "../../interpreter";
import { vsprintf } from "sprintf-js";

export class ifToStr {
    private readonly component: any;
    private readonly defaultFormat: string;

    constructor(value: BrsComponent, defaultFormat: string = "") {
        this.component = value;
        this.defaultFormat = defaultFormat;
    }

    /** Returns the object's value formatted as a string according to the specified printf-like format string. */
    readonly toStr = new Callable("toStr", {
        signature: {
            args: [new StdlibArgument("format", ValueKind.String, BrsInvalid.Instance)],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter, format: BrsString | BrsInvalid) => {
            if (format instanceof BrsInvalid && this.defaultFormat.trim() !== "") {
                format = new BrsString(this.defaultFormat);
            } else if (format instanceof BrsInvalid) {
                return new BrsString(this.component.toString());
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
