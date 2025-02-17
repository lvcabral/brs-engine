import {
    Callable,
    ValueKind,
    BrsInvalid,
    BrsString,
    StdlibArgument,
    BrsInterface,
    BrsComponent,
    BrsType,
    toAssociativeArray,
} from "../brsTypes";
import { RuntimeError, RuntimeErrorDetail } from "../error/BrsError";
import { Interpreter } from "../interpreter";

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

export const RunGarbageCollector = new Callable("RunGarbageCollector", {
    signature: {
        args: [],
        returns: ValueKind.Object,
    },
    impl: () => {
        return toAssociativeArray({ COUNT: 0, ORPHANED: 0, ROOT: 0 });
    },
});

export const GetInterface = new Callable("GetInterface", {
    signature: {
        args: [
            new StdlibArgument("object", ValueKind.Object),
            new StdlibArgument("ifname", ValueKind.String),
        ],
        returns: ValueKind.Interface,
    },
    impl: (_: Interpreter, object: BrsComponent, ifname: BrsString): BrsInterface | BrsInvalid => {
        return object.interfaces.get(ifname.value.toLowerCase()) || BrsInvalid.Instance;
    },
});

export const FindMemberFunction = new Callable(
    "FindMemberFunction",
    {
        signature: {
            args: [
                new StdlibArgument("object", ValueKind.Object),
                new StdlibArgument("funName", ValueKind.String),
            ],
            returns: ValueKind.Interface,
        },
        impl: (
            _: Interpreter,
            object: BrsComponent,
            funName: BrsString
        ): BrsInterface | BrsInvalid => {
            if (object instanceof BrsComponent) {
                for (let [_, iface] of object.interfaces) {
                    if (iface.hasMethod(funName.value)) {
                        return iface;
                    }
                }
            }
            return BrsInvalid.Instance;
        },
    },
    {
        signature: {
            args: [
                new StdlibArgument("object", ValueKind.Interface),
                new StdlibArgument("funName", ValueKind.String),
            ],
            returns: ValueKind.Interface,
        },
        impl: (
            _: Interpreter,
            iface: BrsInterface,
            funName: BrsString
        ): BrsInterface | BrsInvalid => {
            if (iface.hasMethod(funName.value)) {
                return iface;
            }
            return BrsInvalid.Instance;
        },
    }
);

export const ObjFun = new Callable("ObjFun", {
    signature: {
        args: [
            new StdlibArgument("object", ValueKind.Object),
            new StdlibArgument("iface", ValueKind.Interface),
            new StdlibArgument("funName", ValueKind.String),
        ],
        variadic: true,
        returns: ValueKind.Dynamic,
    },
    impl: (
        interpreter: Interpreter,
        object: BrsComponent,
        iface: BrsInterface,
        funName: BrsString,
        ...args: BrsType[]
    ): BrsType => {
        for (let [_, objI] of object.interfaces) {
            if (iface.name === objI.name && iface.hasMethod(funName.value)) {
                const func = object.getMethod(funName.value);
                return func?.call(interpreter, ...args) || BrsInvalid.Instance;
            }
        }
        interpreter.addError(
            new RuntimeError(
                RuntimeErrorDetail.MemberFunctionNotFound,
                interpreter.location,
                interpreter.stack.slice(0, -1)
            )
        );
    },
});
