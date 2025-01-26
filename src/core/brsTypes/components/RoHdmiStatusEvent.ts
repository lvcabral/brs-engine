import { BrsValue, ValueKind, BrsBoolean, BrsString } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Int32, toAssociativeArray } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoHdmiStatusEvent extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly plugged: boolean;

    constructor(plugged: boolean) {
        super("roHdmiStatusEvent");
        this.plugged = plugged;
        this.registerMethods({
            ifroHdmiStatusEvent: [this.getInfo, this.getIndex, this.getMessage],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roHdmiStatusEvent>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** The index value of this event is not used and is always set to 0. */
    private readonly getIndex = new Callable("getIndex", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(0);
        },
    });

    /** Returns the string "HdmiHotPlug". */
    private readonly getMessage = new Callable("getMessage", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString("HdmiHotPlug");
        },
    });

    /** Returns an roAssociativeArray with the current status of the device or the caption mode. */
    private readonly getInfo = new Callable("getInfo", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return toAssociativeArray({
                ChannelId: "tvinput.hdmi1",
                Plugged: this.plugged,
                PortType: "Tx",
                PortNumber: 1,
            });
        },
    });
}
