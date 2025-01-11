import { BrsValue, ValueKind, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoMessagePort, toAssociativeArray } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { IfSetMessagePort, IfGetMessagePort } from "../interfaces/IfMessagePort";

export class RoAppMemoryMonitor extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private port?: RoMessagePort;

    constructor() {
        super("roAppMemoryMonitor");
        const setPortIface = new IfSetMessagePort(this);
        const getPortIface = new IfGetMessagePort(this);
        this.registerMethods({
            ifAppMemoryMonitor: [
                this.enableMemoryWarningEvent,
                this.getMemoryLimitPercent,
                this.getChannelAvailableMemory, // Since OS 12.5
                this.getChannelMemoryLimit, // Since OS 13.0
            ],
            ifSetMessagePort: [setPortIface.setMessagePort],
            ifGetMessagePort: [getPortIface.getMessagePort],
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
            const memLimit = {
                maxForegroundMemory: 0,
                maxBackgroundMemory: 0,
                maxRokuManagedHeapMemory: heapSizeLimit,
            };
            return toAssociativeArray(memLimit);
        },
    });
}
