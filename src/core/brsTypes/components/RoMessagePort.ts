import { BrsValue, ValueKind, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsEvent, BrsType, isInvalid } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { DebugCommand } from "../../common";
import { BrsDevice } from "../../device/BrsDevice";

export class RoMessagePort extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly messageQueue: BrsEvent[];
    private readonly callbackQueue: Function[];
    private readonly callbackMap: Map<string, Function>;

    constructor() {
        super("roMessagePort");
        this.registerMethods({
            ifMessagePort: [this.waitMessage, this.getMessage, this.peekMessage],
        });
        this.messageQueue = [];
        this.callbackQueue = [];
        this.callbackMap = new Map();
    }

    pushMessage(object: BrsEvent) {
        this.messageQueue.push(object);
    }

    pushCallback(callback: Function) {
        this.callbackQueue.push(callback);
    }

    registerCallback(component: string, callback: Function) {
        this.addReference();
        this.callbackMap.set(component, callback);
    }

    unregisterCallback(component: string) {
        this.removeReference();
        this.callbackMap.delete(component);
    }

    asyncCancel() {
        this.callbackQueue.length = 0;
    }

    toString(parent?: BrsType): string {
        return "<Component: roMessagePort>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    wait(interpreter: Interpreter, ms: number) {
        const loop = ms === 0;
        const timeout = ms + performance.now();

        while (loop || performance.now() < timeout) {
            const msg = this.getNextMessage();
            if (msg instanceof BrsEvent) {
                return msg;
            } else if (!isInvalid(msg)) {
                console.debug(`roMessagePort.wait received non-event message: ${msg.toString()}`);
            }
            this.updateMessageQueue(interpreter, ms);
            const cmd = BrsDevice.checkBreakCommand(interpreter.debugMode);
            if (cmd === DebugCommand.BREAK || cmd === DebugCommand.EXIT) {
                interpreter.debugMode = cmd === DebugCommand.BREAK;
                return BrsInvalid.Instance;
            }
        }
        return BrsInvalid.Instance;
    }

    private updateMessageQueue(interpreter?: Interpreter, wait?: number) {
        if (this.callbackMap.size > 0) {
            for (const [_, callback] of this.callbackMap.entries()) {
                const events = callback(interpreter, wait);
                this.messageQueue.push(...events.filter((e: BrsType) => e instanceof BrsEvent));
            }
        }
    }

    private getNextMessage() {
        if (this.messageQueue.length > 0) {
            return this.messageQueue.shift();
        } else if (this.callbackQueue.length > 0) {
            const callback = this.callbackQueue.shift();
            if (typeof callback === "function") {
                return callback();
            }
        }
        return BrsInvalid.Instance;
    }

    // ifMessagePort ------------------------------------------------------------------------------------

    /** Waits until an event object is available or timeout milliseconds have passed. */
    private readonly waitMessage = new Callable("waitMessage", {
        signature: {
            args: [new StdlibArgument("timeout", ValueKind.Int32)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, timeout: Int32) => {
            return this.wait(interpreter, timeout.getValue());
        },
    });

    /** If an event object is available, it is returned. Otherwise invalid is returned. */
    private readonly getMessage = new Callable("getMessage", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            this.updateMessageQueue();
            return this.getNextMessage();
        },
    });

    /** Similar to GetMessage() but the returned object (if not invalid) remains in the message queue. */
    private readonly peekMessage = new Callable("peekMessage", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            this.updateMessageQueue();
            if (this.messageQueue.length > 0) {
                return this.messageQueue[0];
            }
            if (this.callbackQueue.length > 0) {
                let callback = this.callbackQueue[0];
                if (callback) {
                    const msg = callback();
                    if (!isInvalid(msg)) {
                        this.messageQueue.push(msg);
                        return msg;
                    }
                }
            }
            return BrsInvalid.Instance;
        },
    });
}
