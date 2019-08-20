const brs = require("brs");
const { RoDouble, Double, BrsBoolean, BrsString, Callable } = brs.types;
const { Interpreter } = require("../../../lib/interpreter");

describe("RoDouble", () => {
    describe("equality", () => {
        it("compares to intrinsic Double", () => {
            let a = new RoDouble(new Double(10.0));
            let b = new RoDouble(new Double(5.5));
            let c = new RoDouble(new Double(123.99));
            let d = new RoDouble(new Double(10.0));

            expect(a.equalTo(b)).toBe(BrsBoolean.False);
            expect(a.equalTo(c)).toBe(BrsBoolean.False);
            expect(b.equalTo(c)).toBe(BrsBoolean.False);
            expect(a.equalTo(d)).toBe(BrsBoolean.True);
            expect(d.equalTo(a)).toBe(BrsBoolean.True);
        });
    });

    test("toString", () => {
        expect(new RoDouble(new Double(22.456)).toString()).toBe("22.456");
    });

    describe("ifDouble, ifToStr", () => {
        let a, b, interpreter, someNumberA, someNumberB;

        beforeEach(() => {
            someNumberA = (Math.random() * 4 + 7) * (Math.random() * 100 + 3);
            someNumberB = (Math.random() * 4 + 7) * (Math.random() * 100 + 3);
            a = new RoDouble(new Double(0));
            b = new RoDouble(new Double(0));
            interpreter = new Interpreter();
        });

        it("setDouble", () => {
            setDoubleA = a.getMethod("setDouble");
            setDoubleB = b.getMethod("setDouble");

            expect(setDoubleA).toBeInstanceOf(Callable);
            expect(setDoubleB).toBeInstanceOf(Callable);

            setDoubleA.call(interpreter, new Double(someNumberA));
            setDoubleB.call(interpreter, new Double(someNumberB));

            expect(a.equalTo(new RoDouble(new Double(someNumberA)))).toBe(BrsBoolean.True);
            expect(b.equalTo(new RoDouble(new Double(someNumberB)))).toBe(BrsBoolean.True);
        });

        it("getDouble", () => {
            a = new RoDouble(new Double(someNumberA));
            b = new RoDouble(new Double(someNumberB));

            getDoubleA = a.getMethod("getDouble");
            getDoubleB = b.getMethod("getDouble");

            expect(getDoubleA).toBeInstanceOf(Callable);
            expect(getDoubleB).toBeInstanceOf(Callable);

            let resultA = getDoubleA.call(interpreter);
            let resultB = getDoubleB.call(interpreter);

            expect(resultA).toEqual(new Double(someNumberA));
            expect(resultB).toEqual(new Double(someNumberB));
        });

        it("toStr", () => {
            a = new RoDouble(new Double(someNumberA));
            b = new RoDouble(new Double(someNumberB));

            toStrA = a.getMethod("toStr");
            toStrB = b.getMethod("toStr");

            let expectedA = parseFloat(Math.fround(someNumberA).toPrecision(7));
            let expectedB = parseFloat(Math.fround(someNumberB).toPrecision(7));

            let resultA = toStrA.call(interpreter);
            let resultB = toStrB.call(interpreter);

            expect(resultA).toEqual(new BrsString(String(someNumberA)));
            expect(resultB).toEqual(new BrsString(String(someNumberB)));
        });
    });
});
