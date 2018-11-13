import { BrsType, Callable, ValueKind, BrsString, Int32, Float } from "../brsTypes";
import { Interpreter } from "../interpreter";

/** Converts the string to all uppercase. */
export const UCase = new Callable(
    {
      name: "UCase",
      args: [{name: "s", type: ValueKind.String}],
      returns: ValueKind.String
    },
    (interpreter: Interpreter, s: BrsString) => new BrsString(s.value.toUpperCase())
);

/** Converts the string to all lowercase. */
export const LCase = new Callable(
    {
      name: "LCase",
      args: [{name: "s", type: ValueKind.String}],
      returns: ValueKind.String
    },
    (interpreter: Interpreter, s: BrsString) => new BrsString(s.value.toLowerCase())
);

/**
 * Returns the Unicode ("ASCII") value for the first character of the specified string.
 * An empty string argument will return `0`.
 */
export const Asc = new Callable(
    {
        name: "Asc",
        args: [{name: "letter", type: ValueKind.String}],
        returns: ValueKind.String
    },
    (interpreter: Interpreter, str: BrsString) => new Int32(str.value.charCodeAt(0) || 0)
);

/**
 * Performs the inverse of the `Asc` function: returns a one-character string whose character has
 * the specified Unicode value.
 *
 * Returns empty string (`""`) if the specified value is `0` or an invalid Unicode value.
 */
export const Chr = new Callable(
    {
        name: "Chr",
        args: [{name: "ch", type: ValueKind.Int32}],
        returns: ValueKind.String
    },
    (interpreter: Interpreter, ch: Int32) => {
        const num = ch.getValue();
        if (num <= 0) return new BrsString("");
        else return new BrsString(String.fromCharCode(num));
    }
);

/**
 * Returns the first n characters in a string
 */
export const Left = new Callable(
    {
        name: "Left",
        args: [{name: "s", type: ValueKind.String}, {name: "n", type: ValueKind.Int32}],
        returns: ValueKind.String
    },
    (interpreter: Interpreter, s: BrsString, n: Int32) => new BrsString(s.value.substr(0, n.getValue()))
);

/**
 * Returns the last n characters in a string
 */
export const Right = new Callable(
    {
        name: "Right",
        args: [{name: "s", type: ValueKind.String}, {name: "n", type: ValueKind.Int32}],
        returns: ValueKind.String
    },
    (interpreter: Interpreter, s: BrsString, n: Int32) => {
        let end = s.value.length - 1;
        let start = end - (n.getValue() - 1);

        if (n.getValue() <= 0) return new BrsString("");
        else if (start < 0) return new BrsString(s.value);
        return new BrsString(s.value.substr(start, end));
    }
);

/**
 * Returns the index (1 based) of a string inside another string. Zero if there is no match.
 */
export const Instr = new Callable(
    {
        name: "Instr",
        args: [{name: "start", type: ValueKind.Int32}, {name: "str", type: ValueKind.String}, {name: "search", type: ValueKind.String}],
        returns: ValueKind.String
    },
    (interpreter: Interpreter, start: Int32, str: BrsString, search: BrsString) => new Int32(str.value.indexOf(search.value, start.getValue() - 1) + 1)
);

/**
 * Return the number of characters in a string
 */
export const Len = new Callable(
    {
        name: "Len",
        args: [{name: "s", type: ValueKind.String}],
        returns: ValueKind.Int32
    },
    (interpreter: Interpreter, s: BrsString) => new Int32(s.value.length)
);

/**
 * Return a string located in the middle of another string from start index to end index
 */
export const Mid = new Callable(
    {
        name: "Mid",
        args: [{name: "s", type: ValueKind.String}, {name: "p", type: ValueKind.Int32}, {name: "n", type: ValueKind.Int32}],
        returns: ValueKind.String
    },
    (interpreter: Interpreter, s: BrsString, p: Int32, n: Int32): BrsString => {
        let start = p.getValue() - 1;
        return (n) ? new BrsString(s.value.substring(start, start + n.getValue())) : new BrsString(s.value.substring(start));
    }
);

/**
 * Return a string from a float. If it is positive, prefix it with a space.  
 */
export const Str = new Callable(
    {
        name: "Str",
        args: [{name: "value", type: ValueKind.Float}],
        returns: ValueKind.String
    },
    (interpreter: Interpreter, value: Float): BrsString => {
        const floatValue = value.getValue();
        const prefix = (floatValue > 0.0) ? " " : "";
        return new BrsString(prefix + String(floatValue));
    }
);

/**
 * Return a string from an integer. If it is positive, prefix it with a space.  
 */
export const StrI = new Callable(
    {
        name: "StrI",
        args: [{name: "value", type: ValueKind.Int32}],
        returns: ValueKind.String
    },
    (interpreter: Interpreter, value: Int32): BrsString => {
        const intValue = value.getValue();
        const prefix = (intValue > 0) ? " " : "";
        return new BrsString(prefix + String(intValue));
    }
);

/**
 * Return a float from a string
 */
export const Val = new Callable(
    {
        name: "Val",
        args: [{name: "s", type: ValueKind.String}],
        returns: ValueKind.Float
    },
    (interpreter: Interpreter, s: BrsString): Float => {
        return new Float(+s.value);
    }
);

