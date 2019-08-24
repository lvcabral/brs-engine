import {
    Callable,
    ValueKind,
    BrsInvalid,
    RoAssociativeArray,
    StdlibArgument,
    Int32,
    BrsValue,
    RoMessagePort,
} from "../brsTypes";
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

/**
 * This function causes the script to pause for the specified time in milliseconds.
 */
export const Sleep = new Callable("Sleep", {
    signature: {
        args: [new StdlibArgument("timeout", ValueKind.Int32)],
        returns: ValueKind.Void,
    },
    impl: (interpreter: Interpreter, timeout: Int32) => {
        let ms = timeout.getValue();
        ms += new Date().getTime();
        while (new Date().getTime() < ms) {}
        return BrsInvalid.Instance;
    },
});

/** Waits until an event object is available or timeout milliseconds have passed. */
export const Wait = new Callable("Wait", {
    signature: {
        args: [
            new StdlibArgument("timeout", ValueKind.Int32),
            new StdlibArgument("port", ValueKind.Object),
        ],
        returns: ValueKind.Dynamic,
    },
    impl: (_: Interpreter, timeout: Int32, port: RoMessagePort) => {
        return port.wait(timeout.getValue());
    },
});

export * from "./CreateObject";
export * from "./File";
export * from "./Json";
export * from "./Math";
export * from "./Run";
export * from "./String";
export * from "./Type";
