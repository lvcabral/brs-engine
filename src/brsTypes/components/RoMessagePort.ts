import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { RoUniversalControlEvent } from "./RoUniversalControlEvent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { control } from "../..";

export class RoMessagePort extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private messageQueue: BrsType[];
    private keys: Int32Array;
    private lastKey: number;
    constructor() {
        super("roMessagePort");
        this.registerMethods([this.waitMessage, this.getMessage, this.peekMessage]);
        this.messageQueue = [];
        this.lastKey = 0;
        let keys = control.get("keys");
        if (keys) {
            this.keys = keys;
        } else {
            this.keys = new Int32Array([]);
        }
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

    wait(ms: number) {
        if (ms === 0) {
            while (true) {
                if (this.keys[0] !== this.lastKey) {
                    this.lastKey = this.keys[0];
                    return new RoUniversalControlEvent(this.lastKey);
                }
            }
        } else {
            let sec = Math.trunc(ms / 1000);
            ms += new Date().getTime();
            while (new Date().getTime() < ms) {
                if (this.keys[0] !== this.lastKey) {
                    this.lastKey = this.keys[0];
                    return new RoUniversalControlEvent(this.lastKey);
                }
            }
        }
        return BrsInvalid.Instance;
    }

    /** Waits until an event object is available or timeout milliseconds have passed. */
    private waitMessage = new Callable("waitMessage", {
        signature: {
            args: [new StdlibArgument("timeout", ValueKind.Int32)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, timeout: Int32) => {
            return this.wait(timeout.getValue());
        },
    });

    /** If an event object is available, it is returned. Otherwise invalid is returned. */
    private getMessage = new Callable("getMessage", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            if (this.keys[0] !== this.lastKey) {
                this.lastKey = this.keys[0];
                return new RoUniversalControlEvent(this.lastKey);
            }
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
