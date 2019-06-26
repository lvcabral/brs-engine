import {
    BrsType,
    ValueKind,
    Callable,
    BrsString,
    StdlibArgument,
    BrsInvalid,
    RoAssociativeArray,
    Uninitialized,
} from "../brsTypes";
import { MockNode } from "./MockNode";
import { Interpreter } from "../interpreter";

const mockComponent = new Callable("mockComponent", {
    signature: {
        args: [
            new StdlibArgument("objToMock", ValueKind.String),
            new StdlibArgument("mock", ValueKind.Object),
        ],
        returns: ValueKind.Void,
    },
    impl: (interpreter: Interpreter, objToMock: BrsType, mock: RoAssociativeArray) => {
        interpreter.environment.setMock(objToMock.toString(), mock);
        return BrsInvalid.Instance;
    },
});

export const _brs_ = new RoAssociativeArray([
    { name: new BrsString("mockComponent"), value: mockComponent },
]);
