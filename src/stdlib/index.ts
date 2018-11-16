import { Callable, ValueKind, BrsType, BrsInvalid } from "../brsTypes";
import { Interpreter } from "../interpreter";

let warningShown = false;
function rebootSystemImpl(interpreter: Interpreter): BrsInvalid {
    if (!warningShown) {
        console.warn("`RebootSystem` is not implemented in `brs`.");
        warningShown = true;
    }

    return BrsInvalid.Instance;
}

export const RebootSystem = new Callable(
    {
        name: "RebootSystem",
        args: [],
        returns: ValueKind.Void
    },
    rebootSystemImpl
);

export * from "./Math";
export * from "./String";
export * from "./Print";
