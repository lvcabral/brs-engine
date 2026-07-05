import {
    BrsType,
    ValueKind,
    Callable,
    Int32,
    BrsString,
    StdlibArgument,
    isBoxable,
    RoDouble,
    RoLongInteger,
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
            case ValueKind.Object: {
                if (variable instanceof RoDouble) {
                    return new BrsString("Double");
                } else if (variable instanceof RoLongInteger) {
                    return new BrsString("LongInteger");
                }
                return new BrsString(variable.getComponentName());
            }
            case ValueKind.Interface:
                return new BrsString(variable.name);
            case ValueKind.String: {
                const version3 = version.getValue() === 3;
                const legacy = variable.literal ? !version3 && variable.legacy : version3;
                return new BrsString(ValueKind.toString(variable.kind, legacy));
            }
            case ValueKind.Boolean:
            case ValueKind.Float:
            case ValueKind.Double:
            case ValueKind.Int32:
            case ValueKind.Int64: {
                const legacy = variable.literal ? version.getValue() !== 3 && variable.legacy : false;
                return new BrsString(ValueKind.toString(variable.kind, legacy));
            }
            default: {
                const legacy = version.getValue() !== 3 && isBoxable(variable) && variable.legacy;
                return new BrsString(ValueKind.toString(variable.kind, legacy));
            }
        }
    },
});
