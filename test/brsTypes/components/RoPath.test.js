const brs = require("../../../lib");
const { RoPath, BrsBoolean, BrsString, Callable } = brs.types;
const { Interpreter } = require("../../../lib/interpreter");

describe("RoPath", () => {
    describe("comparisons", () => {
        it("is comparable to a string", () => {
            let str = new BrsString("pkg:/images/splash.png");
            let path = new RoPath(str);
            expect(path.equalTo(str)).toBe(BrsBoolean.True);
        });
        it("is comparable to another roPath", () => {
            let str1 = new BrsString("pkg:/images/splash.png");
            let str2 = new BrsString("pkg:/images/poster.png");
            let path1 = new RoPath(str1);
            let path2 = new RoPath(str2);
            expect(path1.equalTo(path2)).toBe(BrsBoolean.False);
        });
    });

    describe("stringification", () => {
        let interpreter;

        beforeEach(() => {
            interpreter = new Interpreter();
        });

        it("return full path as string", () => {
            let str = "pkg:/images/splash.png";
            let path = new RoPath(new BrsString(str));
            expect(path.toString()).toEqual(str);
        });

        it("lists all values after split()", () => {
            let str = new BrsString("pkg:/images/splash.png");
            let path = new RoPath(str);
            let split = path.getMethod("split");
            expect(split).toBeInstanceOf(Callable);
            let aa = split.call(interpreter);
            expect(aa.toString()).toEqual(
                `<Component: roAssociativeArray> =
{
    basename: "splash"
    extension: ".png"
    filename: "splash.png"
    parent: "pkg:/images/"
    phy: "pkg:"
}`
            );
        });
    });
    describe("ifPath", () => {
        let interpreter;

        beforeEach(() => {
            interpreter = new Interpreter();
        });

        describe("change", () => {
            let path, change;

            beforeEach(() => {
                path = new RoPath(new BrsString("pkg:/images/splash.png"));
                change = path.getMethod("change");
                expect(change).toBeInstanceOf(Callable);
            });

            it("overwrites string value previously set", () => {
                expect(change.call(interpreter, new BrsString("pkg:/manifest"))).toEqual(
                    BrsBoolean.True
                );
                expect(path.toString()).toEqual("pkg:/manifest");
            });
            it("set invalid path make it empty", () => {
                expect(change.call(interpreter, new BrsString(";**;"))).toEqual(BrsBoolean.False);
                expect(path.toString()).toEqual("");
            });
        });

        describe("isValid", () => {
            it("returns true for valid path", () => {
                let path = new RoPath(new BrsString("pkg:/images/splash.png"));
                let isValid = path.getMethod("isValid");
                expect(isValid).toBeInstanceOf(Callable);
                expect(isValid.call(interpreter)).toEqual(BrsBoolean.True);
            });
            it("returns false for invalid path", () => {
                let path = new RoPath(new BrsString(""));
                let isValid = path.getMethod("isValid");
                expect(isValid).toBeInstanceOf(Callable);
                expect(isValid.call(interpreter)).toEqual(BrsBoolean.False);
            });
        });

        describe("split", () => {
            it("returns populated AA for valid path", () => {
                let path = new RoPath(new BrsString("pkg:/images/splash.png"));
                let split = path.getMethod("split");
                expect(split).toBeInstanceOf(Callable);
                expect(split.call(interpreter).elements.size).toEqual(5);
            });
            it("returns empty AA for invalid path", () => {
                let path = new RoPath(new BrsString("<invalid>"));
                let split = path.getMethod("split");
                expect(split).toBeInstanceOf(Callable);
                expect(split.call(interpreter).elements.size).toEqual(0);
            });
        });
    });

    describe("ifString", () => {
        let interpreter;

        beforeEach(() => {
            interpreter = new Interpreter();
        });

        describe("setString", () => {
            let path, setString;

            beforeEach(() => {
                path = new RoPath(new BrsString("pkg:/images/splash.png"));
                setString = path.getMethod("setString");
                expect(setString).toBeInstanceOf(Callable);
            });

            it("sets a string into the object", () => {
                setString.call(interpreter, new BrsString("pkg:/images/splash.png"));
                expect(path.toString()).toEqual("pkg:/images/splash.png");
            });

            it("overwrites string value previously set", () => {
                setString.call(interpreter, new BrsString("pkg:/images/splash.png"));
                setString.call(interpreter, new BrsString("pkg:/images/poster.png"));
                expect(path.toString()).toEqual("pkg:/images/poster.png");
            });
            it("set invalid path make it empty", () => {
                setString.call(interpreter, new BrsString("sdjhj%^"));
                expect(path.toString()).toEqual("");
            });
        });

        test("getString", () => {
            let path = new RoPath(new BrsString("pkg:/images/splash.png"));
            let getString = path.getMethod("getString");
            expect(getString).toBeInstanceOf(Callable);
            expect(getString.call(interpreter)).toEqual(new BrsString("pkg:/images/splash.png"));
        });
    });
});
