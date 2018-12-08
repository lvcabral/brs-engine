import { Callable, ValueKind, BrsType, BrsInvalid } from "../brsTypes";
import { Interpreter } from "../interpreter";

let warningShown = false;

export const RebootSystem = new Callable(
    "RebootSystem",
    {
        signature: {
            args: [],
            returns: ValueKind.Void
        },
        impl: () => {
            if (!warningShown) {
                console.warn("`RebootSystem` is not implemented in `brs`.");
                warningShown = true;
            }

            return BrsInvalid.Instance;
        }
    }
);

export * from "./File";
export * from "./Math";
export * from "./String";
export * from "./Print";
export * from "./CreateObject";
export * from "./Type";
