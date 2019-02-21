import { BrsType, Callable, ValueKind, BrsString, Int32, Float, StdlibArgument } from "../brsTypes";
import * as Expr from "../parser/Expression";
import { Interpreter } from "../interpreter";
import { BrsNumber } from "../brsTypes/BrsNumber";
import { Lexeme } from "../lexer";

/** Converts the string to all uppercase. */
export const UCase = new Callable(
    "UCase",
    {
        signature: {
            args: [new StdlibArgument("s", ValueKind.String)],
            returns: ValueKind.String
        },
        impl: (interpreter: Interpreter, s: BrsString) => new BrsString(s.value.toUpperCase())
    }
);

/** Converts the string to all lowercase. */
export const LCase = new Callable(
    "LCase",
    {
        signature: {
            args: [new StdlibArgument("s", ValueKind.String)],
            returns: ValueKind.String
        },
        impl: (interpreter: Interpreter, s: BrsString) => new BrsString(s.value.toLowerCase())
    }
);

/**
 * Returns the Unicode ("ASCII") value for the first character of the specified string.
 * An empty string argument will return `0`.
 */
export const Asc = new Callable(
    "Asc",
    {
        signature: {
            args: [new StdlibArgument("letter", ValueKind.String)],
            returns: ValueKind.String
        },
        impl: (interpreter: Interpreter, str: BrsString) => new Int32(str.value.charCodeAt(0) || 0)
    }
);

/**
 * Performs the inverse of the `Asc` function: returns a one-character string whose character has
 * the specified Unicode value.
 *
 * Returns empty string (`""`) if the specified value is `0` or an invalid Unicode value.
 */
export const Chr = new Callable(
    "Chr",
    {
        signature: {
            args: [new StdlibArgument("ch", ValueKind.Int32)],
            returns: ValueKind.String
        },
        impl: (interpreter: Interpreter, ch: Int32) => {
            const num = ch.getValue();
            if (num <= 0) return new BrsString("");
            else return new BrsString(String.fromCharCode(num));
        }
    },
);

/**
 * Returns the first n characters in a string
 */
export const Left = new Callable(
    "Left",
    {
        signature: {
            args: [new StdlibArgument("s", ValueKind.String), new StdlibArgument("n", ValueKind.Int32)],
            returns: ValueKind.String
        },
        impl: (interpreter: Interpreter, s: BrsString, n: Int32) => new BrsString(s.value.substr(0, n.getValue()))
    }
);

/**
 * Returns the last n characters in a string
 */
export const Right = new Callable(
    "Right",
    {
        signature: {
            args: [new StdlibArgument("s", ValueKind.String), new StdlibArgument("n", ValueKind.Int32)],
            returns: ValueKind.String
        },
        impl: (interpreter: Interpreter, s: BrsString, n: Int32) => {
            let end = s.value.length - 1;
            let start = end - (n.getValue() - 1);

            if (n.getValue() <= 0) return new BrsString("");
            else if (start < 0) return new BrsString(s.value);
            return new BrsString(s.value.substr(start, end));
        }
    }
);

/**
 * Returns the index (1 based) of a string inside another string. Zero if there is no match.
 */
export const Instr = new Callable(
    "Instr",
    {
        signature: {
            args: [new StdlibArgument("start", ValueKind.Int32), new StdlibArgument("str", ValueKind.String), new StdlibArgument("search", ValueKind.String)],
            returns: ValueKind.String
        },
        impl: (interpreter: Interpreter, start: Int32, str: BrsString, search: BrsString) => new Int32(str.value.indexOf(search.value, start.getValue() - 1) + 1)
    }
);

/**
 * Return the number of characters in a string
 */
export const Len = new Callable(
    "Len",
    {
        signature: {
            args: [new StdlibArgument("s", ValueKind.String)],
            returns: ValueKind.Int32
        },
        impl: (interpreter: Interpreter, s: BrsString) => new Int32(s.value.length)
    }
);

/**
 * Return a string located in the middle of another string from start index to end index
 */
export const Mid = new Callable(
    "Mid",
    {
        signature: {
            args: [
                new StdlibArgument("s", ValueKind.String),
                new StdlibArgument("p", ValueKind.Int32)
            ],
            returns: ValueKind.String
        },
        impl: (interpreter: Interpreter, s: BrsString, p: Int32): BrsString => {
            let start = p.getValue() - 1;
            return new BrsString(s.value.substring(start));
        }
    },
    {
        signature: {
            args: [
                new StdlibArgument("s", ValueKind.String),
                new StdlibArgument("p", ValueKind.Int32),
                new StdlibArgument("n", ValueKind.Int32)
            ],
            returns: ValueKind.String
        },
        impl: (interpreter: Interpreter, s: BrsString, p: Int32, n: Int32): BrsString => {
            let start = p.getValue() - 1;
            return new BrsString(s.value.substring(start, start + n.getValue()));
        }
    }
);

/**
 * Return a string from a float. If it is positive, prefix it with a space.
 */
export const Str = new Callable(
    "Str",
    {
        signature: {
            args: [new StdlibArgument("value", ValueKind.Float)],
            returns: ValueKind.String
        },
        impl: (interpreter: Interpreter, value: Float): BrsString => {
            const floatValue = value.getValue();
            const prefix = (floatValue > 0.0) ? " " : "";
            return new BrsString(prefix + String(floatValue));
        }
    },
);

/**
 * Return a string from an integer. If it is positive, prefix it with a space.
 */
export const StrI = new Callable(
    "StrI",
    {
        signature: {
            args: [
                new StdlibArgument("value", ValueKind.Int32),
                new StdlibArgument("radix", ValueKind.Int32, new Int32(10))
            ],
            returns: ValueKind.String
        },
        impl: (interpreter: Interpreter, value: Int32, brsRadix: Int32): BrsString => {
            let radix = brsRadix.getValue();
            if (radix < 2 || radix > 36) {
                return new BrsString("");
            }

            const intValue = value.getValue();
            const prefix = (intValue > 0 && radix === 10) ? " " : "";

            return new BrsString(prefix + intValue.toString(radix));
        }
    }
);

/**
 * Return a string from another string replacing instances of {index} with the
 * respective parameter.
 */
export const Substitute = new Callable(
    "Substitute",
    {
        signature: {
            args: [
                new StdlibArgument("str", ValueKind.String),
                new StdlibArgument("arg0", ValueKind.String),
                new StdlibArgument("arg1", ValueKind.String, new BrsString("")),
                new StdlibArgument("arg2", ValueKind.String, new BrsString("")),
                new StdlibArgument("arg3", ValueKind.String, new BrsString(""))
            ],
            returns: ValueKind.String
        },
        impl: (interpreter: Interpreter, str: BrsString, arg0: BrsString, arg1: BrsString, arg2: BrsString, arg3: BrsString): BrsString => {
            let completelyReplaced = [arg0, arg1, arg2, arg3].reduce(
                (replaced, replacement, index) => replaced.replace(new RegExp(`\\{${index}\\}`, "g"), replacement.value),
                str.value
            );
            return new BrsString(completelyReplaced);
        }
    }
);

/**
 * Return a float or integer from a string
 */
export const Val = new Callable(
    "Val",
    {
        signature: {
            args: [
                new StdlibArgument("s", ValueKind.String),
                new StdlibArgument("radix", ValueKind.Int32, new Int32(10))
            ],
            returns: ValueKind.Dynamic
        },
        impl: (interpreter: Interpreter, s: BrsString, brsRadix: Int32): BrsNumber => {
            function isBrsStrFloat(str: BrsString): boolean {
                return str.value.includes(".");
            }

            if (isBrsStrFloat(s)) {
                return new Float(Number(s.value));
            } else {
                return new Int32(parseInt(s.value, brsRadix.getValue()));
            }
        }
    },
);

/**
 * Return an integer from a string or 0 if it can't be parsed.
 */
export const StrToI = new Callable(
    "StrToI",
    {
        signature: {
            args: [
                new StdlibArgument("s", ValueKind.String)
            ],
            returns: ValueKind.Int32
        },
        impl: (interpreter: Interpreter, s: BrsString): BrsNumber => {
            let integerValue = parseInt(s.value);

            if (Number.isNaN(integerValue)) {
                return new Int32(0);
            }

            return new Int32(integerValue);
        }
    }
);
