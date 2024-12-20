import { BrsValue, ValueKind, BrsInvalid, BrsBoolean, BrsString } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoAssociativeArray, RoMessagePort } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";

export class RoAppMemoryMonitor extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private port?: RoMessagePort;

    constructor() {
        super("roAppMemoryMonitor");
        this.registerMethods({
            ifAppMemoryMonitor: [
                this.enableMemoryWarningEvent,
                this.getMemoryLimitPercent,
                this.getChannelAvailableMemory, // Since OS 12.5
                this.getChannelMemoryLimit, // Since OS 13.0
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

    dispose() {
        this.port?.removeReference();
    }

    // ifAppMemoryMonitor ------------------------------------------------------------------------------------

    /** Enables an app to be alerted when it has reached 80% of its memory usage limit. */
    private readonly enableMemoryWarningEvent = new Callable("enableMemoryWarningEvent", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // Mocked until roAppMemoryMonitorEvent is implemented
            return enable;
        },
    });

    /** Returns the usage percentage of memory limit for the app. */
    private readonly getMemoryLimitPercent = new Callable("getMemoryLimitPercent", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            const { heapSizeLimit, usedHeapSize } = interpreter.getMemoryHeapInfo();
            return new Int32((usedHeapSize / heapSizeLimit) * 100);
        },
    });

    /** Returns the estimated kilobytes (Kb) of memory available for the app. */
    private readonly getChannelAvailableMemory = new Callable("getChannelAvailableMemory", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const { heapSizeLimit, usedHeapSize } = interpreter.getMemoryHeapInfo();
            return new Int32(heapSizeLimit - usedHeapSize);
        },
    });

    /** Returns the amount of foreground and background memory the app may use and the maximum that the RokuOS may allocate to the app. */
    private readonly getChannelMemoryLimit = new Callable("getChannelMemoryLimit", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            const { heapSizeLimit } = interpreter.getMemoryHeapInfo();
            const memArray = new RoAssociativeArray([]);
            memArray.set(new BrsString("maxForegroundMemory"), new Int32(0), true);
            memArray.set(new BrsString("maxBackgroundMemory"), new Int32(0), true);
            memArray.set(new BrsString("maxRokuManagedHeapMemory"), new Int32(heapSizeLimit), true);
            return memArray;
        },
    });

    // ifGetMessagePort ----------------------------------------------------------------------------------

    /** Returns the message port (if any) currently associated with the object */
    private readonly getMessagePort = new Callable("getMessagePort", {
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
    private readonly setMessagePort = new Callable("setMessagePort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            port.addReference();
            this.port?.removeReference();
            this.port = port;
            return BrsInvalid.Instance;
        },
    });
}
