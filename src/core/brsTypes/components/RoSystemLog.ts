import { BrsValue, ValueKind, BrsInvalid, BrsBoolean, BrsString } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsEvent, BrsType, RoMessagePort, RoSystemLogEvent } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { BufferType, DataType } from "../../common";
import { IfSetMessagePort, IfGetMessagePort } from "../interfaces/IfMessagePort";

export class RoSystemLog extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly interpreter: Interpreter;
    private readonly validEvents = [
        "bandwidth.minute",
        "http.connect",
        "http.complete",
        "http.error",
    ];
    private readonly enabledEvents: string[] = [];
    private port?: RoMessagePort;

    constructor(interpreter: Interpreter) {
        super("roSystemLog");
        this.interpreter = interpreter;
        const setPortIface = new IfSetMessagePort(this, this.getNewEvents.bind(this));
        const getPortIface = new IfGetMessagePort(this);
        this.registerMethods({
            ifSystemLog: [
                this.enableType,
                setPortIface.setMessagePort,
                getPortIface.getMessagePort,
            ],
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
            const strSysLog = this.interpreter.readDataBuffer();
            try {
                const sysLog = JSON.parse(strSysLog);
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
}
