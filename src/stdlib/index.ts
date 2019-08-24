import { Callable, ValueKind, BrsInvalid, RoAssociativeArray } from "../brsTypes";
import { Interpreter } from "../interpreter";

let warningShown = false;

export const RebootSystem = new Callable("RebootSystem", {
    signature: {
        args: [],
        returns: ValueKind.Void,
    },
    impl: () => {
        if (!warningShown) {
            console.warn("`RebootSystem` is not implemented in `brs`.");
            warningShown = true;
        }

        return BrsInvalid.Instance;
    },
});

/**
 * Returns global M pointer (the m from the root Environment).
 */
export const GetGlobalAA = new Callable("GetGlobalAA", {
    signature: {
        args: [],
        returns: ValueKind.Dynamic,
    },
    impl: (interpreter: Interpreter): RoAssociativeArray => {
        return interpreter.environment.getRootM();
    },
});

export * from "./CreateObject";
export * from "./File";
export * from "./Json";
export * from "./Math";
export * from "./Run";
export * from "./String";
export * from "./Type";
