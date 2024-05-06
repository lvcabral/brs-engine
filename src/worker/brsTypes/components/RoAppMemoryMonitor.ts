import { BrsValue, ValueKind, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoMessagePort } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";

export class RoAppMemoryMonitor extends BrsComponent implements BrsValue {
    private port?: RoMessagePort;
    readonly kind = ValueKind.Object;

    constructor() {
        super("roAppMemoryMonitor");
        this.registerMethods({
            ifAppMemoryMonitor: [
                this.enableMemoryWarningEvent,
                this.getMemoryLimitPercent,
                this.getChannelAvailableMemory,
            ],
            ifSetMessagePort: [this.setMessagePort],
            ifGetMessagePort: [this.getMessagePort],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roAppMemoryMonitor>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    removeReference(): void {
        super.removeReference();
        if (this.references === 0) {
            this.port?.removeReference();
        }
    }

    // ifChannelStore ------------------------------------------------------------------------------------

    /** Enables a channel to be alerted when it has reached 80% of its memory usage limit. */
    private enableMemoryWarningEvent = new Callable("enableMemoryWarningEvent", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // Mocked until roAppMemoryMonitorEvent is implemented
            return enable;
        },
    });

    /** Returns the usage percentage of memory limit for the channel. */
    private getMemoryLimitPercent = new Callable("getMemoryLimitPercent", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            // Returning 5% until proper memory management is implemented
            return new Int32(5);
        },
    });

    /** Returns the estimated kilobytes (Kb) of memory available for the channel. */
    private getChannelAvailableMemory = new Callable("getChannelAvailableMemory", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            // Returning 486400kb until proper memory management is implemented
            return new Int32(486400);
        },
    });

    // ifGetMessagePort ----------------------------------------------------------------------------------

    /** Returns the message port (if any) currently associated with the object */
    private getMessagePort = new Callable("getMessagePort", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.port ?? BrsInvalid.Instance;
        },
    });

    // ifSetMessagePort ----------------------------------------------------------------------------------

    /** Sets the roMessagePort to be used for all events from the screen */
    private setMessagePort = new Callable("setMessagePort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            port.addReference();
            this.port = port;
            return BrsInvalid.Instance;
        },
    });
}
