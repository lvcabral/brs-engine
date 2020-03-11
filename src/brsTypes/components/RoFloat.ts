import { BrsComponent } from "./BrsComponent";
import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid, Comparable } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { BrsType } from "..";
import { Unboxable } from "../Boxing";
import { Float } from "../Float";

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
        impl: (interpreter: Interpreter) => {
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
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(this.intrinsic.toString());
        },
    });
}
