import { Callable, BrsType, BrsInvalid, ValueKind, tryCoerce, Int32 } from "../brsTypes";
import * as Expr from "../parser/Expression";
import { Interpreter } from ".";
import { Stmt } from "../parser";
import { RuntimeError, RuntimeErrorDetail } from "../error/BrsError";
import { TypeMismatch } from "../error/TypeMismatch";

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
            interpreter.environment.gotoLabel = "";
            let location = func.location;
            let done = false;
            while (!done) {
                try {
                    for (const statement of func.body.statements) {
                        interpreter.execute(statement);
                    }
                    done = true;
                } catch (reason: any) {
                    if (reason instanceof Stmt.GotoLabel) {
                        interpreter.environment.gotoLabel = reason.label.toLowerCase();
                        location = reason.location;
                    } else {
                        throw reason;
                    }
                }
            }
            if (interpreter.environment.gotoLabel !== "") {
                interpreter.addError(
                    new RuntimeError(RuntimeErrorDetail.MissingLineNumber, location, interpreter.getBacktrace())
                );
            }
            if (func.returns !== ValueKind.Void && func.returns !== ValueKind.Dynamic) {
                // When a function has a typed return, but no return statement is hit, Roku returns zero by default
                const coercedValue = tryCoerce(new Int32(0), func.returns);
                if (!coercedValue) {
                    // When the typed return is not numeric or boolean, Roku raises a type mismatch error
                    interpreter.addError(
                        new TypeMismatch({
                            message: `Unable to cast`,
                            left: {
                                type: func.returns,
                                location: func.location,
                            },
                            right: {
                                type: ValueKind.Int32,
                                location: func.location,
                            },
                            cast: true,
                        })
                    );
                }
                return coercedValue;
            }
            return BrsInvalid.Instance;
        },
    });
    callFunc.setLocation(func.location);
    callFunc.setUserDefined();
    return callFunc;
}
