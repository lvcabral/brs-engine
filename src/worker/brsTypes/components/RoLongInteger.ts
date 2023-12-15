import { BrsComponent } from "./BrsComponent";
import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { BrsType } from "..";
import { Unboxable } from "../Boxing";
import { Int64 } from "../Int64";
import { vsprintf } from "sprintf-js";

export class roLongInteger extends BrsComponent implements BrsValue, Unboxable {
    readonly kind = ValueKind.Object;
    private intrinsic: Int64;

    public getValue(): Int64 {
        return this.intrinsic;
    }

    constructor(initialValue: Int64) {
        super("roLongInteger");

        this.intrinsic = initialValue;
        this.registerMethods({
            ifLongInt: [this.getLongInt, this.setLongInt],
            ifToStr: [this.toStr],
        });
    }

    unbox() {
        return this.intrinsic;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other instanceof roLongInteger) {
            return BrsBoolean.from(
                other.intrinsic.getValue().low === this.intrinsic.getValue().low
            );
        }

        return BrsBoolean.False;
    }

    toString(_parent?: BrsType): string {
        return this.intrinsic.toString();
    }

    // ---------- ifLongInt ----------

    private getLongInt = new Callable("getLongInt", {
        signature: {
            args: [],
            returns: ValueKind.Int64,
        },
        impl: (_interpreter) => {
            return this.intrinsic;
        },
    });

    private setLongInt = new Callable("setLongInt", {
        signature: {
            args: [new StdlibArgument("value", ValueKind.Int64)],
            returns: ValueKind.Void,
        },
        impl: (_interpreter, value: Int64) => {
            this.intrinsic = value;
            return BrsInvalid.Instance;
        },
    });

    // ---------- ifToStr ----------

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
