const brs = require("../../../bin/brs.node");
const { Interpreter } = brs;
const { RoFloat, Float, BrsBoolean, BrsString, Callable } = brs.types;

describe("roFloat", () => {
    describe("equality", () => {
        it("compares to intrinsic Float", () => {
            let a = new RoFloat(new Float(10.0));
            let b = new RoFloat(new Float(5.5));
            let c = new RoFloat(new Float(123.99));
            let d = new RoFloat(new Float(10.0));

            expect(a.equalTo(b)).toBe(BrsBoolean.False);
            expect(a.equalTo(c)).toBe(BrsBoolean.False);
            expect(b.equalTo(c)).toBe(BrsBoolean.False);
            expect(a.equalTo(d)).toBe(BrsBoolean.True);
            expect(d.equalTo(a)).toBe(BrsBoolean.True);
        });
    });

    test("toString", () => {
        expect(new RoFloat(new Float(22.456)).toString()).toBe("22.456");
    });

    describe("ifFloat, ifToStr", () => {
        let interpreter;
        let someNumberA = 66.40265980865333;
        let someNumberB = 725.4835421658863;
        var a = new RoFloat(new Float(0));
        var b = new RoFloat(new Float(0));

        beforeEach(() => {
            interpreter = new Interpreter();
        });

        it("setFloat", async () => {
            setFloatA = a.getMethod("setFloat");
            setFloatB = b.getMethod("setFloat");

            expect(setFloatA).toBeInstanceOf(Callable);
            expect(setFloatB).toBeInstanceOf(Callable);

            await setFloatA.call(interpreter, new Float(someNumberA));
            await setFloatB.call(interpreter, new Float(someNumberB));

            expect(a.equalTo(new RoFloat(new Float(someNumberA)))).toBe(BrsBoolean.True);
            expect(b.equalTo(new RoFloat(new Float(someNumberB)))).toBe(BrsBoolean.True);
        });

        it("getFloat", async () => {
            a = new RoFloat(new Float(someNumberA));
            b = new RoFloat(new Float(someNumberB));

            getFloatA = a.getMethod("getFloat");
            getFloatB = b.getMethod("getFloat");

            expect(getFloatA).toBeInstanceOf(Callable);
            expect(getFloatB).toBeInstanceOf(Callable);

            let resultA = await getFloatA.call(interpreter);
            let resultB = await getFloatB.call(interpreter);

            expect(resultA).toEqual(new Float(someNumberA));
            expect(resultB).toEqual(new Float(someNumberB));
        });

        it("toStr", async () => {
            a = new RoFloat(new Float(someNumberA));
            b = new RoFloat(new Float(someNumberB));

            toStrA = a.getMethod("toStr");
            toStrB = b.getMethod("toStr");

            let expectedA = parseFloat(Math.fround(someNumberA).toPrecision(6));
            let expectedB = parseFloat(Math.fround(someNumberB).toPrecision(6));

            let resultA = await toStrA.call(interpreter);
            let resultB = await toStrB.call(interpreter);

            expect(resultA).toEqual(new BrsString(String(expectedA)));
            expect(resultB).toEqual(new BrsString(String(expectedB)));
        });
    });
});
