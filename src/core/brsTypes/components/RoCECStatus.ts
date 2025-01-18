import { BrsValue, ValueKind, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsEvent, BrsType, RoMessagePort } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoCECStatusEvent } from "./RoCECStatusEvent";
import { IfSetMessagePort, IfGetMessagePort } from "../interfaces/IfMessagePort";

export class RoCECStatus extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly interpreter: Interpreter;
    private port?: RoMessagePort;
    private active: boolean;

    constructor(interpreter: Interpreter) {
        super("roCECStatus");
        this.interpreter = interpreter;
        this.active = true; // Default to active
        const setPortIface = new IfSetMessagePort(this, this.getNewEvents.bind(this));
        const getPortIface = new IfGetMessagePort(this);
        this.registerMethods({
            ifCECStatus: [
                this.isActiveSource,
                setPortIface.setMessagePort,
                getPortIface.getMessagePort,
            ],
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

    // CEC Status Event -------------------------------------------------------------------------------

    private getNewEvents() {
        const events: BrsEvent[] = [];
        const cecActive = this.interpreter.cecStatus.activeSource;
        if (cecActive !== this.active) {
            this.active = cecActive;
            events.push(new RoCECStatusEvent(cecActive));
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
        impl: (interpreter: Interpreter) => {
            return BrsBoolean.from(interpreter.cecStatus.activeSource);
        },
    });
}
