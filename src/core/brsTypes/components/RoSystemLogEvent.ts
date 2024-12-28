import { BrsValue, ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Int32, RoAssociativeArray, RoDateTime } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoSystemLogEvent extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly logType: BrsString;
    private readonly data: any;

    constructor(logType: string, data: any) {
        super("roSystemLogEvent");
        this.data = data;
        this.logType = new BrsString(logType);
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
            if (this.logType.value === "bandwidth.minute" && typeof this.data === "number") {
                response.set(new BrsString("bandwidth"), new Int32(this.data), true);
            } else if (this.logType.value === "http.connect") {
                response.set(new BrsString("HttpCode"), new Int32(this.data.httpCode), true);
                response.set(new BrsString("Status"), new BrsString(this.data.status), true);
                response.set(new BrsString("OrigUrl"), new BrsString(this.data.url), true);
                response.set(new BrsString("Url"), new BrsString(this.data.url), true);
                response.set(new BrsString("Method"), new BrsString("GET"), true);
                response.set(new BrsString("TargetIp"), new BrsString(""), true);
            }
            return response;
        },
    });
}
