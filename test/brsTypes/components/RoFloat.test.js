const brs = require("brs");
const { RoFloat, Float, BrsBoolean, Callable } = brs.types;
const { Interpreter } = require("../../../lib/interpreter");

describe("RoFloat", () => {
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
        let a, b, interpreter, someNumberA, someNumberB;

        beforeEach(() => {
            someNumberA = (Math.random() * 4 + 7) * (Math.random() * 100 + 3);
            someNumberB = (Math.random() * 4 + 7) * (Math.random() * 100 + 3);
            a = new RoFloat(new Float(0));
            b = new RoFloat(new Float(0));
            interpreter = new Interpreter();
        });

        it("setFloat", () => {
            setFloatA = a.getMethod("setFloat");
            setFloatB = b.getMethod("setFloat");

            expect(setFloatA).toBeInstanceOf(Callable);
            expect(setFloatB).toBeInstanceOf(Callable);

            setFloatA.call(interpreter, new Float(someNumberA));
            setFloatB.call(interpreter, new Float(someNumberB));

            expect(a.equalTo(new RoFloat(new Float(someNumberA)))).toBe(BrsBoolean.True);
            expect(b.equalTo(new RoFloat(new Float(someNumberB)))).toBe(BrsBoolean.True);
        });
    });
});
