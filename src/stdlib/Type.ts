import { BrsType, ValueKind, Callable, Int32, BrsString } from "../brsTypes";
import * as Expr from "../parser/Expression";
import { Interpreter } from "../interpreter";

export const Type = new Callable(
    "type",
    {
        signature: {
            args: [
                {
                    name: "variable",
                    type: ValueKind.Dynamic
                },
                {
                    name: "version",
                    type: ValueKind.Int32,
                    defaultValue: new Expr.Literal(new Int32(2))
                }
            ],
            returns: ValueKind.String
        },
        impl: (interpreter: Interpreter, variable: BrsType, version: Int32) => {
            if (variable.kind !== ValueKind.Object) {
                return new BrsString(ValueKind.toString(variable.kind));
            } else {
                return new BrsString(variable.getComponentName());
            }
        }
    }
);
