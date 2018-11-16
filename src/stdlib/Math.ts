import { Callable, ValueKind, Int32, Float } from "../brsTypes";
import { Interpreter } from "../interpreter";

/** Returns the natural exponent of a float. */
export const Exp = new Callable(
    {
      name: "Exp",
      args: [{name: "x", type: ValueKind.Float}],
      returns: ValueKind.Float
    },
    (interpreter: Interpreter, x: Float) => new Float(Math.exp(x.getValue()))
);

/** Returns the log of a float. */
export const Log = new Callable(
    {
      name: "Log",
      args: [{name: "x", type: ValueKind.Float}],
      returns: ValueKind.Float
    },
    (interpreter: Interpreter, x: Float) => new Float(Math.log(x.getValue()))
);

/** Returns the square root of a float. */
export const Sqr = new Callable(
    {
      name: "Sqr",
      args: [{name: "x", type: ValueKind.Float}],
      returns: ValueKind.Float
    },
    (interpreter: Interpreter, x: Float) => new Float(Math.sqrt(x.getValue()))
);

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
export const Rnd = new Callable(
    {
      name: "Rnd",
      args: [{name: "range", type: ValueKind.Int32}],
      returns: ValueKind.Dynamic
    },
    (interpreter: Interpreter, range: Int32) => {
        if (range.getValue() === 0) return new Float(Math.random());
        else return new Int32(Math.floor(Math.random() * range.getValue() + 1));
    }
);

