import { BrsComponent } from "./BrsComponent";
import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { BrsType, isBrsNumber } from "..";
import { Unboxable } from "../Boxing";
import { Double } from "../Double";
import { vsprintf } from "sprintf-js";

export class RoDouble extends BrsComponent implements BrsValue, Unboxable {
    readonly kind = ValueKind.Object;
    private intrinsic: Double;

    public getValue(): number {
        return this.intrinsic.getValue();
    }

    constructor(initialValue: Double) {
        super("roDouble");

        this.intrinsic = new Double(isBrsNumber(initialValue) ? initialValue.getValue() : 0);
        this.registerMethods({
            ifDouble: [this.getDouble, this.setDouble],
            ifToStr: [this.toStr],
        });
    }

    unbox() {
        return this.intrinsic;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other instanceof RoDouble) {
            return BrsBoolean.from(other.intrinsic.getValue() === this.intrinsic.getValue());
        }

        return BrsBoolean.False;
    }

    toString(_parent?: BrsType): string {
        return this.intrinsic.toString();
    }

    // -------------- ifDouble --------------

    private readonly getDouble = new Callable("getDouble", {
        signature: {
            args: [],
            returns: ValueKind.Double,
        },
        impl: (_interpreter) => {
            return this.intrinsic;
        },
    });

    private readonly setDouble = new Callable("setDouble", {
        signature: {
            args: [new StdlibArgument("value", ValueKind.Double)],
            returns: ValueKind.Void,
        },
        impl: (_interpreter, value: Double) => {
            this.intrinsic = value;
            return BrsInvalid.Instance;
        },
    });

    // -------------- ifToStr --------------

    private readonly toStr = new Callable("toStr", {
        signature: {
            args: [new StdlibArgument("format", ValueKind.String, BrsInvalid.Instance)],
            returns: ValueKind.String,
        },
        impl: (_interpreter, format: BrsString) => {
            if (format instanceof BrsString) {
                const tokens = format.value.split("%").length - 1;
                if (tokens === 0) {
                    return new BrsString(format.value);
                }
                const params = Array(tokens).fill(this.intrinsic.getValue());
                try {
                    return new BrsString(vsprintf(format.value, params));
                } catch (error: any) {
                    throw new Error("Invalid Format Specifier (runtime error &h24)");
                }
            }
            return new BrsString(this.intrinsic.toString());
        },
    });
}
