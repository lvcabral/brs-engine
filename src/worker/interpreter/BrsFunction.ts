import { Callable, BrsType, BrsInvalid } from "../brsTypes";
import * as Expr from "../parser/Expression";
import { Interpreter } from ".";
import { Stmt } from "../parser";
import { RuntimeError, RuntimeErrorDetail } from "../Error";

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
            let finished = false;
            interpreter.environment.gotoLabel = "";
            let location = func.location;
            while (!finished) {
                try {
                    func.body.statements.forEach((statement) => interpreter.execute(statement));
                    finished = true;
                } catch (err: any) {
                    if (err instanceof Stmt.GotoLabel) {
                        if (err.label === undefined) {
                            interpreter.addError(new RuntimeError(RuntimeErrorDetail.MissingLineNumber, location));
                        }
                        interpreter.environment.gotoLabel = err.label;
                        location = err.location;
                    } else {
                        throw err;
                    }
                }
            }
            if (interpreter.environment.gotoLabel !== "") {
                interpreter.addError(new RuntimeError(RuntimeErrorDetail.MissingLineNumber, location));
            }
            return BrsInvalid.Instance;
        },
    });
    callFunc.setLocation(func.location);
    return callFunc;
}
