import {
    BrsType,
    ValueKind,
    Callable,
    Int32,
    BrsString,
    StdlibArgument,
    isBoxable,
    legacyType,
} from "../brsTypes";
import { Interpreter } from "../interpreter";

export const Type = new Callable("type", {
    signature: {
        args: [
            new StdlibArgument("variable", ValueKind.Dynamic),
            new StdlibArgument("version", ValueKind.Int32, new Int32(2)),
        ],
        returns: ValueKind.String,
    },
    impl: (_: Interpreter, variable: BrsType, version: Int32) => {
        switch (variable.kind) {
            case ValueKind.Object:
                return new BrsString(variable.getComponentName());
            case ValueKind.Interface:
                return new BrsString(variable.name);
            default:
                if (version.getValue() !== 3 && isBoxable(variable) && variable.inArray) {
                    return new BrsString(legacyType(variable.kind));
                }
                return new BrsString(ValueKind.toString(variable.kind));
        }
    },
});
