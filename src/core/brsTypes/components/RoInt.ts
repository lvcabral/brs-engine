import { BrsComponent } from "./BrsComponent";
import { BrsValue, ValueKind, BrsBoolean, BrsInvalid } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { BrsType, isBrsNumber } from "..";
import { Unboxable } from "../Boxing";
import { Int32 } from "../Int32";
import { IfToStr } from "../interfaces/IfToStr";
export class RoInt extends BrsComponent implements BrsValue, Unboxable {
    readonly kind = ValueKind.Object;
    private intrinsic: Int32;

    constructor(initialValue: Int32) {
        super("roInt");

        this.intrinsic = new Int32(isBrsNumber(initialValue) ? initialValue.getValue() : 0);
        const toStr = new IfToStr(this).toStr;
        this.registerMethods({
            ifInt: [this.getInt, this.setInt],
            // Per https://developer.roku.com/docs/references/brightscript/interfaces/ifintops.md,
            // ifIntOps _also_ implements toStr()
            ifIntOps: [toStr],
            ifToStr: [toStr],
        });
    }

    getValue(): number {
        return this.intrinsic.getValue();
    }

    toBoolean(): boolean {
        return this.intrinsic.getValue() !== 0;
    }

    unbox() {
        return this.intrinsic;
    }

    copy() {
        return new RoInt(this.intrinsic);
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other instanceof RoInt) {
            return BrsBoolean.from(other.intrinsic.getValue() === this.intrinsic.getValue());
        }

        return BrsBoolean.False;
    }

    toString(_parent?: BrsType): string {
        return this.intrinsic.toString();
    }

    // ---------- ifInt ----------

    private readonly getInt = new Callable("getInt", {
        signature: {
            args: [],
            returns: ValueKind.Double,
        },
        impl: (_interpreter) => {
            return this.intrinsic;
        },
    });

    private readonly setInt = new Callable("setInt", {
        signature: {
            args: [new StdlibArgument("value", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_interpreter, value: Int32) => {
            this.intrinsic = value;
            return BrsInvalid.Instance;
        },
    });
}
