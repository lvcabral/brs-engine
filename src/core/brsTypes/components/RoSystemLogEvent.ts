import { BrsValue, ValueKind, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, FlexObject, RoDateTime, toAssociativeArray } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoSystemLogEvent extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly log: FlexObject;

    constructor(logType: string, data: any) {
        super("roSystemLogEvent");
        this.log = {
            LogType: logType,
            Datetime: new RoDateTime(),
            ...data,
        };
        this.registerMethods({ ifroSystemLogEvent: [this.getInfo] });
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
            return toAssociativeArray(this.log);
        },
    });
}
