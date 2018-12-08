import { Callable, ValueKind, BrsInvalid, BrsString, BrsType } from "../brsTypes";
import { BrsObjects } from "../brsTypes/components/BrsObjects";
import * as Expr from "../parser/Expression";
import { Interpreter } from "../interpreter";

/** Creates a new instance of a given brightscript component (e.g. roAssociativeArray) */
export const CreateObject = new Callable(
    "CreateObject",
    {
        signature: {
            args: [
                { name: "objName", type: ValueKind.String },
                { name: "arg1", type: ValueKind.Dynamic, defaultValue: new Expr.Literal(BrsInvalid.Instance) },
                { name: "arg2", type: ValueKind.Dynamic, defaultValue: new Expr.Literal(BrsInvalid.Instance) },
                { name: "arg3", type: ValueKind.Dynamic, defaultValue: new Expr.Literal(BrsInvalid.Instance) },
                { name: "arg4", type: ValueKind.Dynamic, defaultValue: new Expr.Literal(BrsInvalid.Instance) },
                { name: "arg4", type: ValueKind.Dynamic, defaultValue: new Expr.Literal(BrsInvalid.Instance) }
            ],
            returns: ValueKind.Dynamic
        },
        impl: (interpreter: Interpreter, objName: BrsString, ...additionalArgs: BrsType[]) => {
            let ctor = BrsObjects.get(objName.value.toLowerCase());
            return ctor ? ctor(...additionalArgs) : BrsInvalid.Instance;
        }
    }
);
