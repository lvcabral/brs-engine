import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, ValidDateFormats } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import customParseFormat from "dayjs/plugin/customParseFormat";

export class RoTimespan extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private markTime: number;

    constructor(markTime?: number) {
        super("roTimespan");
        if (markTime) {
            this.markTime = markTime;
        } else {
            this.markTime = performance.now();
        }
        dayjs.extend(utc);
        dayjs.extend(customParseFormat);
        this.registerMethods({
            ifTimespan: [
                this.mark,
                this.totalMicroseconds,
                this.totalMilliseconds,
                this.totalSeconds,
                this.getSecondsToISO8601Date,
            ],
        });
    }

    resetTime() {
        this.markTime = performance.now();
    }

    toString(parent?: BrsType): string {
        return "<Component: roTimespan>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Sets timespan object to the current time */
    private readonly mark = new Callable("mark", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.resetTime();
            return BrsInvalid.Instance;
        },
    });

    private readonly totalMicroseconds = new Callable("totalMicroseconds", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(Math.floor((performance.now() - this.markTime) * 1000));
        },
    });

    /** Returns total milliseconds from the mark time to now */
    private readonly totalMilliseconds = new Callable("totalMilliseconds", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(Math.floor(performance.now() - this.markTime));
        },
    });

    /** Returns total seconds from the mark time to now */
    private readonly totalSeconds = new Callable("totalSeconds", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(Math.floor((performance.now() - this.markTime) / 1000));
        },
    });

    /** Parses an ISO8601 date and returns number of seconds from now until the given date.
     * If the date is not a valid ISO8601 date string and can't be parsed, the int 2077252342 is returned, consistent with the brightscript method.
     */
    private readonly getSecondsToISO8601Date = new Callable("getSecondsToISO8601Date", {
        signature: {
            args: [new StdlibArgument("date", ValueKind.String)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, date: BrsString) => {
            let dateAsSeconds = 2077252342;
            const now = Date.now();
            const dateParsed = dayjs(date.value, ValidDateFormats, true).utc(true);
            if (dateParsed.isValid()) {
                dateAsSeconds = Math.round((dateParsed.toDate().valueOf() - now) / 1000);
            }
            return new Int32(dateAsSeconds);
        },
    });
}
