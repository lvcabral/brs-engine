import { Callable, ValueKind, BrsString, Int32, Float, Double, StdlibArgument, BrsInvalid } from "../brsTypes";
import { Interpreter } from "../interpreter";
import { BrsNumber, signedSpecialText } from "../brsTypes/BrsNumber";

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
 * Return a string from a numeric value. If it is positive, prefix it with a space.
 * Uses a single Double overload so that Float, Int32, and Int64 all coerce without
 * precision loss (JavaScript numbers are 64-bit doubles natively).
 */
export const Str = new Callable("Str", {
    signature: {
        args: [new StdlibArgument("value", ValueKind.Double)],
        returns: ValueKind.String,
    },
    impl: (_: Interpreter, value: Double): BrsString => {
        const doubleValue = value.getValue();
        const text = signedSpecialText(doubleValue) ?? String(doubleValue);
        return new BrsString(text.startsWith("-") ? text : " " + text);
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
        const repeatCount = n.getValue();
        if (repeatCount <= 0) {
            return new BrsString("");
        }
        return new BrsString(str.value.repeat(repeatCount));
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
        const repeatCount = n.getValue();
        if (repeatCount <= 0) {
            return new BrsString("");
        }
        const num = ch.getValue();
        const chr = num <= 0 || num > 0x10ffff ? "" : String.fromCodePoint(num);
        return new BrsString(chr.repeat(repeatCount));
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
 * Return a float or integer from a string: without a radix, the string is read like C's `strtod` (a Float);
 * with one, like `strtol` (an Integer). Both read the longest valid prefix, as on a Roku device.
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
        if (brsRadix instanceof BrsInvalid) {
            return new Float(parseFloatPrefix(s.value));
        }
        return new Int32(parseIntPrefix(s.value, brsRadix.getValue()));
    },
});

/** C `isspace` characters, which `strtod`/`strtol` skip before the number. */
const leadingSpace = /^[\t\n\v\f\r ]*/;

/**
 * Reads the longest prefix of `text` that is a number, like C's `strtod`: decimal or `0x` hexadecimal (with an
 * optional fraction and exponent), `inf`/`infinity` or `nan`/`nan(...)`, case-insensitive, with an optional sign.
 * @param text the string.
 * @returns the number, or 0 when there is none.
 */
function parseFloatPrefix(text: string): number {
    const match =
        /^([+-]?)(?:(inf(?:inity)?)|(nan)(?:\(\w*\))?|0x((?:[\da-f]+(?:\.[\da-f]*)?|\.[\da-f]+)(?:p[+-]?\d+)?)|((?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?))/i.exec(
            text.replace(leadingSpace, "")
        );
    if (!match) {
        return 0;
    }
    const [, sign, inf, nan, hex, decimal] = match;
    let value: number;
    if (inf) {
        value = Infinity;
    } else if (nan) {
        value = Number.NaN;
    } else if (hex) {
        const [mantissa, exponent = "0"] = hex.toLowerCase().split("p");
        const [whole, fraction = ""] = mantissa.split(".");
        value = (Number.parseInt(whole + fraction || "0", 16) / 16 ** fraction.length) * 2 ** Number(exponent);
    } else {
        value = Number(decimal);
    }
    return sign === "-" ? -value : value;
}

/**
 * Reads the longest prefix of `text` that is an integer in `radix`, like C's `strtol`: radix 0 picks 16 for a `0x`
 * prefix, 8 for a leading `0` and 10 otherwise, and radix 16 allows a `0x` prefix. A decimal result is clamped to
 * the Integer range; any other radix keeps the low 32 bits, saturating past 32 unsigned bits (as on a device).
 * @param text the string.
 * @param radix the radix: 0, or 2 to 36.
 * @returns the integer, or 0 when there is none or the radix is invalid.
 */
function parseIntPrefix(text: string, radix: number): number {
    if (radix !== 0 && (radix < 2 || radix > 36)) {
        return 0;
    }
    let rest = text.replace(leadingSpace, "");
    const negative = rest.startsWith("-");
    if (negative || rest.startsWith("+")) {
        rest = rest.slice(1);
    }
    const hexPrefix = /^0x[\da-f]/i.test(rest);
    if ((radix === 0 || radix === 16) && hexPrefix) {
        radix = 16;
        rest = rest.slice(2);
    } else if (radix === 0) {
        radix = rest.startsWith("0") ? 8 : 10;
    }
    let digits = 0n;
    let count = 0;
    for (const char of rest) {
        const digit = Number.parseInt(char, 36);
        if (Number.isNaN(digit) || digit >= radix) {
            break;
        }
        digits = digits * BigInt(radix) + BigInt(digit);
        count++;
    }
    if (count === 0) {
        return 0;
    }
    const value = negative ? -digits : digits;
    if (radix === 10) {
        return Number(clamp(value, -(2n ** 31n), 2n ** 31n - 1n));
    }
    return Number(BigInt.asIntN(32, clamp(value, -(2n ** 31n), 2n ** 32n - 1n)));
}

/**
 * `value` limited to the range `min` to `max`.
 * @param value the value.
 * @param min the lowest value.
 * @param max the highest value.
 * @returns the clamped value.
 */
function clamp(value: bigint, min: bigint, max: bigint) {
    if (value < min) {
        return min;
    } else if (value > max) {
        return max;
    }
    return value;
}

/**
 * Return an integer from a string or 0 if it can't be parsed.
 */
export const StrToI = new Callable("StrToI", {
    signature: {
        args: [new StdlibArgument("s", ValueKind.String)],
        returns: ValueKind.Int32,
    },
    impl: (_: Interpreter, s: BrsString): BrsNumber => {
        let integerValue = Number.parseInt(s.value);

        if (Number.isNaN(integerValue)) {
            return new Int32(0);
        }

        return new Int32(integerValue);
    },
});
