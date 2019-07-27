const brs = require("brs");
const { RoDateTime, Int32, BrsString, BrsInvalid } = brs.types;
const { Interpreter } = require("../../../lib/interpreter");
const lolex = require("lolex");

describe("RoDateTime", () => {
    let dt;
    let clock;

    beforeEach(() => {
        clock = lolex.install({ now: 1230768000123 });
        dt = new RoDateTime();
    });

    afterAll(() => {
        clock.uninstall();
    });

    describe("stringification", () => {
        it("inits a new brs roDateTime", () => {
            expect(dt.toString()).toEqual("<Component: roDateTime>");
        });
    });

    describe("markTime", () => {
        it("inits a new timespan with the current time", () => {
            expect(dt.markTime).toEqual(clock.now);
        });
    });

    describe("methods", () => {
        let interpreter;

        beforeEach(() => {
            interpreter = new Interpreter();
        });

        describe("mark", () => {
            it("resets mark time to current time", () => {
                let mark = dt.getMethod("mark");
                clock.tick(10000);

                let result = mark.call(interpreter);
                expect(mark).toBeTruthy();
                expect(dt.markTime).toEqual(clock.now);
                expect(result).toBe(BrsInvalid.Instance);
            });
        });

        describe("asDateString", () => {
            it("returns date string with empty param", () => {
                let asDateString = dt.getMethod("asDateString");

                let result = asDateString.call(interpreter, new BrsString(""));
                expect(asDateString).toBeTruthy();
                expect(result).toEqual(new BrsString("Thursday January 1, 2009"));
            });

            it("returns date string with invalid param", () => {
                let asDateString = dt.getMethod("asDateString");

                let result = asDateString.call(interpreter, new BrsString("anything"));
                expect(asDateString).toBeTruthy();
                expect(result).toEqual(new BrsString("Thursday January 1, 2009"));
            });

            it("returns date string with param: full-date", () => {
                let asDateString = dt.getMethod("asDateString");

                let result = asDateString.call(interpreter, new BrsString("full-date"));
                expect(asDateString).toBeTruthy();
                expect(result).toEqual(new BrsString("Thursday January 1, 2009"));
            });

            it("returns date string with param: short-weekday", () => {
                let asDateString = dt.getMethod("asDateString");

                let result = asDateString.call(interpreter, new BrsString("short-weekday"));
                expect(asDateString).toBeTruthy();
                expect(result).toEqual(new BrsString("Thu January 1, 2009"));
            });

            it("returns date string with param: no-weekday", () => {
                let asDateString = dt.getMethod("asDateString");

                let result = asDateString.call(interpreter, new BrsString("no-weekday"));
                expect(asDateString).toBeTruthy();
                expect(result).toEqual(new BrsString("January 1, 2009"));
            });

            it("returns date string with param: short-month-short-weekday", () => {
                let asDateString = dt.getMethod("asDateString");

                let result = asDateString.call(
                    interpreter,
                    new BrsString("short-month-short-weekday")
                );
                expect(asDateString).toBeTruthy();
                expect(result).toEqual(new BrsString("Thu Jan 1, 2009"));
            });

            it("returns date string with param: short-month-no-weekday", () => {
                let asDateString = dt.getMethod("asDateString");

                let result = asDateString.call(
                    interpreter,
                    new BrsString("short-month-no-weekday")
                );
                expect(asDateString).toBeTruthy();
                expect(result).toEqual(new BrsString("Jan 1, 2009"));
            });

            it("returns date string with param: short-date", () => {
                let asDateString = dt.getMethod("asDateString");

                let result = asDateString.call(interpreter, new BrsString("short-date"));
                expect(asDateString).toBeTruthy();
                expect(result).toEqual(new BrsString("1/1/9"));
            });

            it("returns date string with param: short-date-dashes", () => {
                let asDateString = dt.getMethod("asDateString");

                let result = asDateString.call(interpreter, new BrsString("short-date-dashes"));
                expect(asDateString).toBeTruthy();
                expect(result).toEqual(new BrsString("1-1-9"));
            });
        });

        describe("asDateStringNoParam", () => {
            it("returns date string with empty param", () => {
                let asDateStringNoParam = dt.getMethod("asDateStringNoParam");

                let result = asDateStringNoParam.call(interpreter);
                expect(asDateStringNoParam).toBeTruthy();
                expect(result).toEqual(new BrsString("Thursday January 1, 2009"));
            });
        });

        describe("asSeconds", () => {
            it("returns the date/time as the number of seconds from the Unix epoch", () => {
                let asSeconds = dt.getMethod("asSeconds");
                let result = asSeconds.call(interpreter);
                expect(asSeconds).toBeTruthy();
                expect(result).toEqual(new Int32(1230768000));
            });
        });

        describe("fromISO8601String", () => {
            it("set the date/time using a string in the ISO 8601 format", () => {
                let fromISO8601String = dt.getMethod("fromISO8601String");
                expect(fromISO8601String).toBeTruthy();
                let result = fromISO8601String.call(
                    interpreter,
                    new BrsString("2019-07-27T17:08:41")
                );
                expect(new Int32(dt.markTime)).toEqual(new Int32(1564247321000));
                expect(result).toBe(BrsInvalid.Instance);
            });

            it("set the date/time using an invalid string", () => {
                let fromISO8601String = dt.getMethod("fromISO8601String");
                expect(fromISO8601String).toBeTruthy();
                let result = fromISO8601String.call(interpreter, new BrsString("garbage"));
                expect(new Int32(dt.markTime)).toEqual(new Int32(0));
                expect(result).toBe(BrsInvalid.Instance);
            });
        });

        describe("fromSeconds", () => {
            it("set the date/time value using the number of seconds from the Unix epoch", () => {
                let fromSeconds = dt.getMethod("fromSeconds");
                expect(fromSeconds).toBeTruthy();
                let result = fromSeconds.call(interpreter, new Int32(1564247321));
                expect(new Int32(dt.markTime)).toEqual(new Int32(1564247321000));
                expect(result).toBe(BrsInvalid.Instance);
            });
        });

        describe("getDayOfMonth", () => {
            it("returns the date/time value's day of the month", () => {
                let getDayOfMonth = dt.getMethod("getDayOfMonth");
                let result = getDayOfMonth.call(interpreter);
                expect(getDayOfMonth).toBeTruthy();
                expect(result).toEqual(new Int32(1));
            });
        });

        describe("getDayOfWeek", () => {
            it("returns the date/time value's day of the week", () => {
                let getDayOfWeek = dt.getMethod("getDayOfWeek");
                let result = getDayOfWeek.call(interpreter);
                expect(getDayOfWeek).toBeTruthy();
                expect(result).toEqual(new Int32(4));
            });
        });

        describe("getHours", () => {
            it("returns the date/time value's hour within the day", () => {
                let getHours = dt.getMethod("getHours");
                let result = getHours.call(interpreter);
                expect(getHours).toBeTruthy();
                expect(result).toEqual(new Int32(0));
            });
        });

        describe("getLastDayOfMonth", () => {
            it("returns the date/time value's last day of the month", () => {
                let getLastDayOfMonth = dt.getMethod("getLastDayOfMonth");
                let result = getLastDayOfMonth.call(interpreter);
                expect(getLastDayOfMonth).toBeTruthy();
                expect(result).toEqual(new Int32(31));
            });
        });

        describe("getMilliseconds", () => {
            it("returns the date/time value's millisecond within the second", () => {
                let getMilliseconds = dt.getMethod("getMilliseconds");
                let result = getMilliseconds.call(interpreter);
                expect(getMilliseconds).toBeTruthy();
                expect(result).toEqual(new Int32(123));
            });
        });

        describe("getMinutes", () => {
            it("returns the date/time value's minute within the hour", () => {
                let getMinutes = dt.getMethod("getMinutes");
                let result = getMinutes.call(interpreter);
                expect(getMinutes).toBeTruthy();
                expect(result).toEqual(new Int32(0));
            });
        });

        describe("getMonth", () => {
            it("returns the date/time value's month", () => {
                let getMonth = dt.getMethod("getMonth");
                let result = getMonth.call(interpreter);
                expect(getMonth).toBeTruthy();
                expect(result).toEqual(new Int32(1));
            });
        });

        describe("getSeconds", () => {
            it("returns the date/time value's second within the minute", () => {
                let getSeconds = dt.getMethod("getSeconds");
                let result = getSeconds.call(interpreter);
                expect(getSeconds).toBeTruthy();
                expect(result).toEqual(new Int32(0));
            });
        });

        describe("getTimeZoneOffset", () => {
            it("returns the offset in minutes from the system time zone to UTC", () => {
                let getTimeZoneOffset = dt.getMethod("getTimeZoneOffset");
                let result = getTimeZoneOffset.call(interpreter);
                expect(getTimeZoneOffset).toBeTruthy();
                expect(result).toEqual(new Int32(new Date().getTimezoneOffset()));
            });
        });

        describe("getWeekday", () => {
            it("returns the date/time value's second within the minute", () => {
                let getWeekday = dt.getMethod("getWeekday");
                let result = getWeekday.call(interpreter);
                expect(getWeekday).toBeTruthy();
                expect(result).toEqual(new BrsString("Thursday"));
            });
        });

        describe("getYear", () => {
            it("returns the date/time value's year", () => {
                let getYear = dt.getMethod("getYear");
                let result = getYear.call(interpreter);
                expect(getYear).toBeTruthy();
                expect(result).toEqual(new Int32(2009));
            });
        });

        describe("toISOString", () => {
            it("return an ISO 8601 representation of the date/time value", () => {
                let toISOString = dt.getMethod("toISOString");
                let result = toISOString.call(interpreter);
                expect(toISOString).toBeTruthy();
                expect(result).toEqual(new BrsString("2009-01-01T00:00:00Z"));
            });
        });

        describe("toLocalTime", () => {
            it("offsets the date/time from UTC to local time using the system time zone setting", () => {
                let toLocalTime = dt.getMethod("toLocalTime");
                let result = toLocalTime.call(interpreter);
                expect(toLocalTime).toBeTruthy();
                expect(new Int32(dt.markTime)).toEqual(new Int32(1230742800123));
                expect(result).toBe(BrsInvalid.Instance);
            });
        });
    });
});
