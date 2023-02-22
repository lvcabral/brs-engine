import { BrsComponent } from "./BrsComponent";
import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid, Comparable } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { BrsType } from "..";
import { Unboxable } from "../Boxing";
import { Float } from "../Float";
import { vsprintf } from 'sprintf-js';

export class roFloat extends BrsComponent implements BrsValue, Unboxable {
    readonly kind = ValueKind.Object;
    private intrinsic: Float;

    public getValue(): Float {
        return this.intrinsic;
    }

    constructor(initialValue: Float) {
        super("roFloat");

        this.intrinsic = initialValue;
        this.registerMethods({
            ifFloat: [this.getFloat, this.setFloat],
            ifToStr: [this.toStr],
        });
    }

    unbox() {
        return this.intrinsic;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other instanceof roFloat) {
            return BrsBoolean.from(other.intrinsic.getValue() === this.intrinsic.getValue());
        }

        return BrsBoolean.False;
    }

    toString(_parent?: BrsType): string {
        return this.intrinsic.toString();
    }

    // -------------- ifFloat --------------

    private getFloat = new Callable("getFloat", {
        signature: {
            args: [],
            returns: ValueKind.Float,
        },
        impl: (_interpreter) => {
            return this.intrinsic;
        },
    });

    private setFloat = new Callable("setFloat", {
        signature: {
            args: [new StdlibArgument("value", ValueKind.Float)],
            returns: ValueKind.Void,
        },
        impl: (_interpreter, value: Float) => {
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
