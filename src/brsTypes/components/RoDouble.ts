import { BrsComponent } from "./BrsComponent";
import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid, Comparable } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { BrsType } from "..";
import { Unboxable } from "../Boxing";
import { Double } from "../Double";
import { vsprintf } from 'sprintf-js';

export class roDouble extends BrsComponent implements BrsValue, Unboxable {
    readonly kind = ValueKind.Object;
    private intrinsic: Double;

    public getValue(): Double {
        return this.intrinsic;
    }

    constructor(initialValue: Double) {
        super("roDouble");

        this.intrinsic = initialValue;
        this.registerMethods({
            ifDouble: [this.getDouble, this.setDouble],
            ifToStr: [this.toStr],
        });
    }

    unbox() {
        return this.intrinsic;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other instanceof roDouble) {
            return BrsBoolean.from(other.intrinsic.getValue() === this.intrinsic.getValue());
        }

        return BrsBoolean.False;
    }

    toString(_parent?: BrsType): string {
        return this.intrinsic.toString();
    }

    // -------------- ifDouble --------------

    private getDouble = new Callable("getDouble", {
        signature: {
            args: [],
            returns: ValueKind.Double,
        },
        impl: (_interpreter) => {
            return this.intrinsic;
        },
    });

    private setDouble = new Callable("setDouble", {
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

    private toStr = new Callable("toStr", {
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
                return new BrsString(vsprintf(format.value, params));
            }
            return new BrsString(this.intrinsic.toString());
        },
    });
}
