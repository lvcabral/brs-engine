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
    Int64,
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
        if (object instanceof BrsComponent && object.interfaces.has(ifname.value.toLowerCase())) {
            return object;
        }
        const lowerIfname = ifname.value.toLowerCase();
        switch (lowerIfname) {
            case "ifstring":
                return object instanceof BrsString ? new RoString(object) : BrsInvalid.Instance;
            case "ifboolean":
                return object instanceof BrsBoolean ? new roBoolean(object) : BrsInvalid.Instance;
            case "ifint":
                return object instanceof Int32 ? new roInt(object) : BrsInvalid.Instance;
            case "iffloat":
                return object instanceof Float ? new roFloat(object) : BrsInvalid.Instance;
            case "ifdouble":
                return object instanceof Double ? new roDouble(object) : BrsInvalid.Instance;
            case "iftostr":
                if (
                    object instanceof BrsString ||
                    object instanceof BrsBoolean ||
                    object instanceof Int32 ||
                    object instanceof Int64 ||
                    object instanceof Float ||
                    object instanceof Double
                ) {
                    return object;
                }
                break;
        }
        return BrsInvalid.Instance;
    },
});
