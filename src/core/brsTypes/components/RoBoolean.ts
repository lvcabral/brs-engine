import { BrsComponent } from "./BrsComponent";
import { BrsValue, ValueKind, BrsBoolean, BrsInvalid } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { BrsType, isBrsNumber } from "..";
import { Unboxable } from "../Boxing";
import { IfToStr } from "../interfaces/IfToStr";

export class RoBoolean extends BrsComponent implements BrsValue, Unboxable {
    readonly kind = ValueKind.Object;
    private intrinsic: BrsBoolean = BrsBoolean.False;

    public getValue(): boolean {
        return this.intrinsic.toBoolean();
    }

    constructor(initialValue: BrsBoolean) {
        super("roBoolean");

        if (initialValue instanceof BrsBoolean) {
            this.intrinsic = initialValue;
        }
        this.registerMethods({
            ifBoolean: [this.getBoolean, this.setBoolean],
            ifToStr: [new IfToStr(this).toStr],
        });
    }

    unbox() {
        return this.intrinsic;
    }

    copy() {
        return new RoBoolean(this.intrinsic);
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other instanceof RoBoolean) {
            return BrsBoolean.from(other.getValue() === this.getValue());
        } else if (isBrsNumber(other) || other instanceof BrsBoolean) {
            return BrsBoolean.from(other.toBoolean() === this.intrinsic.toBoolean());
        }

        return BrsBoolean.False;
    }

    toString(_parent?: BrsType): string {
        return this.intrinsic.toString();
    }

    toBoolean(): boolean {
        return this.intrinsic.toBoolean();
    }

    fromBoolean(value: boolean) {
        this.intrinsic = BrsBoolean.from(value);
    }

    // -------------- ifBoolean -------------- //

    private readonly getBoolean = new Callable("getBoolean", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return this.intrinsic;
        },
    });

    private readonly setBoolean = new Callable("setBoolean", {
        signature: {
            args: [new StdlibArgument("value", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_, value: BrsBoolean) => {
            this.intrinsic = value;
            return BrsInvalid.Instance;
        },
    });
}
