import { BrsValue, ValueKind, BrsBoolean, BrsString } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsEvent, BrsType, RoMessagePort } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { DataType } from "../../common";
import { IfSetMessagePort, IfGetMessagePort } from "../interfaces/IfMessagePort";
import { RoHdmiStatusEvent } from "../events/RoHdmiStatusEvent";
import { BrsDevice } from "../../device/BrsDevice";

export class RoHdmiStatus extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly modelType: string;
    private readonly displayMode: string;
    private port?: RoMessagePort;
    private active: number;

    constructor() {
        super("roHdmiStatus");
        this.active = 1; // Default to active

        const deviceModel = BrsDevice.deviceInfo.get("deviceModel");
        const device = BrsDevice.deviceInfo?.get("models")?.get(deviceModel);
        this.modelType = device ? device[1] : "STB";
        this.displayMode = BrsDevice.deviceInfo.get("displayMode") ?? "720p";
        const setPortIface = new IfSetMessagePort(this, this.getNewEvents.bind(this));
        const getPortIface = new IfGetMessagePort(this);
        this.registerMethods({
            ifHdmiStatus: [
                this.isConnected,
                this.getHdcpVersion,
                this.isHdcpActive,
                setPortIface.setMessagePort,
                getPortIface.getMessagePort,
            ],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roHdmiStatus>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    dispose() {
        this.port?.unregisterCallback(this.getComponentName());
    }

    // Hdmi Status Event -------------------------------------------------------------------------------

    private getNewEvents() {
        const events: BrsEvent[] = [];
        const hdmiActive = Atomics.load(BrsDevice.sharedArray, DataType.HDMI);
        if (hdmiActive >= 0 && hdmiActive !== this.active) {
            this.active = hdmiActive;
            events.push(new RoHdmiStatusEvent(this.active !== 0));
        }
        return events;
    }

    // ifHdmiStatus ---------------------------------------------------------------------------------

    /** Indicates whether the device is the active source. */
    private readonly isConnected = new Callable("isConnected", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter) => {
            if (this.modelType === "TV") {
                return BrsBoolean.False;
            }
            const hdmiActive = Atomics.load(BrsDevice.sharedArray, DataType.HDMI);
            return BrsBoolean.from(hdmiActive !== 0);
        },
    });

    /** Returns the version number of the currently established HDCP link. */
    private readonly getHdcpVersion = new Callable("getHdcpVersion", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            const version = this.displayMode === "1080p" ? "2.2" : "1.4";
            return new BrsString(version);
        },
    });

    /** Checks if the current established HDCP link is the specified version or higher. */
    private readonly isHdcpActive = new Callable("isHdcpActive", {
        signature: {
            args: [new StdlibArgument("version", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, version: BrsString) => {
            const validVersions = ["1.4", "2.2"];
            return BrsBoolean.from(validVersions.includes(version.value));
        },
    });
}
