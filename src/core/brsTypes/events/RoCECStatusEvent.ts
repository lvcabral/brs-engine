import { Int32, toAssociativeArray, ValueKind, BrsString } from "..";
import { BrsEvent } from "./BrsEvent";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoCECStatusEvent extends BrsEvent {
    private readonly active: boolean;

    constructor(active: boolean) {
        super("roCECStatusEvent");
        this.active = active;
        this.registerMethods({
            ifroCECStatusEvent: [this.getInfo, this.getIndex, this.getMessage],
        });
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

    /** Returns the string "CECStatus". */
    private readonly getMessage = new Callable("getMessage", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString("CECStatus");
        },
    });

    /** Returns an roAssociativeArray with the current status of the device or the caption mode. */
    private readonly getInfo = new Callable("getInfo", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            const state = this.active ? "ACTIVE" : "INACTIVE";
            return toAssociativeArray({ Active: this.active, ActiveSourceState: state });
        },
    });
}
