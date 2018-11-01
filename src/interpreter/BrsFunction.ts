import { Callable, BrsInvalid, BrsType } from "../brsTypes";
import * as Stmt from "../parser/Statement";
import * as Expr from "../parser/Expression";
import { Interpreter } from ".";
import { Expression } from "../parser/Expression";
import { Scope, Environment } from "./Environment";

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
    return new Callable(
        {
            name: name,
            args: func.parameters,
            returns: func.returns
        },
        (interpreter: Interpreter, ...args: BrsType[]) => {
            // first, we need to evaluate all of the parameter default values
            // and define them in a new environment
            let subEnvironment = Environment.from(interpreter.environment);

            interpreter.inSubEnv(subEnvironment, (subInterpreter) => {
                func.parameters.forEach((param, index) => {
                    if (param.defaultValue) {
                        subEnvironment.define(Scope.Function, param.name, subInterpreter.evaluate(param.defaultValue));
                        return;
                    }

                    subEnvironment.define(Scope.Function, param.name, args[index]);
                });
            });

            // then return whatever BrightScript returned
            // TODO: prevent `sub`s from returning values?
            return interpreter.executeBlock(func.body, subEnvironment);
        }
    );
}