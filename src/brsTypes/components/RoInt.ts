import { BrsComponent } from "./BrsComponent";
import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid, Comparable } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { BrsType } from "..";
import { Unboxable } from "../Boxing";
import { Int32 } from "../Int32";
import { vsprintf } from 'sprintf-js';
export class roInt extends BrsComponent implements BrsValue, Unboxable {
    readonly kind = ValueKind.Object;
    private intrinsic: Int32;

    public getValue(): Int32 {
        return this.intrinsic;
    }

    constructor(initialValue: Int32) {
        super("roInt");

        this.intrinsic = initialValue;
        this.registerMethods({
            ifInt: [this.getInt, this.setInt],
            ifToStr: [this.toStr],
            // Per https://developer.roku.com/docs/references/brightscript/interfaces/ifintops.md,
            // ifIntOps _also_ implements toStr()
            ifIntOps: [this.toStr],
        });
    }

    unbox() {
        return this.intrinsic;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other instanceof roInt) {
            return BrsBoolean.from(other.intrinsic.getValue() === this.intrinsic.getValue());
        }

        return BrsBoolean.False;
    }

    toString(_parent?: BrsType): string {
        return this.intrinsic.toString();
    }

    // ---------- ifInt ----------

    private getInt = new Callable("getInt", {
        signature: {
            args: [],
            returns: ValueKind.Double,
        },
        impl: (_interpreter) => {
            return this.intrinsic;
        },
    });

    private setInt = new Callable("setInt", {
        signature: {
            args: [new StdlibArgument("value", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_interpreter, value: Int32) => {
            this.intrinsic = value;
            return BrsInvalid.Instance;
        },
    });

    // ---------- ifIntOps, ifToStr ----------

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
                    throw new Error("Invalid Format Specifier (runtime error &h24)")
                }
            }
            return new BrsString(this.intrinsic.toString());
        },
    });
}
