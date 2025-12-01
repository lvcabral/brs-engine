import { ValueKind, FlexObject, RoDateTime, toAssociativeArray } from "..";
import { BrsEvent } from "./BrsEvent";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoSystemLogEvent extends BrsEvent {
    private readonly logType: string;
    private readonly data: any;

    constructor(logType: string, data: any) {
        super("roSystemLogEvent");
        this.data = data;
        this.logType = logType;
        this.registerMethods({ ifroSystemLogEvent: [this.getInfo] });
    }

    /** Returns an roAssociativeArray describing the system log event. */
    private readonly getInfo = new Callable("getInfo", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            const info: FlexObject = { logType: this.logType, DateTime: new RoDateTime() };
            if (this.logType === "bandwidth.minute" && typeof this.data === "number") {
                info.bandwidth = this.data;
            } else if (this.logType === "http.connect") {
                info.HttpCode = this.data.httpCode;
                info.Status = this.data.status;
                info.OrigUrl = this.data.url;
                info.Url = this.data.url;
                info.Method = "GET";
                info.TargetIp = "";
            }
            return toAssociativeArray(info);
        },
    });
}
