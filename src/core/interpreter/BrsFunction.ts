import { Callable, BrsType, BrsInvalid } from "../brsTypes";
import * as Expr from "../parser/Expression";
import { Interpreter } from ".";
import { Stmt } from "../parser";
import { RuntimeError, RuntimeErrorDetail } from "../error/BrsError";

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
                    func.body.statements.forEach((statement) => interpreter.execute(statement));
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
                    new RuntimeError(RuntimeErrorDetail.MissingLineNumber, location, interpreter.stack.slice(0, -1))
                );
            }
            return BrsInvalid.Instance;
        },
    });
    callFunc.setLocation(func.location);
    return callFunc;
}
