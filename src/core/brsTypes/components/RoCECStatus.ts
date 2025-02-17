import { BrsValue, ValueKind, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsEvent, BrsType, RoMessagePort } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoCECStatusEvent } from "../events/RoCECStatusEvent";
import { DataType } from "../../common";
import { IfSetMessagePort, IfGetMessagePort } from "../interfaces/IfMessagePort";
import { BrsDevice } from "../../device/BrsDevice";

export class RoCECStatus extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private port?: RoMessagePort;
    private active: number;

    constructor() {
        super("roCECStatus");
        this.active = 1; // Default to active
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
        const cecActive = Atomics.load(BrsDevice.sharedArray, DataType.CEC);
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
            const cecActive = Atomics.load(BrsDevice.sharedArray, DataType.CEC);
            return BrsBoolean.from(cecActive !== 0);
        },
    });
}
