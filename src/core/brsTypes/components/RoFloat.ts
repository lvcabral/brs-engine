import { BrsComponent } from "./BrsComponent";
import { BrsValue, ValueKind, BrsBoolean, BrsInvalid } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { BrsType, isBrsNumber } from "..";
import { Unboxable } from "../Boxing";
import { Float } from "../Float";
import { IfToStr } from "../interfaces/IfToStr";

export class RoFloat extends BrsComponent implements BrsValue, Unboxable {
    readonly kind = ValueKind.Object;
    private intrinsic: Float;

    constructor(initialValue: Float) {
        super("roFloat");

        this.intrinsic = new Float(isBrsNumber(initialValue) ? initialValue.getValue() : 0);
        this.registerMethods({
            ifFloat: [this.getFloat, this.setFloat],
            ifToStr: [new IfToStr(this, "%g").toStr],
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
        return new RoFloat(this.intrinsic);
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other instanceof RoFloat) {
            return BrsBoolean.from(other.intrinsic.getValue() === this.intrinsic.getValue());
        }

        return BrsBoolean.False;
    }

    toString(_parent?: BrsType): string {
        return this.intrinsic.toString();
    }

    // -------------- ifFloat --------------

    private readonly getFloat = new Callable("getFloat", {
        signature: {
            args: [],
            returns: ValueKind.Float,
        },
        impl: (_interpreter) => {
            return this.intrinsic;
        },
    });

    private readonly setFloat = new Callable("setFloat", {
        signature: {
            args: [new StdlibArgument("value", ValueKind.Float)],
            returns: ValueKind.Void,
        },
        impl: (_interpreter, value: Float) => {
            this.intrinsic = value;
            return BrsInvalid.Instance;
        },
    });
}
