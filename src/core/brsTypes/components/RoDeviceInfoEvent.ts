import { BrsValue, ValueKind, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, toAssociativeArray } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoDeviceInfoEvent extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly data: any;
    private readonly isStatusMsg: boolean = false;
    private readonly isCaptionModeMsg: boolean = false;

    constructor(data: any) {
        super("roDeviceInfoEvent");
        this.data = data;
        if (typeof data.Mode === "string") {
            this.isCaptionModeMsg = true;
        } else {
            this.isStatusMsg = true;
        }
        this.registerMethods({
            ifroDeviceInfoEvent: [this.getInfo, this.isStatusMessage, this.isCaptionModeChanged],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roDeviceInfoEvent>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Checks if the device status has changed. */
    private readonly isStatusMessage = new Callable("isStatusMessage", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.isStatusMsg);
        },
    });

    /** Indicates whether the user has changed the closed caption mode. */
    private readonly isCaptionModeChanged = new Callable("isCaptionModeChanged", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.isCaptionModeMsg);
        },
    });

    /** Returns an roAssociativeArray with the current status of the device or the caption mode. */
    private readonly getInfo = new Callable("getInfo", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return toAssociativeArray(this.data);
        },
    });
}
