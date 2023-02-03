import {
    Callable,
    ValueKind,
    BrsInvalid,
    BrsString,
    BrsType,
    StdlibArgument,
    RoAssociativeArray,
    BrsInterface,
    RoString,
    roBoolean,
    roInt,
    roFloat,
    roDouble,
    BrsBoolean,
    Int32,
    Float,
    Double,
} from "../brsTypes";
import { BrsComponent } from "../brsTypes/components/BrsComponent";
import { Interpreter } from "../interpreter";

let warningShown = false;

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

// export const GetInterface = new Callable("GetInterface", {
//     signature: {
//         args: [
//             new StdlibArgument("object", ValueKind.Object),
//             new StdlibArgument("ifname", ValueKind.String),
//         ],
//         returns: ValueKind.Interface,
//     },
//     impl: (interpreter, object: BrsComponent, ifname: BrsString): BrsInterface | BrsInvalid => {
//         return object.interfaces.get(ifname.value.toLowerCase()) || BrsInvalid.Instance;
//     },
// });

/** This is a draft implementation of GetInterface() as BRS still do not expose
 *  interfaces as components, so it returns the original object if it implements
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
