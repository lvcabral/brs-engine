import {
    Callable,
    ValueKind,
    BrsInvalid,
    BrsString,
    BrsType,
    StdlibArgument,
    RoAssociativeArray,
} from "../brsTypes";
import { BrsObjects } from "../brsTypes/components/BrsObjects";
import { Interpreter } from "../interpreter";
import { MockNode } from "../extensions/MockNode";

/** Creates a new instance of a given brightscript component (e.g. roAssociativeArray) */
export const CreateObject = new Callable("CreateObject", {
    signature: {
        args: [
            new StdlibArgument("objName", ValueKind.String),
            new StdlibArgument("arg1", ValueKind.Dynamic, BrsInvalid.Instance),
            new StdlibArgument("arg2", ValueKind.Dynamic, BrsInvalid.Instance),
            new StdlibArgument("arg3", ValueKind.Dynamic, BrsInvalid.Instance),
            new StdlibArgument("arg4", ValueKind.Dynamic, BrsInvalid.Instance),
        ],
        returns: ValueKind.Dynamic,
    },
    impl: (interpreter: Interpreter, objName: BrsString, ...additionalArgs: BrsType[]) => {
        let objToMock = objName.value.toLowerCase();

        if (
            objToMock === "rosgnode" &&
            additionalArgs[0] &&
            !(additionalArgs[0] instanceof BrsInvalid)
        ) {
            objToMock = additionalArgs[0].toString().toLowerCase();
        }

        let possibleMock = interpreter.environment.getMock(objToMock);
        if (possibleMock instanceof RoAssociativeArray) {
            return new MockNode(possibleMock);
        }

        let ctor = BrsObjects.get(objName.value.toLowerCase());
        return ctor ? ctor(...additionalArgs) : BrsInvalid.Instance;
    },
});
