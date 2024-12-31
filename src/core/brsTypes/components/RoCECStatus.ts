import { BrsValue, ValueKind, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsEvent, BrsType, RoMessagePort } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoCECStatusEvent } from "./RoCECStatusEvent";
import { DataType } from "../../common";

export class RoCECStatus extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly interpreter: Interpreter;
    private port?: RoMessagePort;
    private active: number;

    constructor(interpreter: Interpreter) {
        super("roCECStatus");
        this.interpreter = interpreter;
        this.active = 1; // Default to active
        this.registerMethods({
            ifCECStatus: [this.isActiveSource, this.getMessagePort, this.setMessagePort],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roCECStatus>";
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
        const cecActive = Atomics.load(this.interpreter.sharedArray, DataType.CEC);
        if (cecActive >= 0 && cecActive !== this.active) {
            this.active = cecActive;
            events.push(new RoCECStatusEvent(this.active !== 0));
        }
        return events;
    }

    // ifCECStatus ---------------------------------------------------------------------------------

    /** Indicates whether the device is the active source. */
    private readonly isActiveSource = new Callable("isActiveSource", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            const cecActive = Atomics.load(this.interpreter.sharedArray, DataType.CEC);
            return BrsBoolean.from(cecActive !== 0);
        },
    });

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
