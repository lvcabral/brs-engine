import { BrsValue, ValueKind, BrsInvalid, BrsBoolean, BrsString } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsEvent, BrsType, RoMessagePort, RoSystemLogEvent } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { BufferType, DataType } from "../../common";

export class RoSystemLog extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly interpreter: Interpreter;
    private readonly validEvents = [
        "bandwidth.minute",
        "http.connect",
        "http.complete",
        "http.error",
    ];
    private port?: RoMessagePort;
    private enabledEvents: string[] = [];

    constructor(interpreter: Interpreter) {
        super("roSystemLog");
        this.interpreter = interpreter;
        this.registerMethods({
            ifSystemLog: [this.enableType],
            ifSetMessagePort: [this.setMessagePort],
            ifGetMessagePort: [this.getMessagePort],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roSystemLog>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    dispose() {
        this.port?.unregisterCallback(this.getComponentName());
    }

    // System Log Event -------------------------------------------------------------------------------

    private getNewEvents() {
        const events: BrsEvent[] = [];
        if (this.enabledEvents.includes("bandwidth.minute")) {
            const bandwidth = Atomics.load(this.interpreter.sharedArray, DataType.MBWD);
            if (bandwidth > 0) {
                Atomics.store(this.interpreter.sharedArray, DataType.MBWD, -1);
                events.push(new RoSystemLogEvent("bandwidth.minute", bandwidth));
            }
        }
        const bufferFlag = Atomics.load(this.interpreter.sharedArray, DataType.BUF);
        if (bufferFlag === BufferType.SYS_LOG) {
            const strTracks = this.interpreter.readDataBuffer();
            try {
                const sysLog = JSON.parse(strTracks);
                if (typeof sysLog.type === "string" && this.enabledEvents.includes(sysLog.type)) {
                    events.push(new RoSystemLogEvent(sysLog.type, sysLog));
                }
            } catch (e: any) {
                if (this.interpreter.isDevMode) {
                    this.interpreter.stdout.write(
                        `warning,[roSystemLog] Error parsing System Log buffer: ${e.message}`
                    );
                }
            }
        }
        return events;
    }
    // ifSystemLog ------------------------------------------------------------------------------------

    /** Enables log message of type logType. */
    private readonly enableType = new Callable("enableType", {
        signature: {
            args: [new StdlibArgument("logType", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, logType: BrsString) => {
            if (
                this.validEvents.includes(logType.value) &&
                !this.enabledEvents.includes(logType.value)
            ) {
                this.enabledEvents.push(logType.value);
                postMessage(`syslog,${logType.value}`);
            }
            return BrsInvalid.Instance;
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
            const component = port.getComponentName();
            this.port?.unregisterCallback(component);
            this.port = port;
            this.port.registerCallback(component, this.getNewEvents.bind(this));
            return BrsInvalid.Instance;
        },
    });
}
