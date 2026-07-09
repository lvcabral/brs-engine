const brs = require("../../../packages/node/bin/brs.node");
const { Interpreter } = brs;
const { RoUtils, Int32, Float, Double, Int64, BrsString, RoInt, RoFloat, BrsBoolean, BrsInvalid } = brs.types;

describe("RoUtils", () => {
    let utils;
    let interpreter;

    beforeEach(() => {
        utils = new RoUtils();
        interpreter = new Interpreter();
    });

    describe("stringification", () => {
        it("inits a new roUtils component", () => {
            expect(utils.toString()).toEqual("<Component: roUtils>");
        });
    });

    describe("isNumber", () => {
        let isNumber;
        beforeEach(() => {
            isNumber = utils.getMethod("isNumber");
        });

        it("returns true for unboxed numbers", () => {
            expect(isNumber.call(interpreter, new Int32(42))).toBe(BrsBoolean.True);
            expect(isNumber.call(interpreter, new Float(3.14))).toBe(BrsBoolean.True);
            expect(isNumber.call(interpreter, new Double(3.14))).toBe(BrsBoolean.True);
            expect(isNumber.call(interpreter, new Int64(42))).toBe(BrsBoolean.True);
        });

        it("returns true for boxed numbers", () => {
            expect(isNumber.call(interpreter, new RoInt(new Int32(42)))).toBe(BrsBoolean.True);
            expect(isNumber.call(interpreter, new RoFloat(new Float(3.14)))).toBe(BrsBoolean.True);
        });

        it("returns false for non-numbers", () => {
            expect(isNumber.call(interpreter, new BrsString("foo"))).toBe(BrsBoolean.False);
            expect(isNumber.call(interpreter, BrsInvalid.Instance)).toBe(BrsBoolean.False);
        });
    });

    describe("isString", () => {
        let isString;
        beforeEach(() => {
            isString = utils.getMethod("isString");
        });

        it("returns true for unboxed and boxed strings", () => {
            const str = new BrsString("foo");
            expect(isString.call(interpreter, str)).toBe(BrsBoolean.True);
            expect(isString.call(interpreter, str.box())).toBe(BrsBoolean.True);
        });

        it("returns false for non-strings", () => {
            expect(isString.call(interpreter, new Int32(42))).toBe(BrsBoolean.False);
            expect(isString.call(interpreter, BrsInvalid.Instance)).toBe(BrsBoolean.False);
        });
    });

    describe("isFloatingPoint", () => {
        let isFloatingPoint;
        beforeEach(() => {
            isFloatingPoint = utils.getMethod("isFloatingPoint");
        });

        it("returns true for Float and Double, boxed or unboxed", () => {
            expect(isFloatingPoint.call(interpreter, new Float(3.14))).toBe(BrsBoolean.True);
            expect(isFloatingPoint.call(interpreter, new Double(3.14))).toBe(BrsBoolean.True);
            expect(isFloatingPoint.call(interpreter, new RoFloat(new Float(3.14)))).toBe(BrsBoolean.True);
        });

        it("returns false for integers and non-numbers", () => {
            expect(isFloatingPoint.call(interpreter, new Int32(42))).toBe(BrsBoolean.False);
            expect(isFloatingPoint.call(interpreter, new Int64(42))).toBe(BrsBoolean.False);
            expect(isFloatingPoint.call(interpreter, new BrsString("foo"))).toBe(BrsBoolean.False);
            expect(isFloatingPoint.call(interpreter, BrsInvalid.Instance)).toBe(BrsBoolean.False);
        });
    });
});
