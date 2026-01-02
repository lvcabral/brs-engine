import { BrsComponent } from "./BrsComponent";
import { BrsValue, ValueKind, BrsBoolean, BrsInvalid } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { BrsType, isBrsNumber } from "..";
import { Unboxable } from "../Boxing";
import { Double } from "../Double";
import { IfToStr } from "../interfaces/IfToStr";

export class RoDouble extends BrsComponent implements BrsValue, Unboxable {
    readonly kind = ValueKind.Object;
    private intrinsic: Double;

    constructor(initialValue: Double) {
        super("roDouble");

        this.intrinsic = new Double(isBrsNumber(initialValue) ? initialValue.getValue() : 0);
        this.registerMethods({
            ifDouble: [this.getDouble, this.setDouble],
            ifToStr: [new IfToStr(this, "%g").toStr],
        });
    }

    getValue(): number {
        return this.intrinsic.getValue();
    }

    toBoolean(): boolean {
        return this.intrinsic.toBoolean();
    }

    unbox() {
        return this.intrinsic;
    }

    copy() {
        return new RoDouble(this.intrinsic);
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
}
