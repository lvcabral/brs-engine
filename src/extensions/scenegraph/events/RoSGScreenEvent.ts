import { BrsEvent, ValueKind, BrsBoolean, Callable, Interpreter } from "brs-engine";

export class RoSGScreenEvent extends BrsEvent {
    constructor(readonly closed: BrsBoolean) {
        super("roSGScreenEvent");
        this.appendMethods([this.isScreenClosed]);
    }

    /** Checks whether the screen has been closed and is no longer displayed to the user. */
    private readonly isScreenClosed = new Callable("isScreenClosed", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.closed;
        },
    });
}
