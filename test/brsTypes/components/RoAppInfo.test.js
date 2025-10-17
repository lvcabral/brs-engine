const brs = require("../../../packages/node/bin/brs.node");
const { Interpreter } = brs;
const { BrsBoolean, BrsString, RoAppInfo } = brs.types;

describe("RoAppInfo", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter();
        interpreter.manifest = new Map();
    });

    describe("stringification", () => {
        it("lists stringified value", () => {
            let appInfo = new RoAppInfo();
            expect(appInfo.toString()).toEqual(`<Component: roAppInfo>`);
        });
    });

    describe("getID", () => {
        it("returns default value for sideloaded app", () => {
            let appInfo = new RoAppInfo();
            let getID = appInfo.getMethod("getID");

            expect(getID).toBeTruthy();
            expect(getID.call(interpreter)).toEqual(new BrsString("dev"));
        });
    });

    describe("isDev", () => {
        it("returns true for sideloaded app", () => {
            let appInfo = new RoAppInfo();
            let isDev = appInfo.getMethod("isDev");

            expect(isDev).toBeTruthy();
            expect(isDev.call(interpreter)).toEqual(BrsBoolean.True);
        });
    });

    describe("getVersion", () => {
        it("returns version based on data in the manifest file", () => {
            interpreter.manifest = new Map([
                ["major_version", "4"],
                ["minor_version", "3"],
                ["build_version", "0"],
            ]);
            let appInfo = new RoAppInfo();
            let getVersion = appInfo.getMethod("getVersion");

            expect(getVersion).toBeTruthy();
            expect(getVersion.call(interpreter)).toEqual(new BrsString("4.3.0"));
        });

        it("returns zeros if sub versions aren't defined", () => {
            let appInfo = new RoAppInfo();
            let getVersion = appInfo.getMethod("getVersion");

            expect(getVersion).toBeTruthy();
            expect(getVersion.call(interpreter)).toEqual(new BrsString("0.0.0"));
        });
    });

    describe("getTitle", () => {
        it("returns title based on data in the manifest file", () => {
            interpreter.manifest = new Map([["title", "Some title"]]);
            let appInfo = new RoAppInfo();
            let getTitle = appInfo.getMethod("getTitle");

            expect(getTitle).toBeTruthy();
            expect(getTitle.call(interpreter)).toEqual(new BrsString("Some title"));
        });

        it("returns 'No Title' string if title isn't defined", () => {
            let appInfo = new RoAppInfo();
            let getTitle = appInfo.getMethod("getTitle");

            expect(getTitle).toBeTruthy();
            expect(getTitle.call(interpreter)).toEqual(new BrsString(""));
        });
    });

    describe("getSubtitle", () => {
        it("returns subtitle based on data in the manifest file", () => {
            interpreter.manifest = new Map([["subtitle", "Some message"]]);
            let appInfo = new RoAppInfo();
            let getSubtitle = appInfo.getMethod("getSubtitle");

            expect(getSubtitle).toBeTruthy();
            expect(getSubtitle.call(interpreter)).toEqual(new BrsString("Some message"));
        });

        it("returns an empty string if subtitle isn't defined", () => {
            let appInfo = new RoAppInfo();
            let getSubtitle = appInfo.getMethod("getSubtitle");

            expect(getSubtitle).toBeTruthy();
            expect(getSubtitle.call(interpreter)).toEqual(new BrsString(""));
        });
    });

    describe("getDevID", () => {
        it("returns default value for sideloaded app", () => {
            let appInfo = new RoAppInfo();
            let getDevID = appInfo.getMethod("getDevID");

            expect(getDevID).toBeTruthy();
            expect(getDevID.call(interpreter)).toEqual(new BrsString("34c6fceca75e456f25e7e99531e2425c6c1de443"));
        });
    });

    describe("getValue", () => {
        it("returns value based on data in the manifest file", () => {
            interpreter.manifest = new Map([["some_field", "Some text"]]);
            let appInfo = new RoAppInfo();
            let getValue = appInfo.getMethod("getValue");

            expect(getValue).toBeTruthy();
            expect(getValue.call(interpreter, new BrsString("some_field"))).toEqual(new BrsString("Some text"));
        });

        it("returns an empty string if field isn't defined", () => {
            let appInfo = new RoAppInfo();
            let getValue = appInfo.getMethod("getValue");

            expect(getValue).toBeTruthy();
            expect(getValue.call(interpreter, new BrsString("nonexistentfield"))).toEqual(new BrsString(""));
        });
    });
});
