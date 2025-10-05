import { BrsComponent } from "./BrsComponent";
import { BrsValue, ValueKind, BrsBoolean, BrsInvalid } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { BrsType } from "..";
import { Unboxable } from "../Boxing";
import { IfToStr } from "../interfaces/IfToStr";

export class RoFunction extends BrsComponent implements BrsValue, Unboxable {
    readonly kind = ValueKind.Object;
    private intrinsic: Callable;

    public getValue(): Callable {
        return this.intrinsic;
    }

    constructor(sub: Callable) {
        super("roFunction");

        this.intrinsic = sub ?? new Callable(undefined);
        this.registerMethods({
            ifFunction: [this.getSub, this.setSub],
            ifToStr: [new IfToStr(this, /[<>]/g).toStr],
        });
    }

    unbox() {
        return this.intrinsic;
    }

    copy() {
        return new RoFunction(this.intrinsic);
    }

    equalTo(other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }

    toString(_parent?: BrsType): string {
        return this.intrinsic.toString();
    }

    private readonly getSub = new Callable("getSub", {
        signature: {
            args: [],
            returns: ValueKind.Callable,
        },
        impl: (_: Interpreter) => {
            return this.intrinsic;
        },
    });

    private readonly setSub = new Callable("setSub", {
        signature: {
            args: [new StdlibArgument("value", ValueKind.Callable)],
            returns: ValueKind.Void,
        },
        impl: (_interpreter, value: Callable) => {
            this.intrinsic = value;
            return BrsInvalid.Instance;
        },
    });
}
