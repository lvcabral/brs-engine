const brs = require("brs");
const { roLongInteger, Int64, BrsBoolean, BrsString, Callable } = brs.types;
const { Interpreter } = require("../../../lib/interpreter");

describe("roLongInteger", () => {
    describe("equality", () => {
        it("compares to intrinsic Int64", () => {
            let a = new roLongInteger(new Int64(40000111222));
            let b = new roLongInteger(new Int64(0));
            let c = new roLongInteger(new Int64(-40000111222));
            let d = new roLongInteger(new Int64(40000111222));
            let e = new roLongInteger(new Int64(-5));

            expect(a.equalTo(b)).toBe(BrsBoolean.False);
            expect(a.equalTo(c)).toBe(BrsBoolean.False);
            expect(b.equalTo(c)).toBe(BrsBoolean.False);
            expect(a.equalTo(d)).toBe(BrsBoolean.True);
            expect(d.equalTo(a)).toBe(BrsBoolean.True);
            expect(a.equalTo(e)).toBe(BrsBoolean.False);
            expect(b.equalTo(e)).toBe(BrsBoolean.False);
        });
    });

    test("toString", () => {
        expect(new roLongInteger(new Int64(22)).toString()).toBe("22");
    });

    describe("ifLongInt, ifToStr", () => {
        var a = new roLongInteger(new Int64(0));
        var b = new roLongInteger(new Int64(0));
        let interpreter;
        let someNumberA = 305;
        let someNumberB = 291;

        beforeEach(() => {
            interpreter = new Interpreter();
        });

        it("setLongInt", () => {
            setLongIntA = a.getMethod("setLongInt");
            setLongIntB = b.getMethod("setLongInt");

            expect(setLongIntA).toBeInstanceOf(Callable);
            expect(setLongIntB).toBeInstanceOf(Callable);

            setLongIntA.call(interpreter, new Int64(someNumberA));
            setLongIntB.call(interpreter, new Int64(someNumberB));

            expect(a.equalTo(new roLongInteger(new Int64(someNumberA)))).toBe(BrsBoolean.True);
            expect(b.equalTo(new roLongInteger(new Int64(someNumberB)))).toBe(BrsBoolean.True);
        });

        it("getLongInt", () => {
            a = new roLongInteger(new Int64(someNumberA));
            b = new roLongInteger(new Int64(someNumberB));

            getLongIntA = a.getMethod("getLongInt");
            getLongIntB = b.getMethod("getLongInt");

            expect(getLongIntA).toBeInstanceOf(Callable);
            expect(getLongIntB).toBeInstanceOf(Callable);

            let resultA = getLongIntA.call(interpreter);
            let resultB = getLongIntB.call(interpreter);

            expect(resultA).toEqual(new Int64(someNumberA));
            expect(resultB).toEqual(new Int64(someNumberB));
        });

        it("toStr", () => {
            a = new roLongInteger(new Int64(someNumberA));
            b = new roLongInteger(new Int64(someNumberB));

            toStrA = a.getMethod("toStr");
            toStrB = b.getMethod("toStr");

            let resultA = toStrA.call(interpreter);
            let resultB = toStrB.call(interpreter);

            expect(resultA).toEqual(new BrsString(String(someNumberA)));
            expect(resultB).toEqual(new BrsString(String(someNumberB)));
        });
    });
});
