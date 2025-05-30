const brs = require("../../../bin/brs.node");
const { Interpreter } = brs;
const { RoTimespan, Int32, BrsString, BrsInvalid } = brs.types;
const fakeTimer = require("@sinonjs/fake-timers");

describe("Timespan", () => {
    let ts;
    let clock;

    beforeEach(() => {
        clock = fakeTimer.install({ toFake: ["performance"] });
        ts = new RoTimespan();
    });

    afterEach(() => {
        clock.uninstall();
    });

    describe("stringification", () => {
        it("inits a new brs roTimespan", () => {
            expect(ts.toString()).toEqual("<Component: roTimespan>");
        });
    });

    describe("markTime", () => {
        it("inits a new timespan with the current time", () => {
            expect(ts.markTime).toEqual(clock.now);
        });
    });

    describe("methods", () => {
        let interpreter;

        beforeEach(() => {
            interpreter = new Interpreter();
        });

        describe("mark", () => {
            it("resets mark time to current time", () => {
                let mark = ts.getMethod("mark");
                clock.tick(10000);

                let result = mark.call(interpreter);
                expect(mark).toBeTruthy();
                expect(ts.markTime).toEqual(clock.now);
                expect(result).toBe(BrsInvalid.Instance);
            });
        });

        describe("totalMicroseconds", () => {
            it("returns microseconds from marked time until now", () => {
                let advanceTime = 50000;
                let totalMicroseconds = ts.getMethod("totalmicroseconds");

                clock.tick(advanceTime);

                let result = totalMicroseconds.call(interpreter);
                expect(totalMicroseconds).toBeTruthy();
                expect(result).toEqual(new Int32(advanceTime * 1000));
            });
        });

        describe("totalMilliseconds", () => {
            it("returns milliseconds from marked time until now", () => {
                let advanceTime = 50000;
                let totalMilliseconds = ts.getMethod("totalmilliseconds");

                clock.tick(advanceTime);

                let result = totalMilliseconds.call(interpreter);
                expect(totalMilliseconds).toBeTruthy();
                expect(result).toEqual(new Int32(advanceTime));
            });
        });

        describe("totalSeconds", () => {
            it("returns seconds from marked time until now", () => {
                let advanceTime = 50000;
                let totalSeconds = ts.getMethod("totalseconds");

                clock.tick(advanceTime);

                let result = totalSeconds.call(interpreter);
                expect(totalSeconds).toBeTruthy();
                expect(result).toEqual(new Int32(50));
            });
        });

        describe("getsecondstoiso8601date", () => {
            it("returns seconds from now until a valid ISO8601 date", () => {
                clock.uninstall();
                clock = fakeTimer.install({ now: 1547072370937, toFake: ["Date"] });
                let getsecondstoiso8601date = ts.getMethod("getsecondstoiso8601date");

                let dateToParse1 = "2030-11-10T05:47:52Z";
                let dateToParse2 = "1986-11-10T05:47:52Z";

                let result1 = getsecondstoiso8601date.call(interpreter, new BrsString(dateToParse1));
                let result2 = getsecondstoiso8601date.call(interpreter, new BrsString(dateToParse2));

                expect(getsecondstoiso8601date).toBeTruthy();
                expect(result1).toEqual(new Int32(373447701));
                expect(result2).toEqual(new Int32(-1015086699));
            });

            it("accepts other ISO8601 formats and returns correct seconds", () => {
                clock.uninstall();
                clock = fakeTimer.install({ now: 1547072370937, toFake: ["Date"] });
                let getsecondstoiso8601date = ts.getMethod("getsecondstoiso8601date");

                let dateToParse = "2020-05-25";

                let result = getsecondstoiso8601date.call(interpreter, new BrsString(dateToParse));
                expect(getsecondstoiso8601date).toBeTruthy();
                expect(result).toEqual(new Int32(43292429));
            });

            it("returns 2077252342 for strings that can't be parsed", () => {
                let getsecondstoiso8601date = ts.getMethod("getsecondstoiso8601date");

                let dateToParse1 = "not a date";
                let dateToParse2 = "14 Jun 2017 00:00:00 PDT";

                let result1 = getsecondstoiso8601date.call(interpreter, new BrsString(dateToParse1));
                let result2 = getsecondstoiso8601date.call(interpreter, new BrsString(dateToParse2));

                expect(getsecondstoiso8601date).toBeTruthy();
                expect(result1).toEqual(new Int32(2077252342));
                expect(result2).toEqual(new Int32(2077252342));
            });
        });
    });
});
