import { BrsValue, ValueKind, BrsInvalid, BrsBoolean, BrsString } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsEvent, BrsType, RoMessagePort, RoSystemLogEvent } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
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
    private readonly enabledEvents: Set<string> = new Set();
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
        const event = this.interpreter.sysLogBuffer.shift();
        if (event && this.enabledEvents.has(event.type)) {
            events.push(new RoSystemLogEvent(event.type, event.sysLog));
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
            if (this.validEvents.includes(logType.value)) {
                this.enabledEvents.add(logType.value);
                postMessage(`syslog,${logType.value}`);
            }
            return BrsInvalid.Instance;
        },
    });
}
