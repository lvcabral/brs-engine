import { BrsValue, ValueKind, BrsInvalid, BrsBoolean, BrsString } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Int32, RoMessagePort, RoSystemLogEvent } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { DataType } from "../../common";

export class RoSystemLog extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly interpreter: Interpreter;
    private port?: RoMessagePort;
    private bandwidthMinute: boolean = false;
    private httpConnect: boolean = false;
    private httpComplete: boolean = false;
    private httpError: boolean = false;

    constructor(interpreter: Interpreter) {
        super("roSystemLog");
        this.interpreter = interpreter;
        this.registerMethods({
            ifSystemLog: [this.enableType],
            ifSetMessagePort: [this.setMessagePort],
            ifGetMessagePort: [this.getMessagePort],
        });
    }

    getSystemLogEvent() {
        if (this.bandwidthMinute) {
            const bandwidth = Atomics.load(this.interpreter.sharedArray, DataType.MBWD);
            if (bandwidth > 0) {
                Atomics.store(this.interpreter.sharedArray, DataType.MBWD, -1);
                return new RoSystemLogEvent(
                    new BrsString("bandwidth.minute"),
                    new Int32(bandwidth)
                );
            }
        }
        if (this.httpConnect || this.httpComplete || this.httpError) {
            // TODO: Implement HTTP log events
        }
        return BrsInvalid.Instance;
    }

    toString(parent?: BrsType): string {
        return "<Component: roSystemLog>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    dispose() {
        this.port?.removeReference();
    }

    // ifInput ------------------------------------------------------------------------------------

    /** Enables log message of type logType. */
    private readonly enableType = new Callable("enableType", {
        signature: {
            args: [new StdlibArgument("logType", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, logType: BrsString) => {
            postMessage(`syslog,${logType.value}`);
            switch (logType.value) {
                case "bandwidth.minute":
                    this.bandwidthMinute = true;
                    break;
                case "http.connect":
                    this.httpConnect = true;
                    break;
                case "http.complete":
                    this.httpComplete = true;
                    break;
                case "http.error":
                    this.httpError = true;
                    break;
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
            port.addReference();
            this.port?.removeReference();
            this.port = port;
            this.port.registerSystemLog(this.getSystemLogEvent.bind(this));
            return BrsInvalid.Instance;
        },
    });
}
