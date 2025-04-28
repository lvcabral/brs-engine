import { BrsValue, ValueKind, BrsInvalid, BrsBoolean, BrsString } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsEvent, BrsType, RoMessagePort, RoSystemLogEvent } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { BufferType, DataType } from "../../common";
import { IfSetMessagePort, IfGetMessagePort } from "../interfaces/IfMessagePort";
import { BrsDevice } from "../../device/BrsDevice";

export class RoSystemLog extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly validEvents = ["bandwidth.minute", "http.connect", "http.complete", "http.error"];
    private readonly enabledEvents: string[] = [];
    private port?: RoMessagePort;

    constructor() {
        super("roSystemLog");
        const setPortIface = new IfSetMessagePort(this, this.getNewEvents.bind(this));
        const getPortIface = new IfGetMessagePort(this);
        this.registerMethods({
            ifSystemLog: [this.enableType, setPortIface.setMessagePort, getPortIface.getMessagePort],
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
            const bandwidth = Atomics.load(BrsDevice.sharedArray, DataType.MBWD);
            if (bandwidth > 0) {
                Atomics.store(BrsDevice.sharedArray, DataType.MBWD, -1);
                events.push(new RoSystemLogEvent("bandwidth.minute", bandwidth));
            }
        }
        const bufferFlag = Atomics.load(BrsDevice.sharedArray, DataType.BUF);
        if (bufferFlag === BufferType.SYS_LOG) {
            const strSysLog = BrsDevice.readDataBuffer();
            try {
                const sysLog = JSON.parse(strSysLog);
                if (typeof sysLog.type === "string" && this.enabledEvents.includes(sysLog.type)) {
                    events.push(new RoSystemLogEvent(sysLog.type, sysLog));
                }
            } catch (e: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stdout.write(`warning,[roSystemLog] Error parsing System Log buffer: ${e.message}`);
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
            if (this.validEvents.includes(logType.value) && !this.enabledEvents.includes(logType.value)) {
                this.enabledEvents.push(logType.value);
                postMessage(`syslog,${logType.value}`);
            }
            return BrsInvalid.Instance;
        },
    });
}
