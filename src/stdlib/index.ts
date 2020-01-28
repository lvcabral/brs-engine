import {
    Callable,
    ValueKind,
    BrsInvalid,
    RoAssociativeArray,
    StdlibArgument,
    Int32,
    RoMessagePort,
    BrsString,
    BrsType,
    RoString,
    roInt,
    Float,
    roFloat,
    BrsBoolean,
    roBoolean,
    Double,
    roDouble,
} from "../brsTypes";
import { Interpreter } from "../interpreter";
import { BrsComponent } from "../brsTypes/components/BrsComponent";

/** Returns the uptime of the system since the last reboot in seconds. */
export const UpTime = new Callable("UpTime", {
    signature: {
        args: [new StdlibArgument("dummy", ValueKind.Int32)],
        returns: ValueKind.Float,
    },
    impl: (interpreter: Interpreter) => {
        const startTime = interpreter.deviceInfo.get("startTime");
        return new Float(Math.round((Date.now() - startTime) / 1000));
    },
});

/** Request the system to perform a soft reboot. */
export const RebootSystem = new Callable("RebootSystem", {
    signature: {
        args: [],
        returns: ValueKind.Void,
    },
    impl: () => {
        postMessage("reset");
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

/** This is a draft inplementation of GetInterface() as BRS still do not expose
 *  intefaces as components, so it returns the original object if it implements
 *  the specified interface.
 */
export const GetInterface = new Callable("GetInterface", {
    signature: {
        args: [
            new StdlibArgument("object", ValueKind.Dynamic),
            new StdlibArgument("ifname", ValueKind.String),
        ],
        returns: ValueKind.Dynamic,
    },
    impl: (interpreter: Interpreter, object: BrsType, ifname: BrsString) => {
        if (object instanceof BrsComponent) {
            if (object.interfaces.has(ifname.value.toLowerCase())) {
                return object;
            }
        } else {
            if (ifname.value.toLowerCase() === "ifstring" && object instanceof BrsString) {
                return new RoString(object);
            } else if (ifname.value.toLowerCase() === "ifboolean" && object instanceof BrsBoolean) {
                return new roBoolean(object);
            } else if (ifname.value.toLowerCase() === "ifint" && object instanceof Int32) {
                return new roInt(object);
            } else if (ifname.value.toLowerCase() === "iffloat" && object instanceof Float) {
                return new roFloat(object);
            } else if (ifname.value.toLowerCase() === "ifdouble" && object instanceof Double) {
                return new roDouble(object);
            }
        }
        return BrsInvalid.Instance;
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

export * from "./CreateObject";
export * from "./File";
export * from "./Json";
export * from "./Math";
export * from "./Run";
export * from "./String";
export * from "./Type";
