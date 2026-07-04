import { BrsType, ValueKind, Callable, Int32, BrsString, StdlibArgument, isBoxable } from "../brsTypes";
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
            case ValueKind.String: {
                const legacy = variable.literal
                    ? version.getValue() !== 3 && variable.legacy
                    : version.getValue() === 3;
                return new BrsString(ValueKind.toString(variable.kind, legacy));
            }
            default: {
                const legacy = version.getValue() !== 3 && isBoxable(variable) && variable.legacy;
                return new BrsString(ValueKind.toString(variable.kind, legacy));
            }
        }
    },
});
