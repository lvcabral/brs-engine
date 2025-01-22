import { BrsComponent } from "./BrsComponent";
import { ValueKind, BrsValue, BrsBoolean } from "../BrsType";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";
import { BrsType } from "..";

export class RoSGScreenEvent extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    constructor(readonly closed: BrsBoolean) {
        super("roSGScreenEvent");
        this.appendMethods([this.isScreenClosed]);
    }

    equalTo(other: BrsType) {
        // RBI doesn't allow events to be compared.
        return BrsBoolean.False;
    }

    toString() {
        return "<Component: roSGScreenEvent>";
    }

    /** Checks whether the screen has been closed and is no longer displayed to the user. */
    private isScreenClosed = new Callable("isScreenClosed", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.closed;
        },
    });
}
