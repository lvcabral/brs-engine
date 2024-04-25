import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, ValidDateFormats } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import customParseFormat from "dayjs/plugin/customParseFormat";

export class RoDateTime extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private markTime = Date.now();

    constructor(seconds?: number) {
        super("roDateTime");
        dayjs.extend(utc);
        dayjs.extend(customParseFormat);
        this.registerMethods({
            ifDateTime: [
                this.mark,
                this.asDateString,
                this.asDateStringNoParam,
                this.asSeconds,
                this.fromISO8601String,
                this.fromSeconds,
                this.getDayOfMonth,
                this.getDayOfWeek,
                this.getHours,
                this.getLastDayOfMonth,
                this.getMilliseconds,
                this.getMinutes,
                this.getMonth,
                this.getSeconds,
                this.getTimeZoneOffset,
                this.getWeekday,
                this.getYear,
                this.toISOString,
                this.toLocalTime,
            ],
        });
        if (!seconds) {
            this.resetTime();
        } else {
            this.markTime = seconds * 1000;
        }
    }

    resetTime() {
        this.markTime = Date.now();
    }

    toString(parent?: BrsType): string {
        return "<Component: roDateTime>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Set the date/time value to the current UTC date and time */
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

    /** Returns the date/time as a formatted string */
    private asDateString = new Callable("asDateString", {
        signature: {
            args: [new StdlibArgument("format", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, format: BrsString) => {
            const date = new Date(this.markTime);
            let dateString = "";
            switch (format.toString()) {
                case "short-weekday": {
                    dateString = date
                        .toLocaleDateString("en-US", {
                            weekday: "short",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            timeZone: "UTC",
                        })
                        .replace(",", "");
                    break;
                }
                case "no-weekday": {
                    dateString = date.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        timeZone: "UTC",
                    });
                    break;
                }
                case "short-month": {
                    dateString = date
                        .toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            timeZone: "UTC",
                        })
                        .replace(",", "");
                    break;
                }
                case "short-month-short-weekday": {
                    dateString = date
                        .toLocaleDateString("en-US", {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            timeZone: "UTC",
                        })
                        .replace(",", "");
                    break;
                }
                case "short-month-no-weekday": {
                    dateString = date.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                    });
                    break;
                }
                case "short-date": {
                    const dateArray = date
                        .toLocaleDateString("en-US", {
                            year: "2-digit",
                            month: "numeric",
                            day: "numeric",
                            timeZone: "UTC",
                        })
                        .split("/");
                    dateString =
                        dateArray[0] + "/" + dateArray[1] + "/" + parseInt(dateArray[2]).toString();
                    break;
                }
                case "short-date-dashes": {
                    const dateArray = date
                        .toLocaleDateString("en-US", {
                            year: "2-digit",
                            month: "numeric",
                            day: "numeric",
                            timeZone: "UTC",
                        })
                        .split("/");
                    dateString =
                        dateArray[0] + "-" + dateArray[1] + "-" + parseInt(dateArray[2]).toString();
                    break;
                }
                default: {
                    // default format: long-date
                    dateString = date
                        .toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            timeZone: "UTC",
                        })
                        .replace(",", "");
                    break;
                }
            }
            return new BrsString(dateString);
        },
    });

    /** Same as AsDateString("long-date") */
    private asDateStringNoParam = new Callable("asDateStringNoParam", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            const date = new Date(this.markTime);
            const dtoptions = {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
            } as Intl.DateTimeFormatOptions;
            return new BrsString(date.toLocaleDateString("en-US", dtoptions).replace(",", ""));
        },
    });

    /** Returns the date/time as the number of seconds from the Unix epoch (00:00:00 1/1/1970 GMT) */
    private asSeconds = new Callable("asSeconds", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.markTime / 1000);
        },
    });

    /** Set the date/time using a string in the ISO 8601 format */
    private fromISO8601String = new Callable("fromISO8601String", {
        signature: {
            args: [new StdlibArgument("dateString", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, dateString: BrsString) => {
            let dateParsed = dayjs(dateString.value, ValidDateFormats, true).utc(true);
            if (!dateParsed.isValid()) {
                dateParsed = dayjs(0);
            }
            this.markTime = dateParsed.toDate().valueOf();
            return BrsInvalid.Instance;
        },
    });

    /** Set the date/time value using the number of seconds from the Unix epoch */
    private fromSeconds = new Callable("fromSeconds", {
        signature: {
            args: [new StdlibArgument("numSeconds", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, numSeconds: Int32) => {
            this.markTime = numSeconds.getValue() * 1000;
            return BrsInvalid.Instance;
        },
    });

    /** Returns the date/time value's day of the month */
    private getDayOfMonth = new Callable("getDayOfMonth", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            const date = new Date(this.markTime);
            return new Int32(date.getUTCDate());
        },
    });

    /** Returns the date/time value's day of the week */
    private getDayOfWeek = new Callable("getDayOfWeek", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            const date = new Date(this.markTime);
            return new Int32(date.getUTCDay());
        },
    });

    /** Returns the date/time value's hour within the day */
    private getHours = new Callable("getHours", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            const date = new Date(this.markTime);
            return new Int32(date.getUTCHours());
        },
    });

    /** Returns the date/time value's last day of the month */
    private getLastDayOfMonth = new Callable("getLastDayOfMonth", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            const date = new Date(this.markTime);
            return new Int32(
                new Date(date.getUTCFullYear(), date.getUTCMonth() + 1, 0).getUTCDate()
            );
        },
    });

    /** Returns the date/time value's millisecond within the second */
    private getMilliseconds = new Callable("getMilliseconds", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            const date = new Date(this.markTime);
            return new Int32(date.getUTCMilliseconds());
        },
    });

    /** Returns the date/time value's minute within the hour */
    private getMinutes = new Callable("getMinutes", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            const date = new Date(this.markTime);
            return new Int32(date.getUTCMinutes());
        },
    });

    /** Returns the date/time value's month */
    private getMonth = new Callable("getMonth", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            const date = new Date(this.markTime);
            return new Int32(date.getUTCMonth() + 1);
        },
    });

    /** Returns the date/time value's second within the minute */
    private getSeconds = new Callable("getSeconds", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            const date = new Date(this.markTime);
            return new Int32(date.getUTCSeconds());
        },
    });

    /** Returns the offset in minutes from the system time zone to UTC */
    private getTimeZoneOffset = new Callable("getTimeZoneOffset", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            // From: https://stackoverflow.com/a/68593283
            const getOffset = (timeZone = "UTC", date = new Date()) => {
                const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
                const tzDate = new Date(date.toLocaleString("en-US", { timeZone: timeZone }));
                return (tzDate.getTime() - utcDate.getTime()) / 6e4;
            };
            return new Int32(getOffset(interpreter.deviceInfo.get("timeZone")) * -1);
        },
    });

    /** Returns the day of the week */
    private getWeekday = new Callable("getWeekday", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            const date = new Date(this.markTime);
            return new BrsString(
                date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })
            );
        },
    });

    /** Returns the date/time value's year */
    private getYear = new Callable("getYear", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            const date = new Date(this.markTime);
            return new Int32(date.getUTCFullYear());
        },
    });

    /** Return an ISO 8601 representation of the date/time value */
    private toISOString = new Callable("toISOString", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            const date = new Date(this.markTime);
            return new BrsString(date.toISOString().split(".")[0] + "Z");
        },
    });

    /** Offsets the date/time value from an assumed UTC date/time to a local date/time using the system time zone setting. */
    private toLocalTime = new Callable("toLocalTime", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.markTime -= new Date(this.markTime).getTimezoneOffset() * 60 * 1000;
            return BrsInvalid.Instance;
        },
    });
}
