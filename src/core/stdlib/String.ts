import { Callable, ValueKind, BrsString, Int32, Float, StdlibArgument, BrsInvalid } from "../brsTypes";
import { Interpreter } from "../interpreter";
import { BrsNumber } from "../brsTypes/BrsNumber";

/** Converts the string to all uppercase. */
export const UCase = new Callable("UCase", {
    signature: {
        args: [new StdlibArgument("s", ValueKind.String)],
        returns: ValueKind.String,
    },
    impl: (_: Interpreter, s: BrsString) => new BrsString(s.value.toUpperCase()),
});

/** Converts the string to all lowercase. */
export const LCase = new Callable("LCase", {
    signature: {
        args: [new StdlibArgument("s", ValueKind.String)],
        returns: ValueKind.String,
    },
    impl: (_: Interpreter, s: BrsString) => new BrsString(s.value.toLowerCase()),
});

/**
 * Returns the Unicode ("ASCII") value for the first character of the specified string.
 * An empty string argument will return `0`.
 */
export const Asc = new Callable("Asc", {
    signature: {
        args: [new StdlibArgument("letter", ValueKind.String)],
        returns: ValueKind.Int32,
    },
    impl: (_: Interpreter, str: BrsString) => {
        if (str.value.length === 0) {
            return new Int32(0); // Return 0 for empty strings
        }
        return new Int32(str.value.codePointAt(0) ?? 0); // Use codePointAt for full Unicode support
    },
});

/**
 * Performs the inverse of the `Asc` function: returns a one-character string whose character has
 * the specified Unicode value.
 *
 * Returns empty string (`""`) if the specified value is `0` or an invalid Unicode value.
 */
export const Chr = new Callable("Chr", {
    signature: {
        args: [new StdlibArgument("ch", ValueKind.Int32)],
        returns: ValueKind.String,
    },
    impl: (_: Interpreter, ch: Int32) => {
        const num = ch.getValue();
        const chr = num <= 0 || num > 0x10ffff ? "" : String.fromCodePoint(num);
        return new BrsString(chr);
    },
});

/**
 * Returns the first n characters in a string
 */
export const Left = new Callable("Left", {
    signature: {
        args: [new StdlibArgument("s", ValueKind.String), new StdlibArgument("n", ValueKind.Int32)],
        returns: ValueKind.String,
    },
    impl: (_: Interpreter, s: BrsString, n: Int32) => {
        if (n.getValue() <= 0) return new BrsString("");
        return new BrsString(s.value.slice(0, n.getValue()));
    },
});

/**
 * Returns the last n characters in a string
 */
export const Right = new Callable("Right", {
    signature: {
        args: [new StdlibArgument("s", ValueKind.String), new StdlibArgument("n", ValueKind.Int32)],
        returns: ValueKind.String,
    },
    impl: (_: Interpreter, s: BrsString, n: Int32) => {
        if (n.getValue() <= 0) return new BrsString("");
        return new BrsString(s.value.slice(-n.getValue()));
    },
});

/**
 * Returns the index (1 based) of a string inside another string. Zero if there is no match.
 */
export const Instr = new Callable(
    "Instr",
    {
        signature: {
            args: [
                new StdlibArgument("start", ValueKind.Int32),
                new StdlibArgument("str", ValueKind.String),
                new StdlibArgument("search", ValueKind.String),
            ],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, start: Int32, str: BrsString, search: BrsString) =>
            new Int32(str.value.indexOf(search.value, start.getValue() - 1) + 1),
    },
    {
        signature: {
            args: [new StdlibArgument("str", ValueKind.String), new StdlibArgument("search", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, str: BrsString, search: BrsString) => new Int32(str.value.indexOf(search.value) + 1),
    }
);

/**
 * Return the number of characters in a string
 */
export const Len = new Callable("Len", {
    signature: {
        args: [new StdlibArgument("s", ValueKind.String)],
        returns: ValueKind.Int32,
    },
    impl: (_: Interpreter, s: BrsString) => new Int32(s.value.length),
});

/**
 * Return a string located in the middle of another string from start index to end index
 */
export const Mid = new Callable(
    "Mid",
    {
        signature: {
            args: [new StdlibArgument("s", ValueKind.String), new StdlibArgument("p", ValueKind.Int32)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, s: BrsString, p: Int32): BrsString => {
            let start = p.getValue() - 1;
            return new BrsString(s.value.substring(start));
        },
    },
    {
        signature: {
            args: [
                new StdlibArgument("s", ValueKind.String),
                new StdlibArgument("p", ValueKind.Int32),
                new StdlibArgument("n", ValueKind.Int32),
            ],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, s: BrsString, p: Int32, n: Int32): BrsString => {
            const start = p.getValue() - 1;
            const length = n.getValue();
            if (length <= 0) return new BrsString("");
            return new BrsString(s.value.substring(start, start + length));
        },
    }
);

/**
 * Return a string from a float/double. If it is positive, prefix it with a space.
 */
export const Str = new Callable("Str", {
    signature: {
        args: [new StdlibArgument("value", ValueKind.Float)],
        returns: ValueKind.String,
    },
    impl: (_: Interpreter, value: Float): BrsString => {
        const floatValue = value.getValue();
        const prefix = floatValue >= 0.0 ? " " : "";
        return new BrsString(prefix + String(floatValue));
    },
});

/**
 * Return a string from an integer. If it is positive, prefix it with a space.
 */
export const StrI = new Callable("StrI", {
    signature: {
        args: [
            new StdlibArgument("value", ValueKind.Int32),
            new StdlibArgument("radix", ValueKind.Int32, new Int32(10)),
        ],
        returns: ValueKind.String,
    },
    impl: (_: Interpreter, value: Int32, brsRadix: Int32): BrsString => {
        let radix = brsRadix.getValue();
        if (radix < 2 || radix > 36) {
            return new BrsString("");
        }

        const intValue = value.getValue();
        const prefix = intValue >= 0 && radix === 10 ? " " : "";

        return new BrsString(prefix + intValue.toString(radix));
    },
});

/**
 * Returns a string composed of n copies of the second argument concatenated together.
 */
export const STRING = new Callable("String", {
    //Defined in uppercase to avoid conflict with javascript String class
    signature: {
        args: [new StdlibArgument("n", ValueKind.Int32), new StdlibArgument("str", ValueKind.String)],
        returns: ValueKind.String,
    },
    impl: (_: Interpreter, n: Int32, str: BrsString): BrsString => {
        return new BrsString(str.value.repeat(n.getValue()));
    },
});

/**
 * Returns a string composed of n copies of the character whose Unicode value is the second argument.
 */
export const StringI = new Callable("StringI", {
    signature: {
        args: [new StdlibArgument("n", ValueKind.Int32), new StdlibArgument("ch", ValueKind.Int32)],
        returns: ValueKind.String,
    },
    impl: (_: Interpreter, n: Int32, ch: Int32): BrsString => {
        return new BrsString(String.fromCharCode(ch.getValue()).repeat(n.getValue()));
    },
});

/**
 * Return a string from another string replacing instances of {index} with the
 * respective parameter.
 */
export const Substitute = new Callable("Substitute", {
    signature: {
        args: [
            new StdlibArgument("str", ValueKind.String),
            new StdlibArgument("arg0", ValueKind.String),
            new StdlibArgument("arg1", ValueKind.String, new BrsString("")),
            new StdlibArgument("arg2", ValueKind.String, new BrsString("")),
            new StdlibArgument("arg3", ValueKind.String, new BrsString("")),
        ],
        returns: ValueKind.String,
    },
    impl: (
        _: Interpreter,
        str: BrsString,
        arg0: BrsString,
        arg1: BrsString,
        arg2: BrsString,
        arg3: BrsString
    ): BrsString => {
        let completelyReplaced = [arg0, arg1, arg2, arg3].reduce((replaced, replacement, index) => {
            const regex = new RegExp(`\\{${index}\\}|\\^${index}`, "g");
            return replaced.replace(regex, replacement.value);
        }, str.value);
        return new BrsString(completelyReplaced);
    },
});

/**
 * Return a float or integer from a string
 */
export const Val = new Callable("Val", {
    signature: {
        args: [
            new StdlibArgument("s", ValueKind.String),
            new StdlibArgument("radix", ValueKind.Int32, BrsInvalid.Instance),
        ],
        returns: ValueKind.Dynamic,
    },
    impl: (_: Interpreter, s: BrsString, brsRadix: Int32 | BrsInvalid): BrsNumber => {
        const isFloat = s.value.includes(".");
        if (isFloat || brsRadix instanceof BrsInvalid) {
            const retNumber = Number(s.value);
            if (Number.isNaN(retNumber)) {
                return new Float(0);
            }
            return new Float(retNumber);
        } else {
            const retNumber = parseInt(s.value, brsRadix.getValue());
            if (Number.isNaN(retNumber)) {
                return new Int32(0);
            }
            return new Int32(retNumber);
        }
    },
});

/**
 * Return an integer from a string or 0 if it can't be parsed.
 */
export const StrToI = new Callable("StrToI", {
    signature: {
        args: [new StdlibArgument("s", ValueKind.String)],
        returns: ValueKind.Int32,
    },
    impl: (_: Interpreter, s: BrsString): BrsNumber => {
        let integerValue = parseInt(s.value);

        if (Number.isNaN(integerValue)) {
            return new Int32(0);
        }

        return new Int32(integerValue);
    },
});
