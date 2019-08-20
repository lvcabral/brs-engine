const brs = require("brs");
const { RoBoolean, BrsString, BrsBoolean, Callable } = brs.types;
const { Interpreter } = require("../../../lib/interpreter");

describe("RoBoolean", () => {
    describe("equality", () => {
        it("compares to intrinsic BrsBoolean", () => {
            let a = new RoBoolean(new BrsBoolean(true));
            let b = new RoBoolean(new BrsBoolean(false));
            let c = new RoBoolean(new BrsBoolean(true));

            expect(a.equalTo(b)).toBe(BrsBoolean.False);
            expect(a.equalTo(c)).toBe(BrsBoolean.True);
        });
    });

    test("toString", () => {
        expect(new RoBoolean(new BrsBoolean(true)).toString()).toBe("true");
    });

    describe("ifBoolean", () => {
        describe("setBoolean and getBoolean", () => {
            let a, b, interpreter;

            beforeEach(() => {
                a = new RoBoolean(new BrsBoolean(true));
                b = new RoBoolean(new BrsBoolean(false));
                interpreter = new Interpreter();
            });

            it("overwrites its stored value", () => {
                setBooleanA = a.getMethod("setBoolean");
                setBooleanB = b.getMethod("setBoolean");
                expect(setBooleanA).toBeInstanceOf(Callable);
                expect(setBooleanB).toBeInstanceOf(Callable);

                setBooleanA.call(interpreter, new BrsBoolean(false));
                setBooleanB.call(interpreter, new BrsBoolean(true));

                expect(a.intrinsic).toEqual(new BrsBoolean(false));
                expect(b.intrinsic).toEqual(new BrsBoolean(true));
            });

            it("retrieve intrinsic value", () => {
                getBooleanA = a.getMethod("getBoolean");
                getBooleanB = b.getMethod("getBoolean");
                expect(getBooleanA).toBeInstanceOf(Callable);
                expect(getBooleanB).toBeInstanceOf(Callable);

                let aValue = getBooleanA.call(interpreter);
                let bValue = getBooleanB.call(interpreter);
                expect(aValue).toEqual(new BrsBoolean(true));
                expect(bValue).toEqual(new BrsBoolean(false));
            });
        });
    });

    describe("ifToStr", () => {
        describe("toStr", () => {
            it("Returns the value as a string", () => {
                let interpreter = new Interpreter();
                let a = new RoBoolean(new BrsBoolean(true));
                let b = new RoBoolean(new BrsBoolean(false));
                let strA = a.getMethod("toStr");
                let strB = b.getMethod("toStr");
                expect(strA).toBeInstanceOf(Callable);
                expect(strB).toBeInstanceOf(Callable);

                let resultA = strA.call(interpreter);
                let resultB = strB.call(interpreter);
                expect(resultA).toEqual(new BrsString("true"));
                expect(resultB).toEqual(new BrsString("false"));
            });
        });
    });
});
