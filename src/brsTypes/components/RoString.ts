import { BrsComponent } from "./BrsComponent";
import { RoArray } from "./RoArray";
import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid, Comparable } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { BrsType, RoList } from "..";
import { Unboxable } from "../Boxing";
import { Int32 } from "../Int32";
import { Float } from "../Float";

export class RoString extends BrsComponent implements BrsValue, Comparable, Unboxable {
    readonly kind = ValueKind.Object;
    private intrinsic: BrsString = new BrsString("");

    public getValue(): string {
        return this.intrinsic.value;
    }

    constructor(initialValue?: BrsString) {
        super("roString");

        if (initialValue) {
            this.intrinsic = initialValue;
        }

        this.registerMethods({
            ifString: [this.setString, this.getString],
            ifStringOps: [
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
                this.setString,
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
            ],
            ifToStr: [this.toStr],
        });
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other.kind === ValueKind.String) {
            return BrsBoolean.from(other.value === this.intrinsic.value);
        }

        if (other instanceof RoString) {
            return BrsBoolean.from(other.intrinsic.value === this.intrinsic.value);
        }

        return BrsBoolean.False;
    }

    lessThan(other: BrsType): BrsBoolean {
        if (other.kind === ValueKind.String) {
            return this.unbox().lessThan(other);
        }

        if (other instanceof RoString) {
            return this.unbox().lessThan(other.unbox());
        }

        return BrsBoolean.False;
    }

    greaterThan(other: BrsType): BrsBoolean {
        if (other.kind === ValueKind.String) {
            return this.unbox().greaterThan(other);
        }

        if (other instanceof RoString) {
            return this.unbox().greaterThan(other.unbox());
        }

        return BrsBoolean.False;
    }

    unbox() {
        return this.intrinsic;
    }

    toString(parent?: BrsType): string {
        return this.intrinsic.toString(parent);
    }

    /**
     * Sets the string to the first len characters of s.
     * Note: this method is implemented in the ifString and ifStringOps interfaces
     */
    private setString = new Callable(
        "SetString",
        {
            signature: {
                args: [new StdlibArgument("s", ValueKind.String)],
                returns: ValueKind.Void,
            },
            impl: (_interpreter, s: BrsString) => {
                this.intrinsic = new BrsString(s.value);
                return BrsInvalid.Instance;
            },
        },
        {
            signature: {
                args: [
                    new StdlibArgument("s", ValueKind.String),
                    new StdlibArgument("len", ValueKind.Int32),
                ],
                returns: ValueKind.Void,
            },
            impl: (_interpreter, s: BrsString, len: Int32) => {
                this.intrinsic = new BrsString(s.value.substr(0, len.getValue()));
                return BrsInvalid.Instance;
            },
        }
    );

    private getString = new Callable("GetString", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_interpreter) => this.intrinsic,
    });

    // ---------- ifStringOps ----------
    /** Appends the first len characters of s to the end of the string. */
    private appendString = new Callable("AppendString", {
        signature: {
            args: [
                new StdlibArgument("s", ValueKind.String),
                new StdlibArgument("len", ValueKind.Int32),
            ],
            returns: ValueKind.Void,
        },
        impl: (_interpreter, s: BrsString, len: Int32) => {
            this.intrinsic = this.intrinsic.concat(
                new BrsString(s.value.substr(0, len.getValue()))
            );
            return BrsInvalid.Instance;
        },
    });

    /** Returns the number of characters in the string. */
    private len = new Callable("Len", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_interpreter) => {
            return new Int32(this.intrinsic.value.length);
        },
    });

    /** Returns a string consisting of the first len characters of the string. */
    private left = new Callable("Left", {
        signature: {
            args: [new StdlibArgument("len", ValueKind.Int32)],
            returns: ValueKind.String,
        },
        impl: (_interpreter, len: Int32) => {
            return new BrsString(this.intrinsic.value.substr(0, len.getValue()));
        },
    });

    /** Returns a string consisting of the last len characters of the string. */
    private right = new Callable("Right", {
        signature: {
            args: [new StdlibArgument("len", ValueKind.Int32)],
            returns: ValueKind.String,
        },
        impl: (_interpreter, len: Int32) => {
            let source = this.intrinsic.value;
            return new BrsString(source.substr(source.length - len.getValue()));
        },
    });

    private mid = new Callable(
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
            impl: (_interpreter, startIndex: Int32) => {
                return new BrsString(this.intrinsic.value.substr(startIndex.getValue()));
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
            impl: (_interpreter, startIndex: Int32, numChars: Int32) => {
                let source = this.intrinsic.value;
                return new BrsString(
                    this.intrinsic.value.substr(startIndex.getValue(), numChars.getValue())
                );
            },
        }
    );

    private instr = new Callable(
        "Instr",
        /** Returns the zero-based index of the first occurrence of substring in the string. */
        {
            signature: {
                args: [new StdlibArgument("substring", ValueKind.String)],
                returns: ValueKind.Int32,
            },
            impl: (_interpreter, substring: BrsString) => {
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
            impl: (_interpreter, startIndex: Int32, substring: BrsString) => {
                return new Int32(
                    this.intrinsic.value.indexOf(substring.value, startIndex.getValue())
                );
            },
        }
    );

    /**
     * Returns a copy of the string with all instances of fromStr replaced with toStr. If fromStr is
     * empty the return value is the same as the source string.
     */
    private replace = new Callable("Replace", {
        signature: {
            args: [
                new StdlibArgument("from", ValueKind.String),
                new StdlibArgument("to", ValueKind.String),
            ],
            returns: ValueKind.String,
        },
        impl: (_interpreter, from: BrsString, to: BrsString) => {
            if (from.value === "") {
                return this.intrinsic;
            }

            // From Mozilla's guide to escaping regex:
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Escaping
            let escapedFrom = from.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            return new BrsString(
                this.intrinsic.value.replace(new RegExp(escapedFrom, "g"), to.value)
            );
        },
    });

    /**
     * Returns the string with any leading and trailing whitespace characters (space, TAB, LF, CR,
     * VT, FF, NO-BREAK SPACE, et al) removed.
     */
    private trim = new Callable("Trim", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_interpreter) => {
            return new BrsString(this.intrinsic.value.trim());
        },
    });

    /** Returns the value of the string interpreted as a decimal number. */
    private toInt = new Callable("ToInt", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_interpreter) => {
            let int = Math.trunc(Number.parseFloat(this.intrinsic.value));

            if (Number.isNaN(int)) {
                // non-integers are returned as "0"
                return new Int32(0);
            }

            return new Int32(int);
        },
    });

    /** Returns the value of the string interpreted as a floating point number. */
    private toFloat = new Callable("ToFloat", {
        signature: {
            args: [],
            returns: ValueKind.Float,
        },
        impl: (_interpreter) => {
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
    private tokenize = new Callable("Tokenize", {
        signature: {
            args: [new StdlibArgument("delim", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_interpreter, delim: BrsString) => {
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
    private split = new Callable("Split", {
        signature: {
            args: [new StdlibArgument("separator", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_interpreter, separator: BrsString) => {
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
    private getEntityEncode = new Callable("GetEntityEncode", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_interpreter) => {
            return new BrsString(this.intrinsic.value.replace(/(['"<>&])/g, "\\$1"));
        },
    });

    /** URL encodes the specified string per RFC 3986 and returns the encoded string. */
    private escape = new Callable("Escape", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_interpreter) => {
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
    private unescape = new Callable("Unescape", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_interpreter) => {
            return new BrsString(decodeURIComponent(this.intrinsic.value));
        },
    });

    /** returns whether string is empty or not */
    private isEmpty = new Callable("isEmpty", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_interpreter) => {
            return BrsBoolean.from(this.intrinsic.value.length === 0);
        },
    });

    /**
     * Encode the specified string with escape sequences for reserved Uniform Resource Identifier
     * (URI) characters.
     */
    private encodeUri = new Callable("EncodeUri", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_interpreter) => {
            return new BrsString(encodeURI(this.intrinsic.value));
        },
    });

    /**
     * Decode the specified string with escape sequences for reserved Uniform Resource Identifier
     * (URI) characters.
     */
    private decodeUri = new Callable("DecodeUri", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_interpreter) => {
            return new BrsString(decodeURI(this.intrinsic.value));
        },
    });

    /**
     * Encode the specified string with escape sequences for reserved Uniform Resource Identifier
     * (URI) component characters.
     */
    private encodeUriComponent = new Callable("EncodeUriComponent", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_interpreter) => {
            return new BrsString(encodeURIComponent(this.intrinsic.value));
        },
    });

    private decodeUriComponent = new Callable("DecodeUriCOmponent", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_interpreter) => {
            return new BrsString(decodeURIComponent(this.intrinsic.value));
        },
    });

    /** Checks whether the string starts with the substring specified in matchString, starting at the matchPos parameter (0-based character offset). */
    private startsWith = new Callable("startsWith", {
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
            return BrsBoolean.from(
                this.intrinsic.value.startsWith(matchString.value, position.getValue())
            );
        },
    });

    /** Checks whether the string ends with the substring specified in matchString, starting at the position specified in the length parameter. */
    private endsWith = new Callable("endsWith", {
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
            return BrsBoolean.from(
                this.intrinsic.value.endsWith(matchString.value, position.getValue())
            );
        },
    });

    private toStr = new Callable("toStr", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_interpreter) => this.intrinsic,
    });
}
