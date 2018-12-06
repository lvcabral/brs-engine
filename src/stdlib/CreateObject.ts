import { Callable, ValueKind, BrsInvalid, BrsString } from "../brsTypes";
import { BrsObjects } from "../brsTypes/components/BrsObjects";
import { Interpreter } from "../interpreter";

/** Creates a new instance of a given brightscript component (e.g. roAssociativeArray) */
export const CreateObject = new Callable(
    "CreateObject",
    {
        signature: {
            args: [{ name: "objName", type: ValueKind.String }],
            returns: ValueKind.Dynamic
        },
        impl: (interpreter: Interpreter, objName: BrsString) => {
            let ctor = BrsObjects.get(objName.value.toLowerCase());
            return ctor ? ctor() : BrsInvalid.Instance;
        }
    }
);
