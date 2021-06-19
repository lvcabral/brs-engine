import { BrsComponent } from "./BrsComponent";
import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid, Comparable } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { BrsType } from "..";
import { Unboxable } from "../Boxing";
import { Double } from "../Double";

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
        impl: (interpreter: Interpreter) => {
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
            args: [],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter) => {
            return new BrsString(this.intrinsic.toString());
        },
    });
}
