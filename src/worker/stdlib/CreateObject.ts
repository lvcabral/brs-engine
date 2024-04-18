import {
    Callable,
    ValueKind,
    BrsInvalid,
    BrsString,
    BrsType,
    BrsObjects,
    StdlibArgument,
} from "../brsTypes";
import { Interpreter } from "../interpreter";

/** Creates a new instance of a given brightscript component (e.g. roAssociativeArray) */
export const CreateObject = new Callable("CreateObject", {
    signature: {
        args: [
            new StdlibArgument("objName", ValueKind.String),
            new StdlibArgument("arg1", ValueKind.Dynamic, BrsInvalid.Instance),
            new StdlibArgument("arg2", ValueKind.Dynamic, BrsInvalid.Instance),
            new StdlibArgument("arg3", ValueKind.Dynamic, BrsInvalid.Instance),
            new StdlibArgument("arg4", ValueKind.Dynamic, BrsInvalid.Instance),
            new StdlibArgument("arg5", ValueKind.Dynamic, BrsInvalid.Instance),
            new StdlibArgument("arg6", ValueKind.Dynamic, BrsInvalid.Instance),
        ],
        returns: ValueKind.Dynamic,
    },
    impl: (interpreter: Interpreter, objName: BrsString, ...additionalArgs: BrsType[]) => {
        let ctor = BrsObjects.get(objName.value.toLowerCase());
        if (ctor === undefined) {
            let msg = `BRIGHTSCRIPT: ERROR: Runtime: unknown classname "${
                objName.value
            }": ${interpreter.formatLocation()}`;
            if (["rosgscreen", "rosgnode"].includes(objName.value.toLowerCase())) {
                msg = `WARNING: Attempt to create object "${objName.value}". SceneGraph components are still not supported!`;
            }
            interpreter.stdout.write(`warning,${msg}`);
        } else {
            try {
                return ctor(interpreter, ...additionalArgs);
            } catch (err: any) {
                interpreter.stderr.write(`error,${err.message} ${interpreter.formatLocation()}`);
            }
        }
        return BrsInvalid.Instance;
    },
});
