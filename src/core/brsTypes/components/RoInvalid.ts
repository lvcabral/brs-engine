import { BrsComponent } from "./BrsComponent";
import { BrsValue, ValueKind, BrsBoolean, BrsInvalid, isInvalid } from "../BrsType";
import { BrsType } from "..";
import { Unboxable } from "../Boxing";
import { IfToStr } from "../interfaces/IfToStr";

export class RoInvalid extends BrsComponent implements BrsValue, Unboxable {
    readonly kind = ValueKind.Object;
    private readonly intrinsic: BrsInvalid;

    public getValue(): BrsInvalid {
        return this.intrinsic;
    }

    constructor() {
        super("roInvalid");

        this.intrinsic = BrsInvalid.Instance;
        this.registerMethods({
            ifToStr: [new IfToStr(this).toStr],
        });
    }

    unbox() {
        return this.intrinsic;
    }

    copy() {
        return new RoInvalid();
    }

    equalTo(other: BrsType): BrsBoolean {
        if (isInvalid(other)) {
            return BrsBoolean.True;
        }
        return BrsBoolean.False;
    }

    toString(_parent?: BrsType): string {
        return "<Component: roInvalid>";
    }
}
