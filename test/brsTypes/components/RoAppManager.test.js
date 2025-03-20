const brs = require("../../../bin/brs.node");
const { Interpreter } = brs;
const {
    BrsBoolean,
    BrsString,
    RoTimespan,
    RoAppManager,
    RoArray,
    RoAssociativeArray,
    Int32,
    compareVersions,
} = brs.types;
const fakeTimer = require("@sinonjs/fake-timers");

describe("RoAppManager", () => {
    let interpreter;
    let clock;
    let ts;

    beforeEach(() => {
        clock = fakeTimer.install({ toFake: ["Date", "performance"] });
        ts = new RoTimespan();
        interpreter = new Interpreter();
        interpreter.manifest = new Map();
    });

    afterEach(() => {
        clock.uninstall();
    });

    describe("stringification", () => {
        it("lists stringified value", () => {
            let appManager = new RoAppManager();
            expect(appManager.toString()).toEqual(`<Component: roAppManager>`);
        });
    });

    describe("getUpTime", () => {
        it("returns the uptime", () => {
            let appManager = new RoAppManager();
            let getUpTime = appManager.getMethod("getUpTime");
            let totalMilliseconds = ts.getMethod("totalMilliseconds");
            let upTime = getUpTime.call(interpreter).getMethod("totalMilliseconds");
            expect(getUpTime).toBeTruthy();
            expect(totalMilliseconds).toBeTruthy();
            expect(upTime).toBeTruthy();
            expect(upTime.call(interpreter)).toEqual(totalMilliseconds.call(interpreter));
        });
    });

    describe("getScreensaverTimeout", () => {
        it("should return the screen saver timeout (0=disabled)", () => {
            let appManager = new RoAppManager();
            let method = appManager.getMethod("getScreensaverTimeout");

            expect(method).toBeTruthy();
            expect(method.call(interpreter)).toEqual(new Int32(0));
        });
    });

    describe("isAppInstalled", () => {
        it("returns false if passed channel id is not on deviceInfo.appList", () => {
            let appManager = new RoAppManager();
            let isAppInstalled = appManager.getMethod("isAppInstalled");

            expect(isAppInstalled).toBeTruthy();
            expect(
                isAppInstalled.call(interpreter, new BrsString("dev"), new BrsString(""))
            ).toEqual(BrsBoolean.False);
        });
    });

    describe("launchApp", () => {
        it("returns false if could not launch the app (not in appList)", () => {
            let appManager = new RoAppManager();
            let method = appManager.getMethod("launchApp");

            expect(method).toBeTruthy();
            expect(
                method.call(
                    interpreter,
                    new BrsString("dev"),
                    new BrsString(""),
                    new RoAssociativeArray([])
                )
            ).toEqual(BrsBoolean.False);
        });
    });

    describe("getAppList", () => {
        it("returns a list of apps", () => {
            let appManager = new RoAppManager();
            let getAppList = appManager.getMethod("getAppList");

            let list = getAppList.call(interpreter);
            expect(getAppList).toBeTruthy();
            expect(list).toBeTruthy();
            expect(list.elements).toEqual(new RoArray([]).elements);
        });
    });

    describe("getRunParams", () => {
        it("returns a list of parameters passed to the app", () => {
            let appManager = new RoAppManager();
            let getRunParams = appManager.getMethod("getRunParams");

            let params = getRunParams.call(interpreter);
            expect(getRunParams).toBeTruthy();
            expect(params).toBeTruthy();
            expect(params.elements).toEqual(new RoAssociativeArray([]).elements);
        });
    });

    describe("getLastExitInfo", () => {
        it("Returns an AA that includes an exit reason and other stats.", () => {
            let appManager = new RoAppManager();
            let getLastExitInfo = appManager.getMethod("getLastExitInfo");

            let exitInfo = getLastExitInfo.call(interpreter);
            expect(getLastExitInfo).toBeTruthy();
            expect(exitInfo).toBeTruthy();
            expect(exitInfo.elements.size).toEqual(4);
        });
    });
});

describe("compareVersions", () => {
    let appManager;

    beforeEach(() => {
        appManager = new RoAppManager();
    });

    test("should return 0 for equal versions", () => {
        expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
        expect(compareVersions("1.0.0", "1.0")).toBe(0);
        expect(compareVersions("1.0.0", "1")).toBe(0);
        expect(compareVersions("1", "1.0.0")).toBe(0);
        expect(compareVersions("1.0", "1.0.0")).toBe(0);
        expect(compareVersions("2.3.4", "0002.03.004")).toBe(0);
    });

    test("should return 1 when the first version is greater", () => {
        expect(compareVersions("1.0.1", "1.0.0")).toBe(1);
        expect(compareVersions("1.1.0", "1.0.0")).toBe(1);
        expect(compareVersions("2.0.0", "1.0.0")).toBe(1);
        expect(compareVersions("1.0.0", "0.9.9")).toBe(1);
        expect(compareVersions("02", "1.0.0")).toBe(1);
        expect(compareVersions("02.003", "2.2.9")).toBe(1);
    });

    test("should return -1 when the first version is lesser", () => {
        expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
        expect(compareVersions("1.0.0", "1.1.0")).toBe(-1);
        expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
        expect(compareVersions("0.9.9", "1.0.0")).toBe(-1);
        expect(compareVersions("1", "1.0.1")).toBe(-1);
        expect(compareVersions("1.0", "1.0.1")).toBe(-1);
    });

    test("should handle versions with different lengths", () => {
        expect(compareVersions("1.0", "1.0.0")).toBe(0);
        expect(compareVersions("1", "1.0.0")).toBe(0);
        expect(compareVersions("1.0.0", "1")).toBe(0);
        expect(compareVersions("1.0.0", "1.0")).toBe(0);
    });

    test("should handle empty strings", () => {
        expect(compareVersions("", "")).toBe(0);
        expect(compareVersions("1.0.0", "")).toBe(1);
        expect(compareVersions("", "0.0.0")).toBe(0);
        expect(compareVersions("", "1.0.0")).toBe(-1);
        expect(compareVersions("1..", "1.0.0")).toBe(0);
        expect(compareVersions("0", " . . ")).toBe(0);
        expect(compareVersions("2", ".1..")).toBe(1);
    });

    test("should handle alpha strings", () => {
        expect(compareVersions("1.0.0", "alpha")).toBe(-1);
        expect(compareVersions("alpha", "1.0.0")).toBe(-1);
        expect(compareVersions("alpha", "0.0.0")).toBe(0);
        expect(compareVersions("alpha", "beta")).toBe(-1);
        expect(compareVersions("beta", "0")).toBe(0);
    });

    test("should handle mixed numeric and alpha strings", () => {
        expect(compareVersions("1.0.0", "1.0.0-alpha")).toBe(-1);
        expect(compareVersions("1.0.1", "1.0.0-alpha")).toBe(-1);
        expect(compareVersions("1.1.0", "1.0.0-alpha")).toBe(1);
        expect(compareVersions("2.0.1", "1.0.0-alpha")).toBe(1);
        expect(compareVersions("1.0.0-alpha", "1.0.0")).toBe(0);
        expect(compareVersions("1.0.0-alpha", "1.0.0-beta")).toBe(-1);
    });
});
