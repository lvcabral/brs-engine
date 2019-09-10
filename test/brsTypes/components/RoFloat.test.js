const brs = require("brs");
const { roFloat, Float, BrsBoolean, BrsString, Callable } = brs.types;
const { Interpreter } = require("../../../lib/interpreter");

describe("roFloat", () => {
    describe("equality", () => {
        it("compares to intrinsic Float", () => {
            let a = new roFloat(new Float(10.0));
            let b = new roFloat(new Float(5.5));
            let c = new roFloat(new Float(123.99));
            let d = new roFloat(new Float(10.0));

            expect(a.equalTo(b)).toBe(BrsBoolean.False);
            expect(a.equalTo(c)).toBe(BrsBoolean.False);
            expect(b.equalTo(c)).toBe(BrsBoolean.False);
            expect(a.equalTo(d)).toBe(BrsBoolean.True);
            expect(d.equalTo(a)).toBe(BrsBoolean.True);
        });
    });

    test("toString", () => {
        expect(new roFloat(new Float(22.456)).toString()).toBe("22.456");
    });

    describe("ifFloat, ifToStr", () => {
        let a, b, interpreter, someNumberA, someNumberB;

        beforeEach(() => {
            someNumberA = (Math.random() * 4 + 7) * (Math.random() * 100 + 3);
            someNumberB = (Math.random() * 4 + 7) * (Math.random() * 100 + 3);
            a = new roFloat(new Float(0));
            b = new roFloat(new Float(0));
            interpreter = new Interpreter();
        });

        it("setFloat", () => {
            setFloatA = a.getMethod("setFloat");
            setFloatB = b.getMethod("setFloat");

            expect(setFloatA).toBeInstanceOf(Callable);
            expect(setFloatB).toBeInstanceOf(Callable);

            setFloatA.call(interpreter, new Float(someNumberA));
            setFloatB.call(interpreter, new Float(someNumberB));

            expect(a.equalTo(new roFloat(new Float(someNumberA)))).toBe(BrsBoolean.True);
            expect(b.equalTo(new roFloat(new Float(someNumberB)))).toBe(BrsBoolean.True);
        });

        it("getFloat", () => {
            a = new roFloat(new Float(someNumberA));
            b = new roFloat(new Float(someNumberB));

            getFloatA = a.getMethod("getFloat");
            getFloatB = b.getMethod("getFloat");

            expect(getFloatA).toBeInstanceOf(Callable);
            expect(getFloatB).toBeInstanceOf(Callable);

            let resultA = getFloatA.call(interpreter);
            let resultB = getFloatB.call(interpreter);

            expect(resultA).toEqual(new Float(someNumberA));
            expect(resultB).toEqual(new Float(someNumberB));
        });

        it("toStr", () => {
            a = new roFloat(new Float(someNumberA));
            b = new roFloat(new Float(someNumberB));

            toStrA = a.getMethod("toStr");
            toStrB = b.getMethod("toStr");

            let expectedA = parseFloat(Math.fround(someNumberA).toPrecision(7));
            let expectedB = parseFloat(Math.fround(someNumberB).toPrecision(7));

            let resultA = toStrA.call(interpreter);
            let resultB = toStrB.call(interpreter);

            expect(resultA).toEqual(new BrsString(String(expectedA)));
            expect(resultB).toEqual(new BrsString(String(expectedB)));
        });
    });
});
