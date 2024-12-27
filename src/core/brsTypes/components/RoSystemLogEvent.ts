import { BrsValue, ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, isBrsNumber, RoAssociativeArray, RoDateTime } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoSystemLogEvent extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly logType: BrsString;
    private readonly data: BrsType;

    constructor(logType: BrsString, data: BrsType) {
        super("roSystemLogEvent");
        this.data = data;
        this.logType = logType;
        this.registerMethods({ ifSystemLogEvent: [this.getInfo] });
    }

    toString(parent?: BrsType): string {
        return "<Component: roSystemLogEvent>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Returns an roAssociativeArray describing the system log event. */
    private readonly getInfo = new Callable("getInfo", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            const response = new RoAssociativeArray([]);
            response.set(new BrsString("LogType"), this.logType, true);
            response.set(new BrsString("DateTime"), new RoDateTime(), true);
            if (this.logType.value === "bandwidth.minute" && isBrsNumber(this.data)) {
                response.set(new BrsString("bandwidth"), this.data, true);
            }
            return response;
        },
    });
}
