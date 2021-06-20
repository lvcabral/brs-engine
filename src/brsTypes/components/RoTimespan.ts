import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import * as luxon from "luxon";

export class RoTimespan extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private markTime: number;

    constructor(markTime?: number) {
        super("roTimespan");
        if (markTime) {
            this.markTime = markTime;
        } else {
            this.markTime = Date.now();
        }
        this.registerMethods({
            ifTimespan: [
                this.mark,
                this.totalMilliseconds,
                this.totalSeconds,
                this.getSecondsToISO8601Date,
            ],
        });
    }

    resetTime() {
        this.markTime = Date.now();
    }

    toString(parent?: BrsType): string {
        return "<Component: roTimespan>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Sets timespan object to the current time */
    private mark = new Callable("mark", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.resetTime();
            return BrsInvalid.Instance;
        },
    });

    /** Returns total milliseconds from the mark time to now */
    private totalMilliseconds = new Callable("totalMilliseconds", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(Date.now() - this.markTime);
        },
    });

    /** Returns total seconds from the mark time to now */
    private totalSeconds = new Callable("totalSeconds", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(Math.floor((Date.now() - this.markTime) / 1000));
        },
    });

    /** Parses an ISO8601 date and returns number of seconds from now until the given date.
     * If the date is not a valid ISO8601 date string and can't be parsed, the int 2077252342 is returned, consistent with the brightscript method.
     */
    private getSecondsToISO8601Date = new Callable("getSecondsToISO8601Date", {
        signature: {
            args: [new StdlibArgument("date", ValueKind.String)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, date: BrsString) => {
            let dateAsSeconds;
            let now = Date.now();
            let dateToParse = luxon.DateTime.fromISO(date.value, { zone: "utc" });

            if (dateToParse.isValid) {
                dateAsSeconds = Math.round((Date.parse(dateToParse.toISO()) - now) / 1000);
            } else {
                dateAsSeconds = 2077252342;
            }

            return new Int32(dateAsSeconds);
        },
    });
}
