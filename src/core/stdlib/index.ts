import {
    Callable,
    ValueKind,
    BrsInvalid,
    RoAssociativeArray,
    StdlibArgument,
    Int32,
    RoMessagePort,
    BrsString,
    Float,
    isBoxable,
    BrsType,
} from "../brsTypes";
import { BrsDevice } from "../device/BrsDevice";
import { Interpreter } from "../interpreter";

/** Returns an object version of an intrinsic type, or pass through an object if given one. */
export const Box = new Callable("Box", {
    signature: {
        args: [new StdlibArgument("value", ValueKind.Dynamic)],
        returns: ValueKind.Object,
    },
    impl: (_: Interpreter, value: BrsType) => {
        if (isBoxable(value)) {
            return value.box();
        }
        return value;
    },
});

/** Returns the uptime of the system since the last reboot in seconds. */
export const UpTime = new Callable("UpTime", {
    signature: {
        args: [new StdlibArgument("dummy", ValueKind.Int32)],
        returns: ValueKind.Float,
    },
    impl: (_: Interpreter) => {
        const startTime = BrsDevice.deviceInfo.startTime;
        const uptimeSeconds = (Date.now() - startTime) / 1000;
        return new Float(Math.round(uptimeSeconds * 100 + Number.EPSILON) / 100);
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
    impl: (_: Interpreter, timeout: Int32) => {
        let ms = timeout.getValue();
        ms += performance.now();
        while (performance.now() < ms) {}
        return BrsInvalid.Instance;
    },
});

/** Waits until an event object is available or timeout milliseconds have passed. */
export const Wait = new Callable("Wait", {
    signature: {
        args: [new StdlibArgument("timeout", ValueKind.Int32), new StdlibArgument("port", ValueKind.Object)],
        returns: ValueKind.Dynamic,
    },
    impl: (interpreter: Interpreter, timeout: Int32, port: RoMessagePort) => {
        return port.wait(interpreter, timeout.getValue());
    },
});

/** Translates the source string into the language of the current locale. */
export const Tr = new Callable("Tr", {
    signature: {
        args: [new StdlibArgument("source", ValueKind.String)],
        returns: ValueKind.String,
    },
    impl: (interpreter: Interpreter, source: BrsString) => {
        let tr = interpreter.translations.get(source.value);
        if (tr) {
            return new BrsString(tr);
        }
        return source;
    },
});

export * from "./GlobalUtilities";
export * from "./CreateObject";
export * from "./File";
export * from "./Json";
export * from "./Math";
export * from "./Print";
export * from "./Run";
export * from "./String";
export * from "./Type";
