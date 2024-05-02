import { BrsComponent } from "./BrsComponent";
import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";
import { BrsType } from "..";
import { Unboxable } from "../Boxing";

export class RoInvalid extends BrsComponent implements BrsValue, Unboxable {
    readonly kind = ValueKind.Object;
    private intrinsic: BrsInvalid;

    public getValue(): BrsInvalid {
        return this.intrinsic;
    }

    constructor() {
        super("roInvalid");

        this.intrinsic = BrsInvalid.Instance;
        this.registerMethods({
            ifToStr: [this.toStr],
        });
    }

    unbox() {
        return this.intrinsic;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (other instanceof BrsInvalid) {
            return BrsBoolean.True;
        }

        if (other instanceof RoInvalid) {
            return BrsBoolean.True;
        }

        return BrsBoolean.False;
    }

    toString(_parent?: BrsType): string {
        return "<Component: roInvalid>";
    }

    // ---------- ifToStr ----------

    private toStr = new Callable("toStr", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_interpreter: Interpreter) => {
            return new BrsString(this.intrinsic.toString());
        },
    });
}
