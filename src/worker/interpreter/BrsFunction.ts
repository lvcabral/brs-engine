import { Callable, BrsType } from "../brsTypes";
import * as Expr from "../parser/Expression";
import { Interpreter } from ".";

/**
 * Converts a Function expression to a BrightScript callable representation so
 * that it can be executed.
 *
 * @param func the function expression to convert
 * @param name the name of the function to convert (defaults to `[Function]`)
 *
 * @returns a `Callable` version of that function
 */
export function toCallable(func: Expr.Function, name: string = "[Function]") {
    const callFunc = new Callable(name, {
        signature: {
            args: func.parameters,
            returns: func.returns,
        },
        impl: (interpreter: Interpreter, ...args: BrsType[]) => {
            // just return whatever BrightScript returned
            return func.body.accept(interpreter);
        },
    });
    callFunc.setLocation(func.location);
    return callFunc;
}
