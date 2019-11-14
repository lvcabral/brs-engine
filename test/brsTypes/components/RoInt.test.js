const brs = require("brs");
const { roInt, Int32, BrsBoolean, BrsString, Callable } = brs.types;
const { Interpreter } = require("../../../lib/interpreter");

describe("roInt", () => {
    describe("equality", () => {
        it("compares to intrinsic Int32", () => {
            let a = new roInt(new Int32(10));
            let b = new roInt(new Int32(5));
            let c = new roInt(new Int32(123));
            let d = new roInt(new Int32(10));

            expect(a.equalTo(b)).toBe(BrsBoolean.False);
            expect(a.equalTo(c)).toBe(BrsBoolean.False);
            expect(b.equalTo(c)).toBe(BrsBoolean.False);
            expect(a.equalTo(d)).toBe(BrsBoolean.True);
            expect(d.equalTo(a)).toBe(BrsBoolean.True);
        });
    });

    test("toString", () => {
        expect(new roInt(new Int32(22)).toString()).toBe("22");
    });

    describe("ifInt, ifToStr", () => {
        var a = new roInt(new Int32(0));
        var b = new roInt(new Int32(0));
        let interpreter;
        let someNumberA = 305;
        let someNumberB = 291;

        beforeEach(() => {
            interpreter = new Interpreter();
        });

        it("setInt", () => {
            setIntA = a.getMethod("setInt");
            setIntB = b.getMethod("setInt");

            expect(setIntA).toBeInstanceOf(Callable);
            expect(setIntB).toBeInstanceOf(Callable);

            setIntA.call(interpreter, new Int32(someNumberA));
            setIntB.call(interpreter, new Int32(someNumberB));

            expect(a.equalTo(new roInt(new Int32(someNumberA)))).toBe(BrsBoolean.True);
            expect(b.equalTo(new roInt(new Int32(someNumberB)))).toBe(BrsBoolean.True);
        });

        it("getInt", () => {
            a = new roInt(new Int32(someNumberA));
            b = new roInt(new Int32(someNumberB));

            getIntA = a.getMethod("getInt");
            getIntB = b.getMethod("getInt");

            expect(getIntA).toBeInstanceOf(Callable);
            expect(getIntB).toBeInstanceOf(Callable);

            let resultA = getIntA.call(interpreter);
            let resultB = getIntB.call(interpreter);

            expect(resultA).toEqual(new Int32(someNumberA));
            expect(resultB).toEqual(new Int32(someNumberB));
        });

        it("toStr", () => {
            a = new roInt(new Int32(someNumberA));
            b = new roInt(new Int32(someNumberB));

            toStrA = a.getMethod("toStr");
            toStrB = b.getMethod("toStr");

            let resultA = toStrA.call(interpreter);
            let resultB = toStrB.call(interpreter);

            expect(resultA).toEqual(new BrsString(String(someNumberA)));
            expect(resultB).toEqual(new BrsString(String(someNumberB)));
        });
    });
});
