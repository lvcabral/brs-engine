import { Callable, ValueKind, BrsInvalid, BrsString, BrsType, BrsObjects, StdlibArgument } from "../brsTypes";
import { BrsDevice } from "../device/BrsDevice";
import { RuntimeError, RuntimeErrorDetail } from "../error/BrsError";
import { Interpreter } from "../interpreter";

/** Creates a new instance of a given brightscript component (e.g. roAssociativeArray) */
export const CreateObject = new Callable("CreateObject", {
    signature: {
        args: [new StdlibArgument("objName", ValueKind.String)],
        variadic: true,
        returns: ValueKind.Dynamic,
    },
    impl: (interpreter: Interpreter, objName: BrsString, ...additionalArgs: BrsType[]) => {
        const ctor = BrsObjects.get(objName.value.toLowerCase());
        if (ctor === undefined) {
            const msg = `BRIGHTSCRIPT: ERROR: Runtime: unknown classname "${
                objName.value
            }": ${interpreter.formatLocation()}`;
            BrsDevice.stderr.write(`warning,${msg}`);
        } else {
            const minParams = BrsObjects.params(objName.value.toLowerCase());
            if (minParams === -1) {
                additionalArgs = [];
            } else if (minParams > 0 && additionalArgs.length === 0) {
                BrsDevice.stderr.write(
                    `error,BRIGHTSCRIPT: ERROR: Runtime: "${
                        objName.value
                    }": invalid number of parameters: ${interpreter.formatLocation()}`
                );
                return BrsInvalid.Instance;
            } else if (minParams >= 0 && additionalArgs.length !== minParams) {
                interpreter.addError(
                    new RuntimeError(
                        RuntimeErrorDetail.RoWrongNumberOfParams,
                        interpreter.location,
                        interpreter.stack.slice(0, -1)
                    )
                );
            }
            try {
                return ctor(interpreter, ...additionalArgs);
            } catch (err: any) {
                if (err instanceof RuntimeError) {
                    err.location ??= interpreter.location;
                    err.backTrace ??= interpreter.stack.slice(0, -1);
                    interpreter.addError(err);
                }
                BrsDevice.stderr.write(`error,${err.message} ${interpreter.formatLocation()}`);
            }
        }
        return BrsInvalid.Instance;
    },
});
