import { BrsComponent } from "./BrsComponent";
import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { BrsType } from "..";
import { Unboxable } from "../Boxing";

export class RoFunction extends BrsComponent implements BrsValue, Unboxable {
    readonly kind = ValueKind.Object;
    private intrinsic: Callable;

    public getValue(): Callable {
        return this.intrinsic;
    }

    constructor(sub: Callable) {
        super("roFunction");

        this.intrinsic = sub;
        this.registerMethods({
            ifFunction: [this.getSub, this.setSub],
        });
    }

    unbox() {
        return this.intrinsic;
    }

    equalTo(other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }

    toString(_parent?: BrsType): string {
        return this.intrinsic.toString();
    }

    // -------------- ifBoolean -------------- //

    private getSub = new Callable("getSub", {
        signature: {
            args: [],
            returns: ValueKind.Callable,
        },
        impl: (_: Interpreter) => {
            return this.intrinsic;
        },
    });

    private setSub = new Callable("setSub", {
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
