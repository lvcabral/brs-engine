import { BrsEvent } from "./BrsEvent";
import { ValueKind, BrsValue, BrsBoolean } from "../BrsType";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoSGScreenEvent extends BrsEvent implements BrsValue {
    constructor(readonly closed: BrsBoolean) {
        super("roSGScreenEvent");
        this.appendMethods([this.isScreenClosed]);
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
