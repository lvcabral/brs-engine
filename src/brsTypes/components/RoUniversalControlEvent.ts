import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";

export class RoUniversalControlEvent extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private key: number;

    constructor(key: number) {
        super("roUniversalControlEvent");
        this.key = key;

        this.registerMethods([this.getInt]);
    }

    toString(parent?: BrsType): string {
        return "<Component: roUniversalControlEvent>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Returns an integer representing pressed or released keys on the remote. */
    private getInt = new Callable("getInt", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.key);
        },
    });
}
