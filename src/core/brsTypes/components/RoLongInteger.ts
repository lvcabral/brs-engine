import { BrsComponent } from "./BrsComponent";
import { BrsValue, ValueKind, BrsBoolean, BrsInvalid } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { BrsType, isBrsNumber } from "..";
import { Unboxable } from "../Boxing";
import { Int64 } from "../Int64";
import { IfToStr } from "../interfaces/IfToStr";

export class RoLongInteger extends BrsComponent implements BrsValue, Unboxable {
    readonly kind = ValueKind.Object;
    private intrinsic: Int64;

    public getValue(): Long {
        return this.intrinsic.getValue();
    }

    constructor(initialValue: Int64) {
        super("roLongInteger");

        this.intrinsic = new Int64(isBrsNumber(initialValue) ? initialValue.getValue() : 0);
        this.registerMethods({
            ifLongInt: [this.getLongInt, this.setLongInt],
            ifToStr: [new IfToStr(this).toStr],
        });
    }

    unbox() {
        return this.intrinsic;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other instanceof RoLongInteger) {
            return BrsBoolean.from(other.intrinsic.getValue().low === this.intrinsic.getValue().low);
        }

        return BrsBoolean.False;
    }

    toString(_parent?: BrsType): string {
        return this.intrinsic.toString();
    }

    // ---------- ifLongInt ----------

    private readonly getLongInt = new Callable("getLongInt", {
        signature: {
            args: [],
            returns: ValueKind.Int64,
        },
        impl: (_interpreter) => {
            return this.intrinsic;
        },
    });

    private readonly setLongInt = new Callable("setLongInt", {
        signature: {
            args: [new StdlibArgument("value", ValueKind.Int64)],
            returns: ValueKind.Void,
        },
        impl: (_interpreter, value: Int64) => {
            this.intrinsic = value;
            return BrsInvalid.Instance;
        },
    });
}
