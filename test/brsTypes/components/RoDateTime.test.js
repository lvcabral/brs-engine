const brs = require("../../../bin/brs.node");
const { Interpreter } = brs;
const { RoDateTime, Int32, Int64, BrsString, BrsInvalid, Uninitialized } = brs.types;
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
            it("resets mark time to current time", async () => {
                let mark = dt.getMethod("mark");
                clock.tick(10000);

                let result = await mark.call(interpreter);
                expect(mark).toBeTruthy();
                expect(dt.markTime).toEqual(clock.now);
                expect(result).toBe(Uninitialized.Instance);
            });
        });

        describe("asDateString", () => {
            it("returns date string with empty param", async () => {
                let asDateString = dt.getMethod("asDateString");

                let result = await asDateString.call(interpreter, new BrsString(""));
                expect(asDateString).toBeTruthy();
                expect(result).toEqual(new BrsString("Thursday January 1, 2009"));
            });

            it("returns date string with invalid param", async () => {
                let asDateString = dt.getMethod("asDateString");

                let result = await asDateString.call(interpreter, new BrsString("anything"));
                expect(asDateString).toBeTruthy();
                expect(result).toEqual(new BrsString("Thursday January 1, 2009"));
            });

            it("returns date string with param: full-date", async () => {
                let asDateString = dt.getMethod("asDateString");

                let result = await asDateString.call(interpreter, new BrsString("full-date"));
                expect(asDateString).toBeTruthy();
                expect(result).toEqual(new BrsString("Thursday January 1, 2009"));
            });

            it("returns date string with param: short-weekday", async () => {
                let asDateString = dt.getMethod("asDateString");

                let result = await asDateString.call(interpreter, new BrsString("short-weekday"));
                expect(asDateString).toBeTruthy();
                expect(result).toEqual(new BrsString("Thu January 1, 2009"));
            });

            it("returns date string with param: no-weekday", async () => {
                let asDateString = dt.getMethod("asDateString");

                let result = await asDateString.call(interpreter, new BrsString("no-weekday"));
                expect(asDateString).toBeTruthy();
                expect(result).toEqual(new BrsString("January 1, 2009"));
            });

            it("returns date string with param: short-month-short-weekday", async () => {
                let asDateString = dt.getMethod("asDateString");

                let result = await asDateString.call(
                    interpreter,
                    new BrsString("short-month-short-weekday")
                );
                expect(asDateString).toBeTruthy();
                expect(result).toEqual(new BrsString("Thu Jan 1, 2009"));
            });

            it("returns date string with param: short-month-no-weekday", async () => {
                let asDateString = dt.getMethod("asDateString");

                let result = await asDateString.call(
                    interpreter,
                    new BrsString("short-month-no-weekday")
                );
                expect(asDateString).toBeTruthy();
                expect(result).toEqual(new BrsString("Jan 1, 2009"));
            });

            it("returns date string with param: short-date", async () => {
                let asDateString = dt.getMethod("asDateString");

                let result = await asDateString.call(interpreter, new BrsString("short-date"));
                expect(asDateString).toBeTruthy();
                expect(result).toEqual(new BrsString("1/1/9"));
            });

            it("returns date string with param: short-date-dashes", async () => {
                let asDateString = dt.getMethod("asDateString");

                let result = await asDateString.call(
                    interpreter,
                    new BrsString("short-date-dashes")
                );
                expect(asDateString).toBeTruthy();
                expect(result).toEqual(new BrsString("1-1-9"));
            });
        });

        describe("asDateStringNoParam", () => {
            it("returns date string with empty param", async () => {
                let asDateStringNoParam = dt.getMethod("asDateStringNoParam");

                let result = await asDateStringNoParam.call(interpreter);
                expect(asDateStringNoParam).toBeTruthy();
                expect(result).toEqual(new BrsString("Thursday January 1, 2009"));
            });
        });

        describe("asDateStringLoc", () => {
            it("returns date string localized in 'short' format", async () => {
                let asDateStringLoc = dt.getMethod("asDateStringLoc");

                let result = await asDateStringLoc.call(interpreter, new BrsString("short"));
                expect(asDateStringLoc).toBeTruthy();
                expect(result).toEqual(new BrsString("1/1/09"));
            });
        });

        describe("asTimeStringLoc", () => {
            it("returns time string localized in 'short' format", async () => {
                let asTimeStringLoc = dt.getMethod("asTimeStringLoc");

                let result = await asTimeStringLoc.call(interpreter, new BrsString("short"));
                expect(asTimeStringLoc).toBeTruthy();
                expect(result).toEqual(new BrsString("12:00 am"));
            });
        });

        describe("asSeconds", () => {
            it("returns the date/time as the number of seconds from the Unix epoch", async () => {
                let asSeconds = dt.getMethod("asSeconds");
                let result = await asSeconds.call(interpreter);
                expect(asSeconds).toBeTruthy();
                expect(result).toEqual(new Int32(1230768000));
            });
        });

        describe("asSecondsLong", () => {
            it("returns the date/time as the number of seconds from the Unix epoch as Long Integer", async () => {
                let asSeconds = dt.getMethod("asSecondsLong");
                let result = await asSeconds.call(interpreter);
                expect(asSeconds).toBeTruthy();
                expect(result).toEqual(new Int64(1230768000));
            });
        });

        describe("fromISO8601String", () => {
            it("set the date/time using a string in the ISO 8601 format", async () => {
                let fromISO8601String = dt.getMethod("fromISO8601String");
                expect(fromISO8601String).toBeTruthy();
                let result = await fromISO8601String.call(
                    interpreter,
                    new BrsString("2019-07-27T17:08:41")
                );
                expect(new Int32(dt.markTime)).toEqual(new Int32(1564247321000));
                expect(result).toBe(Uninitialized.Instance);
            });

            it("set the date/time using an invalid string", async () => {
                let fromISO8601String = dt.getMethod("fromISO8601String");
                expect(fromISO8601String).toBeTruthy();
                let result = await fromISO8601String.call(interpreter, new BrsString("garbage"));
                expect(new Int32(dt.markTime)).toEqual(new Int32(0));
                expect(result).toBe(Uninitialized.Instance);
            });
        });

        describe("fromSeconds", () => {
            it("set the date/time value using the number of seconds from the Unix epoch", async () => {
                let fromSeconds = dt.getMethod("fromSeconds");
                expect(fromSeconds).toBeTruthy();
                let result = await fromSeconds.call(interpreter, new Int32(1564247321));
                expect(new Int32(dt.markTime)).toEqual(new Int32(1564247321000));
                expect(result).toBe(Uninitialized.Instance);
            });
        });

        describe("fromSecondsLong", () => {
            it("set the date/time value using the number of seconds from the Unix epoch as Long Integer", async () => {
                let fromSeconds = dt.getMethod("fromSecondsLong");
                expect(fromSeconds).toBeTruthy();
                let result = await fromSeconds.call(interpreter, new Int64(2550877200));
                expect(new Int32(dt.markTime)).toEqual(new Int32(1564247321000));
                expect(result).toBe(BrsInvalid.Instance);
            });
        });

        describe("getDayOfMonth", () => {
            it("returns the date/time value's day of the month", async () => {
                let getDayOfMonth = dt.getMethod("getDayOfMonth");
                let result = await getDayOfMonth.call(interpreter);
                expect(getDayOfMonth).toBeTruthy();
                expect(result).toEqual(new Int32(1));
            });
        });

        describe("getDayOfWeek", () => {
            it("returns the date/time value's day of the week", async () => {
                let getDayOfWeek = dt.getMethod("getDayOfWeek");
                let result = await getDayOfWeek.call(interpreter);
                expect(getDayOfWeek).toBeTruthy();
                expect(result).toEqual(new Int32(4));
            });
        });

        describe("getHours", () => {
            it("returns the date/time value's hour within the day", async () => {
                let getHours = dt.getMethod("getHours");
                let result = await getHours.call(interpreter);
                expect(getHours).toBeTruthy();
                expect(result).toEqual(new Int32(0));
            });
        });

        describe("getLastDayOfMonth", () => {
            it("returns the date/time value's last day of the month", async () => {
                let getLastDayOfMonth = dt.getMethod("getLastDayOfMonth");
                let result = await getLastDayOfMonth.call(interpreter);
                expect(getLastDayOfMonth).toBeTruthy();
                expect(result).toEqual(new Int32(31));
            });
        });

        describe("getMilliseconds", () => {
            it("returns the date/time value's millisecond within the second", async () => {
                let getMilliseconds = dt.getMethod("getMilliseconds");
                let result = await getMilliseconds.call(interpreter);
                expect(getMilliseconds).toBeTruthy();
                expect(result).toEqual(new Int32(123));
            });
        });

        describe("getMinutes", () => {
            it("returns the date/time value's minute within the hour", async () => {
                let getMinutes = dt.getMethod("getMinutes");
                let result = await getMinutes.call(interpreter);
                expect(getMinutes).toBeTruthy();
                expect(result).toEqual(new Int32(0));
            });
        });

        describe("getMonth", () => {
            it("returns the date/time value's month", async () => {
                let getMonth = dt.getMethod("getMonth");
                let result = await getMonth.call(interpreter);
                expect(getMonth).toBeTruthy();
                expect(result).toEqual(new Int32(1));
            });
        });

        describe("getSeconds", () => {
            it("returns the date/time value's second within the minute", async () => {
                let getSeconds = dt.getMethod("getSeconds");
                let result = await getSeconds.call(interpreter);
                expect(getSeconds).toBeTruthy();
                expect(result).toEqual(new Int32(0));
            });
        });

        describe("getTimeZoneOffset", () => {
            it("returns the offset in minutes from the system time zone to UTC", async () => {
                let getTimeZoneOffset = dt.getMethod("getTimeZoneOffset");
                let result = await getTimeZoneOffset.call(interpreter);
                expect(getTimeZoneOffset).toBeTruthy();
                expect(result).toEqual(new Int32(new Date().getTimezoneOffset()));
            });
        });

        describe("getWeekday", () => {
            it("returns the date/time value's second within the minute", async () => {
                let getWeekday = dt.getMethod("getWeekday");
                let result = await getWeekday.call(interpreter);
                expect(getWeekday).toBeTruthy();
                expect(result).toEqual(new BrsString("Thursday"));
            });
        });

        describe("getYear", () => {
            it("returns the date/time value's year", async () => {
                let getYear = dt.getMethod("getYear");
                let result = await getYear.call(interpreter);
                expect(getYear).toBeTruthy();
                expect(result).toEqual(new Int32(2009));
            });
        });

        describe("toISOString", () => {
            it("return an ISO 8601 representation of the date/time value", async () => {
                let toISOString = dt.getMethod("toISOString");
                let result = await toISOString.call(interpreter);
                expect(toISOString).toBeTruthy();
                expect(result).toEqual(new BrsString("2009-01-01T00:00:00Z"));
            });
        });

        describe("toLocalTime", () => {
            it("offsets the date/time from UTC to local time using the system time zone setting", async () => {
                let toLocalTime = dt.getMethod("toLocalTime");
                let result = await toLocalTime.call(interpreter);
                let local = 1230768000123 - new Date(1230768000123).getTimezoneOffset() * 60 * 1000;
                expect(toLocalTime).toBeTruthy();
                expect(new Int32(dt.markTime)).toEqual(new Int32(local));
                expect(result).toBe(Uninitialized.Instance);
            });
        });
    });
});
