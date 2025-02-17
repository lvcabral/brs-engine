import { RuntimeError, RuntimeErrorDetail } from "../error/BrsError";
import {
    Callable,
    ValueKind,
    Int32,
    Float,
    StdlibArgument,
    BrsType,
    isUnboxable,
    BrsNumber,
    isBrsNumber,
} from "../brsTypes";
import { Interpreter } from "../interpreter";

/** Returns the absolute value of a float. */
export const Abs = new Callable("Abs", {
    signature: {
        args: [new StdlibArgument("x", ValueKind.Float)],
        returns: ValueKind.Float,
    },
    impl: (_: Interpreter, x: Float) => new Float(Math.abs(x.getValue())),
});

/*
 * Returns the integer as a 32-bit float.
 * ** NOTE: the function name implies it makes a 64-bit float, but the docs say
 *     it currently returns a 32-bit float, but may return a 64-bit float in the future.
 */
export const Cdbl = new Callable("Cdbl", {
    signature: {
        args: [new StdlibArgument("x", ValueKind.Int32)],
        returns: ValueKind.Float,
    },
    impl: (_: Interpreter, x: Int32) => new Float(x.getValue()),
});

/** Returns an integer from a float rounding up from midpoints */
export const Cint = new Callable("Cint", {
    signature: {
        args: [new StdlibArgument("x", ValueKind.Dynamic)],
        returns: ValueKind.Int32,
    },
    impl: (interpreter: Interpreter, x: BrsType) => {
        if (isUnboxable(x)) {
            x = x.unbox();
        }
        if (isBrsNumber(x)) {
            return toInt32(x, "round");
        }
        interpreter.addError(
            new RuntimeError(
                RuntimeErrorDetail.TypeMismatch,
                interpreter.location,
                interpreter.stack.slice(0, -1)
            )
        );
    },
});

/** Returns the integer as a 32-bit float. */
export const Csng = new Callable("Csng", {
    signature: {
        args: [new StdlibArgument("x", ValueKind.Int32)],
        returns: ValueKind.Float,
    },
    impl: (_: Interpreter, x: Int32) => new Float(x.getValue()),
});

/** Returns an integer from a float removing fractional parts. */
export const Fix = new Callable("Fix", {
    signature: {
        args: [new StdlibArgument("x", ValueKind.Dynamic)],
        returns: ValueKind.Int32,
    },
    impl: (interpreter: Interpreter, x: BrsType) => {
        if (isUnboxable(x)) {
            x = x.unbox();
        }
        if (isBrsNumber(x)) {
            return toInt32(x, "trunc");
        }
        interpreter.addError(
            new RuntimeError(
                RuntimeErrorDetail.TypeMismatch,
                interpreter.location,
                interpreter.stack.slice(0, -1)
            )
        );
    },
});

/** Returns an integer from a float. */
export const Int = new Callable("Int", {
    signature: {
        args: [new StdlibArgument("x", ValueKind.Dynamic)],
        returns: ValueKind.Int32,
    },
    impl: (interpreter: Interpreter, x: BrsType) => {
        if (isUnboxable(x)) {
            x = x.unbox();
        }
        if (isBrsNumber(x)) {
            return toInt32(x);
        }
        interpreter.addError(
            new RuntimeError(
                RuntimeErrorDetail.TypeMismatch,
                interpreter.location,
                interpreter.stack.slice(0, -1)
            )
        );
    },
});

function toInt32(x: BrsNumber, decimal = "floor"): Int32 {
    if (x.kind === ValueKind.Float || x.kind === ValueKind.Double) {
        if (decimal === "round") {
            return new Int32(Math.round(x.getValue()));
        } else if (decimal === "trunc") {
            return new Int32(Math.trunc(x.getValue()));
        }
        return new Int32(Math.floor(x.getValue()));
    } else if (x.kind === ValueKind.Int64) {
        const maxInt = 0x80000000;
        if (x.getValue().lessThan(maxInt) && x.getValue().greaterThan(-maxInt)) {
            return new Int32(x.getValue());
        } else if (x.getValue().greaterThan(maxInt - 1)) {
            return new Int32(maxInt - 1);
        } else {
            return new Int32(-maxInt);
        }
    }
    return x;
}

function SgnImpl(_: Interpreter, x: Int32 | Float) {
    let val = x.getValue();
    if (val > 0.0) return new Int32(1);
    else if (val < 0.0) return new Int32(-1);
    else return new Int32(0);
}

/** Returns -1 if parameter is negative, 0 if zero, and 1 if positive. */
export const Sgn = new Callable(
    "Sgn",
    {
        signature: {
            args: [new StdlibArgument("x", ValueKind.Float)],
            returns: ValueKind.Int32,
        },
        impl: SgnImpl,
    },
    {
        signature: {
            args: [new StdlibArgument("x", ValueKind.Int32)],
            returns: ValueKind.Int32,
        },
        impl: SgnImpl,
    }
);

/** Returns the arc-tangent (in radians) of a float. */
export const Atn = new Callable("Atn", {
    signature: {
        args: [new StdlibArgument("x", ValueKind.Float)],
        returns: ValueKind.Float,
    },
    impl: (_: Interpreter, x: Float) => new Float(Math.atan(x.getValue())),
});

/** Returns the cosine of a float (argument must be provided in radians). */
export const Cos = new Callable("Cos", {
    signature: {
        args: [new StdlibArgument("x", ValueKind.Float)],
        returns: ValueKind.Float,
    },
    impl: (_: Interpreter, x: Float) => new Float(Math.cos(x.getValue())),
});

/** Returns the sine of a float (argument must be provided in radians). */
export const Sin = new Callable("Sin", {
    signature: {
        args: [new StdlibArgument("x", ValueKind.Float)],
        returns: ValueKind.Float,
    },
    impl: (_: Interpreter, x: Float) => new Float(Math.sin(x.getValue())),
});

/** Returns the tangent float (argument must be provided in radians). */
export const Tan = new Callable("Tan", {
    signature: {
        args: [new StdlibArgument("x", ValueKind.Float)],
        returns: ValueKind.Float,
    },
    impl: (_: Interpreter, x: Float) => new Float(Math.tan(x.getValue())),
});

/** Returns the natural exponent of a float. */
export const Exp = new Callable("Exp", {
    signature: {
        args: [new StdlibArgument("x", ValueKind.Float)],
        returns: ValueKind.Float,
    },
    impl: (_: Interpreter, x: Float) => new Float(Math.exp(x.getValue())),
});

/** Returns the log of a float. */
export const Log = new Callable("Log", {
    signature: {
        args: [new StdlibArgument("x", ValueKind.Float)],
        returns: ValueKind.Float,
    },
    impl: (_: Interpreter, x: Float) => new Float(Math.log(x.getValue())),
});

/** Returns the square root of a float. */
export const Sqr = new Callable("Sqr", {
    signature: {
        args: [new StdlibArgument("x", ValueKind.Float)],
        returns: ValueKind.Float,
    },
    impl: (_: Interpreter, x: Float) => new Float(Math.sqrt(x.getValue())),
});

/**
 * Returns a random number in a given range. If the range is zero, a random
 * float between [0,1) is returned. If the range is a positive number, a
 * random integer between 1 and that number is returned (inclusive is returned).
 *
 * **NOTE:** the float returned is in the range [0,1) to match the javascript
 *     implementation, while the brightscript specification calls for (0,1).
 *     This should be okay in practice, but if this is necessary a more complicated
 *     implementation will be necessary.
 */
export const Rnd = new Callable("Rnd", {
    signature: {
        args: [new StdlibArgument("range", ValueKind.Int32)],
        returns: ValueKind.Dynamic,
    },
    impl: (_: Interpreter, range: Int32) => {
        if (range.getValue() === 0) return new Float(Math.random());
        else return new Int32(Math.floor(Math.random() * range.getValue() + 1));
    },
});
