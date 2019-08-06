import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";

export class RoMessagePort extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private messageQueue: BrsType[];
    constructor() {
        super("roMessagePort");
        this.registerMethods([this.waitMessage, this.getMessage, this.peekMessage]);
        this.messageQueue = [];
    }

    pushMessage(object: BrsType) {
        this.messageQueue.push(object);
    }

    toString(parent?: BrsType): string {
        return "<Component: roMessagePort>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Waits until an event object is available or timeout milliseconds have passed. */
    private waitMessage = new Callable("waitMessage", {
        signature: {
            args: [new StdlibArgument("timeout", ValueKind.Int32)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, numSeconds: Int32) => {
            return BrsInvalid.Instance;
        },
    });

    /** If an event object is available, it is returned. Otherwise invalid is returned. */
    private getMessage = new Callable("getMessage", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            // if (this.messageQueue.length > 0)
            // {
            //     return this.messageQueue.shift();
            // }
            return BrsInvalid.Instance;
        },
    });

    /** Similar to GetMessage() but the returned object (if not invalid) remains in the message queue. */
    private peekMessage = new Callable("peekMessage", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            // if (this.messageQueue.length > 0)
            // {
            //     return this.messageQueue[0];
            // }
            return BrsInvalid.Instance;
        },
    });
}
