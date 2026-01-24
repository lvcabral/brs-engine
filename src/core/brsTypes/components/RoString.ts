import { BrsComponent } from "./BrsComponent";
import { RoArray } from "./RoArray";
import { RoList } from "./RoList";
import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid, Comparable } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { BrsType, isBrsNumber, isBrsString, isStringComp } from "..";
import { Unboxable } from "../Boxing";
import { Int32 } from "../Int32";
import { Float } from "../Float";
import { RuntimeError, RuntimeErrorDetail } from "../../error/BrsError";
import { sprintf } from "@lvcabral/sprintf";
import { IfToStr } from "../interfaces/IfToStr";
import { BrsDevice } from "../../device/BrsDevice";

export class RoString extends BrsComponent implements BrsValue, Comparable, Unboxable {
    readonly kind = ValueKind.Object;
    private intrinsic: BrsString = new BrsString("");

    constructor(initialValue?: BrsString) {
        super("roString");

        if (initialValue) {
            this.intrinsic = initialValue;
        }

        this.registerMethods({
            ifString: [this.setString, this.getString],
            ifStringOps: [
                this.arg,
                this.appendString,
                this.len,
                this.left,
                this.right,
                this.mid,
                this.instr,
                this.replace,
                this.trim,
                this.toInt,
                this.toFloat,
                this.tokenize,
                this.split,
                this.getEntityEncode,
                this.escape,
                this.unescape,
                this.encodeUri,
                this.decodeUri,
                this.encodeUriComponent,
                this.decodeUriComponent,
                this.startsWith,
                this.endsWith,
                this.isEmpty,
                this.format,
            ],
            ifToStr: [new IfToStr(this).toStr],
        });
    }

    getValue(): string {
        return this.intrinsic.value;
    }

    lessThan(other: BrsType): BrsBoolean {
        if (isStringComp(other)) {
            return BrsBoolean.from(this.getValue() < other.getValue());
        }
        return BrsBoolean.False;
    }

    greaterThan(other: BrsType): BrsBoolean {
        if (isStringComp(other)) {
            return BrsBoolean.from(this.getValue() > other.getValue());
        }
        return BrsBoolean.False;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (isStringComp(other)) {
            return BrsBoolean.from(this.getValue() === other.getValue());
        }
        return BrsBoolean.False;
    }

    concat(other: BrsType): BrsString {
        if (isStringComp(other)) {
            return new BrsString(this.intrinsic.value + other.getValue());
        }
        return new BrsString(this.intrinsic.value + other.toString());
    }

    unbox() {
        return this.intrinsic;
    }

    copy() {
        return new RoString(this.intrinsic);
    }

    toString(parent?: BrsType): string {
        return this.intrinsic.toString(parent);
    }

    /**
     * Sets the string to the first len characters of s.
     * Note: this method is implemented in the ifString and ifStringOps interfaces
     */
    private readonly setString = new Callable(
        "SetString",
        {
            signature: {
                args: [new StdlibArgument("s", ValueKind.String)],
                returns: ValueKind.Void,
            },
            impl: (_, s: BrsString) => {
                this.intrinsic = new BrsString(s.value);
                return BrsInvalid.Instance;
            },
        },
        {
            signature: {
                args: [new StdlibArgument("s", ValueKind.String), new StdlibArgument("len", ValueKind.Int32)],
                returns: ValueKind.Void,
            },
            impl: (_, s: BrsString, len: Int32) => {
                const length = len.getValue();
                this.intrinsic = length <= 0 ? new BrsString("") : new BrsString(s.value.slice(0, length));
                return BrsInvalid.Instance;
            },
        }
    );

    private readonly getString = new Callable("GetString", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_) => this.intrinsic,
    });

    // ---------- ifStringOps ----------

    /** Replaces %n placeholders (for example, %1, %2, etc.) with arg1, arg2, and so on. */
    private readonly arg = new Callable("Arg", {
        signature: {
            args: [
                new StdlibArgument("arg1", ValueKind.String),
                new StdlibArgument("arg2", ValueKind.String, BrsInvalid.Instance),
                new StdlibArgument("arg3", ValueKind.String, BrsInvalid.Instance),
                new StdlibArgument("arg4", ValueKind.String, BrsInvalid.Instance),
                new StdlibArgument("arg5", ValueKind.String, BrsInvalid.Instance),
                new StdlibArgument("arg6", ValueKind.String, BrsInvalid.Instance),
            ],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, ...args: BrsString[]) => {
            let str = this.intrinsic.value;
            let arg = 0;
            const tokens = Array.from(new Set(str.match(/%([1-9])/g))).sort();
            if (tokens) {
                for (let token of tokens) {
                    if (!isBrsString(args[arg])) {
                        break;
                    }
                    str = str.replaceAll(token, args[arg].value);
                    arg++;
                }
            }
            if (arg < args.length && args[arg] instanceof BrsString) {
                BrsDevice.stderr.write(`warning,BRIGHTSCRIPT: WARNING: roString.Arg: unused parameters.`);
            }
            return new BrsString(str);
        },
    });

    /** Appends the first len characters of s to the end of the string. */
    private readonly appendString = new Callable("AppendString", {
        signature: {
            args: [new StdlibArgument("s", ValueKind.String), new StdlibArgument("len", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_, s: BrsString, len: Int32) => {
            const length = len.getValue();
            if (length > 0) {
                this.intrinsic = this.intrinsic.concat(new BrsString(s.value.slice(0, length)));
            }
            return BrsInvalid.Instance;
        },
    });

    /** Returns the number of characters in the string. */
    private readonly len = new Callable("Len", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_) => {
            return new Int32(this.intrinsic.value.length);
        },
    });

    /** Returns a string consisting of the first len characters of the string. */
    private readonly left = new Callable("Left", {
        signature: {
            args: [new StdlibArgument("len", ValueKind.Int32)],
            returns: ValueKind.String,
        },
        impl: (_, len: Int32) => {
            return new BrsString(this.intrinsic.value.slice(0, len.getValue()));
        },
    });

    /** Returns a string consisting of the last len characters of the string. */
    private readonly right = new Callable("Right", {
        signature: {
            args: [new StdlibArgument("len", ValueKind.Int32)],
            returns: ValueKind.String,
        },
        impl: (_, len: Int32) => {
            const source = this.intrinsic.value;
            const length = len.getValue();
            return length <= 0 ? new BrsString("") : new BrsString(source.slice(-length));
        },
    });

    private readonly mid = new Callable(
        "Mid",
        /**
         * Returns a string consisting of the last characters of the string, starting at the
         * zero-based start_index.
         */
        {
            signature: {
                args: [new StdlibArgument("start_index", ValueKind.Int32)],
                returns: ValueKind.String,
            },
            impl: (_, startIndex: Int32) => {
                return new BrsString(this.intrinsic.value.slice(startIndex.getValue()));
            },
        },

        /**
         * Returns a string consisting of num_chars characters of the string, starting at the
         * zero-based start_index.
         */
        {
            signature: {
                args: [
                    new StdlibArgument("start_index", ValueKind.Int32),
                    new StdlibArgument("num_chars", ValueKind.Int32),
                ],
                returns: ValueKind.String,
            },
            impl: (_, startIndex: Int32, numChars: Int32) => {
                let source = this.intrinsic.value;
                let start = startIndex.getValue() > 0 ? startIndex.getValue() : 0;
                let length = numChars.getValue() > 0 ? numChars.getValue() : 0;
                return new BrsString(source.substring(start, start + length));
            },
        }
    );

    private readonly instr = new Callable(
        "Instr",
        /** Returns the zero-based index of the first occurrence of substring in the string. */
        {
            signature: {
                args: [new StdlibArgument("substring", ValueKind.String)],
                returns: ValueKind.Int32,
            },
            impl: (_, substring: BrsString) => {
                return new Int32(this.intrinsic.value.indexOf(substring.value));
            },
        },
        /**
         * Returns the zero-based index of the first occurrence of substring in the string, starting
         * at the specified zero-based start_index.
         */
        {
            signature: {
                args: [
                    new StdlibArgument("start_index", ValueKind.Int32),
                    new StdlibArgument("substring", ValueKind.String),
                ],
                returns: ValueKind.Int32,
            },
            impl: (_, startIndex: Int32, substring: BrsString) => {
                if (substring.value === "") {
                    return new Int32(Math.max(0, startIndex.getValue()));
                }
                return new Int32(this.intrinsic.value.indexOf(substring.value, startIndex.getValue()));
            },
        }
    );

    /**
     * Returns a copy of the string with all instances of fromStr replaced with toStr. If fromStr is
     * empty the return value is the same as the source string.
     */
    private readonly replace = new Callable("Replace", {
        signature: {
            args: [new StdlibArgument("from", ValueKind.String), new StdlibArgument("to", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_, from: BrsString, to: BrsString) => {
            if (from.value === "") {
                return this.intrinsic;
            }

            // From Mozilla's guide to escaping regex:
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Escaping
            const escapedFrom = from.value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
            return new BrsString(this.intrinsic.value.replace(new RegExp(escapedFrom, "g"), to.value));
        },
    });

    /**
     * Returns the string with any leading and trailing whitespace characters (space, TAB, LF, CR,
     * VT, FF, NO-BREAK SPACE, et al) removed.
     */
    private readonly trim = new Callable("Trim", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_) => {
            return new BrsString(this.intrinsic.value.trim());
        },
    });

    /** Returns the value of the string interpreted as a decimal number. */
    private readonly toInt = new Callable("ToInt", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_) => {
            let int = Math.trunc(Number.parseFloat(this.intrinsic.value));

            if (Number.isNaN(int)) {
                // non-integers are returned as "0"
                return new Int32(0);
            }

            return new Int32(int);
        },
    });

    /** Returns the value of the string interpreted as a floating point number. */
    private readonly toFloat = new Callable("ToFloat", {
        signature: {
            args: [],
            returns: ValueKind.Float,
        },
        impl: (_) => {
            let float = Number.parseFloat(this.intrinsic.value);

            if (Number.isNaN(float)) {
                // non-integers are returned as "0"
                return new Float(0);
            }

            return new Float(float);
        },
    });

    /**
     * Splits the string into separate substrings separated by a single delimiter character. Returns
     * an roList containing each of the substrings. The delimiters are not returned.
     */
    private readonly tokenize = new Callable("Tokenize", {
        signature: {
            args: [new StdlibArgument("delim", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_, delim: BrsString) => {
            let str = this.intrinsic.value;
            let token: string[] = [];
            let tokens: BrsString[] = [];
            for (let char of str) {
                if (delim.value.includes(char)) {
                    if (token.length > 0) {
                        tokens.push(new BrsString(token.join("")));
                        token = [];
                    }
                } else {
                    token.push(char);
                }
            }
            if (token.length > 0) {
                tokens.push(new BrsString(token.join("")));
            }
            return new RoList(tokens);
        },
    });

    /**
     * Splits the input string using the separator string as a delimiter, and returns an array of
     * the split token strings (not including the delimiter). An empty separator string indicates
     * to split the string by character.
     */
    private readonly split = new Callable("Split", {
        signature: {
            args: [new StdlibArgument("separator", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_, separator: BrsString) => {
            let parts;
            if (separator.value === "") {
                // split characters apart, preserving multi-character unicode structures
                parts = Array.from(this.intrinsic.value);
            } else {
                parts = this.intrinsic.value.split(separator.value);
            }

            return new RoArray(parts.map((part) => new BrsString(part)));
        },
    });

    /**
     * Returns the string with certain characters ("'<>&) replaced with the corresponding HTML
     * entity encoding.
     */
    private readonly getEntityEncode = new Callable("GetEntityEncode", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_) => {
            return new BrsString(this.intrinsic.value.replace(/(['"<>&])/g, "\\$1"));
        },
    });

    /** URL encodes the specified string per RFC 3986 and returns the encoded string. */
    private readonly escape = new Callable("Escape", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_) => {
            return new BrsString(
                // encoding courtesy of
                // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent#Description
                encodeURIComponent(this.intrinsic.value).replace(
                    /[!'()*]/g,
                    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
                )
            );
        },
    });

    /** URL decodes the specified string per RFC 3986 and returns the decoded string. */
    private readonly unescape = new Callable("Unescape", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_) => {
            return new BrsString(decodeURIComponent(this.intrinsic.value));
        },
    });

    /** returns whether string is empty or not */
    private readonly isEmpty = new Callable("isEmpty", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_) => {
            return BrsBoolean.from(this.intrinsic.value.length === 0);
        },
    });

    /**
     * Encode the specified string with escape sequences for reserved Uniform Resource Identifier
     * (URI) characters.
     */
    private readonly encodeUri = new Callable("EncodeUri", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_) => {
            return new BrsString(encodeURI(this.intrinsic.value));
        },
    });

    /**
     * Decode the specified string with escape sequences for reserved Uniform Resource Identifier
     * (URI) characters.
     */
    private readonly decodeUri = new Callable("DecodeUri", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_) => {
            return new BrsString(decodeURI(this.intrinsic.value));
        },
    });

    /**
     * Encode the specified string with escape sequences for reserved Uniform Resource Identifier
     * (URI) component characters.
     */
    private readonly encodeUriComponent = new Callable("EncodeUriComponent", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_) => {
            return new BrsString(encodeURIComponent(this.intrinsic.value));
        },
    });

    private readonly decodeUriComponent = new Callable("DecodeUriCOmponent", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_) => {
            return new BrsString(decodeURIComponent(this.intrinsic.value));
        },
    });

    /** Checks whether the string starts with the substring specified in matchString, starting at the matchPos parameter (0-based character offset). */
    private readonly startsWith = new Callable("startsWith", {
        signature: {
            args: [
                new StdlibArgument("matchString", ValueKind.String),
                new StdlibArgument("position", ValueKind.Int32, BrsInvalid.Instance),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, matchString: BrsString, position: Int32 | BrsInvalid) => {
            if (position instanceof BrsInvalid) {
                return BrsBoolean.from(this.intrinsic.value.startsWith(matchString.value));
            }
            return BrsBoolean.from(this.intrinsic.value.startsWith(matchString.value, position.getValue()));
        },
    });

    /** Checks whether the string ends with the substring specified in matchString, starting at the position specified in the length parameter. */
    private readonly endsWith = new Callable("endsWith", {
        signature: {
            args: [
                new StdlibArgument("matchString", ValueKind.String),
                new StdlibArgument("position", ValueKind.Int32, BrsInvalid.Instance),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, matchString: BrsString, position: Int32 | BrsInvalid) => {
            if (position instanceof BrsInvalid) {
                return BrsBoolean.from(this.intrinsic.value.endsWith(matchString.value));
            }
            return BrsBoolean.from(this.intrinsic.value.endsWith(matchString.value, position.getValue()));
        },
    });

    /** Returns a format conversion using the specified printf-like format string and matching dynamic parameters. */
    private readonly format = new Callable("format", {
        signature: {
            args: [new StdlibArgument("arg", ValueKind.Dynamic, BrsInvalid.Instance)],
            variadic: true,
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter, ...additionalArgs: BrsType[]) => {
            // Documentation: https://developer.roku.com/docs/references/brightscript/language/format-strings.md
            let args: any[] = [];
            if (additionalArgs.length > 0) {
                for (const element of additionalArgs) {
                    if (isBrsNumber(element)) {
                        args.push(element.getValue());
                    } else if (element instanceof BrsString) {
                        args.push(element.value);
                    }
                }
            }
            try {
                return new BrsString(sprintf(this.intrinsic.value, ...args));
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(
                        `warning,roString.format() Error: ${err.message} at ${interpreter.formatLocation()}`
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
