import { BrsValue, ValueKind, BrsBoolean, BrsString } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsEvent, BrsType, RoMessagePort } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { DataType } from "../../common";
import { IfSetMessagePort, IfGetMessagePort } from "../interfaces/IfMessagePort";
import { RoHdmiStatusEvent } from "./RoHdmiStatusEvent";

export class RoHdmiStatus extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly interpreter: Interpreter;
    private readonly modelType: string;
    private readonly displayMode: string;
    private port?: RoMessagePort;
    private active: boolean;

    constructor(interpreter: Interpreter) {
        super("roHdmiStatus");
        this.interpreter = interpreter;
        const deviceModel = interpreter.deviceInfo.get("deviceModel");
        const device = interpreter.deviceInfo?.get("models")?.get(deviceModel);
        this.modelType = device ? device[1] : "STB";
        this.active = this.modelType !== "TV";
        this.displayMode = interpreter.deviceInfo.get("displayMode") ?? "720p";
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
        const hdmiActive = this.interpreter.hdmiStatus.connected;
        if (hdmiActive !== this.active) {
            this.active = hdmiActive;
            events.push(new RoHdmiStatusEvent(this.active));
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
            return BrsBoolean.from(interpreter.hdmiStatus.connected);
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
