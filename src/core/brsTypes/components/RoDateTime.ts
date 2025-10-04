import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean, Uninitialized } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Int64, ValidDateFormats } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { BrsDevice } from "../../device/BrsDevice";

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
                this.asDateStringLoc, // Since OS 12.0
                this.asTimeStringLoc, // Since OS 12.0
                this.asSeconds,
                this.asSecondsLong,
                this.asMillisecondsLong, // Since OS 15.0
                this.fromISO8601String,
                this.fromSeconds,
                this.fromSecondsLong,
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

    formatDate(format: string, locale: string): string {
        const date = new Date(this.markTime);
        let dateString = "";
        switch (format.toLowerCase()) {
            case "long-date": {
                dateString = date
                    .toLocaleDateString(locale, {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        timeZone: "UTC",
                    })
                    .replace(",", "");
                break;
            }
            case "full": {
                dateString = date.toLocaleDateString(locale, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    timeZone: "UTC",
                });
                break;
            }
            case "short-weekday": {
                dateString = date
                    .toLocaleDateString(locale, {
                        weekday: "short",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        timeZone: "UTC",
                    })
                    .replace(",", "");
                break;
            }
            case "no-weekday":
            case "long": {
                dateString = date.toLocaleDateString(locale, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    timeZone: "UTC",
                });
                break;
            }
            case "short-month": {
                dateString = date
                    .toLocaleDateString(locale, {
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
                    .toLocaleDateString(locale, {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                    })
                    .replace(",", "");
                break;
            }
            case "medium":
            case "short-month-no-weekday": {
                dateString = date.toLocaleDateString(locale, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                });
                break;
            }
            case "short": {
                dateString = date.toLocaleDateString(locale, {
                    year: locale !== "en-US" ? "numeric" : "2-digit",
                    month: "numeric",
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
                dateString = dateArray[0] + "/" + dateArray[1] + "/" + parseInt(dateArray[2]).toString();
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
                dateString = dateArray[0] + "-" + dateArray[1] + "-" + parseInt(dateArray[2]).toString();
                break;
            }
        }
        return dateString;
    }

    formatTime(format: string, locale: string): string {
        const date = new Date(this.markTime);
        let timeString = "";
        switch (format.toLowerCase()) {
            case "short": {
                const fmt = new Intl.DateTimeFormat(locale, {
                    timeStyle: "short",
                    timeZone: "UTC",
                });
                timeString = fmt.format(date).toLowerCase();
                break;
            }
            case "short-h12": {
                timeString = new Intl.DateTimeFormat(locale, {
                    hour: "numeric",
                    minute: "numeric",
                    hour12: true,
                    timeZone: "UTC",
                })
                    .format(date)
                    .toLowerCase();
                break;
            }
            case "short-h24": {
                timeString = new Intl.DateTimeFormat(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                    timeZone: "UTC",
                }).format(date);
                break;
            }
        }
        return timeString;
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
    private readonly mark = new Callable("mark", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.resetTime();
            return Uninitialized.Instance;
        },
    });

    /** Returns the date/time as a formatted string */
    private readonly asDateString = new Callable("asDateString", {
        signature: {
            args: [new StdlibArgument("format", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, format: BrsString) => {
            let dateString = this.formatDate(format.value, "en-US");
            if (dateString === "") {
                dateString = this.formatDate("long-date", "en-US");
            }
            return new BrsString(dateString);
        },
    });

    /** Same as AsDateString("long-date") */
    private readonly asDateStringNoParam = new Callable("asDateStringNoParam", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.formatDate("long-date", "en-US"));
        },
    });

    /** Returns the localized date of the device. */
    private readonly asDateStringLoc = new Callable("asDateStringLoc", {
        signature: {
            args: [new StdlibArgument("format", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter, format: BrsString) => {
            const rokuDateTokens = ["EEEE", "EEE", "dd", "d", "MMMM", "MMM", "MM", "M", "yy", "y"];
            const locale = BrsDevice.deviceInfo.locale.replace("_", "-");
            const dateFormat = format.value.trim() === "" ? "short" : format.value;
            let dateString = this.formatDate(dateFormat, locale);
            if (dateString === "") {
                const date = new Date(this.markTime);
                dateString = localeFormat(date, wrapTokens(format.value, rokuDateTokens), locale);
            }
            return new BrsString(dateString);
        },
    });

    /** Returns the localized time of the device. */
    private readonly asTimeStringLoc = new Callable("asTimeStringLoc", {
        signature: {
            args: [new StdlibArgument("format", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter, format: BrsString) => {
            const rokuTimeTokens = ["HH", "H", "hh", "h", "mm", "m", "a"];
            const locale = BrsDevice.deviceInfo.locale.replace("_", "-");
            const dateFormat = format.value.trim() === "" ? "short" : format.value;
            let timeString = this.formatTime(dateFormat, locale);
            if (timeString === "") {
                const date = new Date(this.markTime);
                timeString = localeFormat(date, wrapTokens(format.value, rokuTimeTokens), locale);
            }
            return new BrsString(timeString);
        },
    });

    /** Returns the date/time as the number of seconds from the Unix epoch (00:00:00 1/1/1970 GMT) */
    private readonly asSeconds = new Callable("asSeconds", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.markTime / 1000);
        },
    });

    /** Set the date/time using a string in the ISO 8601 format */
    private readonly fromISO8601String = new Callable("fromISO8601String", {
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
            return Uninitialized.Instance;
        },
    });

    /** Returns the date/time as the number of seconds from the Unix epoch (00:00:00 1/1/1970 GMT) as Long Integer */
    private readonly asSecondsLong = new Callable("asSecondsLong", {
        signature: {
            args: [],
            returns: ValueKind.Int64,
        },
        impl: (_: Interpreter) => {
            return new Int64(this.markTime / 1000);
        },
    });

    /** Returns the date/time as the number of milliseconds from the Unix epoch (00:00:00 1/1/1970 GMT) as Long Integer */
    private readonly asMillisecondsLong = new Callable("asMillisecondsLong", {
        signature: {
            args: [],
            returns: ValueKind.Int64,
        },
        impl: (_: Interpreter) => {
            return new Int64(this.markTime);
        },
    });

    /** Set the date/time value using the number of seconds from the Unix epoch */
    private readonly fromSeconds = new Callable("fromSeconds", {
        signature: {
            args: [new StdlibArgument("numSeconds", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, numSeconds: Int32) => {
            this.markTime = numSeconds.getValue() * 1000;
            return Uninitialized.Instance;
        },
    });

    /** Set the date/time value using the number of seconds from the Unix epoch as Long Integer */
    private readonly fromSecondsLong = new Callable("fromSecondsLong", {
        signature: {
            args: [new StdlibArgument("numSeconds", ValueKind.Int64)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, numSeconds: Int64) => {
            this.markTime = numSeconds.getValue().toNumber() * 1000;
            return BrsInvalid.Instance;
        },
    });

    /** Returns the date/time value's day of the month */
    private readonly getDayOfMonth = new Callable("getDayOfMonth", {
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
    private readonly getDayOfWeek = new Callable("getDayOfWeek", {
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
    private readonly getHours = new Callable("getHours", {
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
    private readonly getLastDayOfMonth = new Callable("getLastDayOfMonth", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            const date = new Date(this.markTime);
            return new Int32(new Date(date.getUTCFullYear(), date.getUTCMonth() + 1, 0).getUTCDate());
        },
    });

    /** Returns the date/time value's millisecond within the second */
    private readonly getMilliseconds = new Callable("getMilliseconds", {
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
    private readonly getMinutes = new Callable("getMinutes", {
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
    private readonly getMonth = new Callable("getMonth", {
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
    private readonly getSeconds = new Callable("getSeconds", {
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
    private readonly getTimeZoneOffset = new Callable("getTimeZoneOffset", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            // From: https://stackoverflow.com/a/68593283
            const getOffset = (timeZone = "UTC", date = new Date()) => {
                const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
                const tzDate = new Date(date.toLocaleString("en-US", { timeZone: timeZone }));
                return Math.round((tzDate.getTime() - utcDate.getTime()) / 6e4);
            };
            return new Int32(-getOffset(BrsDevice.deviceInfo.timeZone) + 0);
        },
    });

    /** Returns the day of the week */
    private readonly getWeekday = new Callable("getWeekday", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            const date = new Date(this.markTime);
            return new BrsString(date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }));
        },
    });

    /** Returns the date/time value's year */
    private readonly getYear = new Callable("getYear", {
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
    private readonly toISOString = new Callable("toISOString", {
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
    private readonly toLocalTime = new Callable("toLocalTime", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.markTime -= new Date(this.markTime).getTimezoneOffset() * 60 * 1000;
            return Uninitialized.Instance;
        },
    });
}

/**
 * Function to Wrap date/time tokens with curly braces
 * @param input - String to wrap tokens
 * @param tokens - Array of tokens to find and wrap
 * @returns String with wrapped tokens
 */
function wrapTokens(input: string, tokens: string[]): string {
    const tokenRegex = new RegExp(`(${tokens.join("|")})`, "g");
    return input.replace(tokenRegex, (match, token, offset, string) => {
        const before = string[offset - 1];
        const after = string[offset + token.length];
        if (before && /[a-zA-Z0-9]/.test(before) && after && /[a-zA-Z0-9]/.test(after)) {
            return token;
        }
        return `{${token}}`;
    });
}

/**
 * Use this API for locale-based formatting.
 *
 * @param {Date}  date - Date object, which should be used.
 * @param {string} exp - String, which you want to format
 * @param {string | string[]} [locale="en-US"] - Locale(s), which will be used for formatting.
 * @return {string} String with formatted date.
 *
 * @borrows from https://github.com/xxczaki/light-date converted to use BrightScript tokens
 */
const localeFormat = (date: Date, exp: string, locale: string | string[] = "en-US"): string => {
    const tokenRegex = /\\?\{(yy|y|MM|M|dd|d|HH|H|hh|h|mm|m|MMMM|MMM|EEEE|EEE|a)\}/g;
    return exp.replace(tokenRegex, (key) => {
        if (key.startsWith("\\")) {
            return key.slice(1);
        }

        switch (key) {
            case "{yy}":
                return `${date.getUTCFullYear()}`.slice(-2);
            case "{y}":
                return `${date.getUTCFullYear()}`;
            case "{MM}":
                return `${date.getUTCMonth() + 1}`.padStart(2, "0");
            case "{M}":
                return `${date.getUTCMonth() + 1}`;
            case "{dd}":
                return `${date.getUTCDate()}`.padStart(2, "0");
            case "{d}":
                return `${date.getUTCDate()}`;
            case "{HH}":
                return `${date.getUTCHours()}`.padStart(2, "0");
            case "{H}":
                return `${date.getUTCHours()}`;
            case "{hh}":
                return `${date.getUTCHours() % 12 || 12}`.padStart(2, "0");
            case "{h}":
                return `${date.getUTCHours() % 12 || 12}`;
            case "{mm}":
                return `${date.getUTCMinutes()}`.padStart(2, "0");
            case "{m}":
                return `${date.getUTCMinutes()}`;
            case "{MMMM}":
                return new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(date);
            case "{MMM}":
                return new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(date);
            case "{EEEE}":
                return new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(date);
            case "{EEE}":
                return new Intl.DateTimeFormat(locale, {
                    weekday: "short",
                    timeZone: "UTC",
                }).format(date);
            case "{a}": {
                const parts = new Intl.DateTimeFormat(locale, {
                    hour: "numeric",
                    hour12: true,
                    timeZone: "UTC",
                }).formatToParts(date);
                return parts.find((part) => part.type === "dayPeriod")?.value.toLowerCase() ?? "";
            }
            default:
                return "";
        }
    });
};
