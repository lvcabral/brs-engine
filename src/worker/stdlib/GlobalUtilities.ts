import {
    Callable,
    ValueKind,
    BrsInvalid,
    BrsString,
    BrsType,
    StdlibArgument,
    RoAssociativeArray,
    Int32,
    BrsInterface,
} from "../brsTypes";
import { isBoxable } from "../brsTypes/Boxing";
import { BrsComponent } from "../brsTypes/components/BrsComponent";
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
        return new RoAssociativeArray([
            { name: new BrsString("COUNT"), value: new Int32(0) },
            { name: new BrsString("ORPHANED"), value: new Int32(0) },
            { name: new BrsString("ROOT"), value: new Int32(0) },
        ]);
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
    impl: (_: Interpreter, object: BrsType, ifname: BrsString): BrsInterface | BrsInvalid => {
        const boxedObj = isBoxable(object) ? object.box() : object;
        if (boxedObj instanceof BrsComponent) {
            return boxedObj.interfaces.get(ifname.value.toLowerCase()) || BrsInvalid.Instance;
        }
        return BrsInvalid.Instance;
    },
});

export const FindMemberFunction = new Callable("FindMemberFunction", {
    signature: {
        args: [
            new StdlibArgument("object", ValueKind.Object),
            new StdlibArgument("funName", ValueKind.String),
        ],
        returns: ValueKind.Interface,
    },
    impl: (_: Interpreter, object: BrsType, ifname: BrsString): BrsInterface | BrsInvalid => {
        const boxedObj = isBoxable(object) ? object.box() : object;
        if (boxedObj instanceof BrsComponent) {
            for (let [key, iface] of boxedObj.interfaces) {
                if (iface.hasMethod(ifname.value)) {
                    return iface;
                }
            }
        }
        return BrsInvalid.Instance;
    },
});
