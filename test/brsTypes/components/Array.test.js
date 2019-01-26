const brs = require("brs");
const { BrsArray, BrsBoolean, BrsString, Int32, BrsInvalid } = brs.types;
const BrsError = require("../../../lib/Error");
const { Interpreter } = require("../../../lib/interpreter");

describe("Array", () => {
    describe("comparisons", () => {
        it("is less than nothing", () => {
            let a = new BrsArray([]);
            expect(a.lessThan(a)).toBe(BrsBoolean.False);
        });
        it("is greater than nothing", () => {
            let a = new BrsArray([]);
            expect(a.greaterThan(a)).toBe(BrsBoolean.False);
        });
        it("is equal to nothing", () => {
            let a = new BrsArray([]);
            expect(a.equalTo(a)).toBe(BrsBoolean.False);
        });
    });

    describe("stringification", () => {
        it("lists all primitive values", () => {
            let arr = new BrsArray([
                new BrsArray([ new BrsString("I shouldn't appear")]),
                BrsBoolean.True,
                new BrsString("a string"),
                new Int32(-1),
                BrsInvalid.Instance
            ]);
            expect(arr.toString()).toEqual(
`<Component: roArray> =
[
    <Component: roArray>
    true
    a string
    -1
    invalid
]`
            );
        });
    });

    describe("get", () => {
        it("returns values from in-bounds indexes", () => {
            let a = new BrsString("a");
            let b = new BrsString("b");
            let c = new BrsString("c");

            let arr = new BrsArray([a, b, c]);

            expect(arr.get(new Int32(0))).toBe(a);
            expect(arr.get(new Int32(2))).toBe(c);
        });

        it("returns invalid for out-of-bounds indexes", () => {
            let arr = new BrsArray([]);

            expect(arr.get(new Int32(555))).toBe(BrsInvalid.Instance);
        });
    });

    describe("set", () => {
        it("sets values at in-bounds indexes", () => {
            let a = new BrsString("a");
            let b = new BrsString("b");
            let c = new BrsString("c");

            let arr = new BrsArray([a, b, c]);

            arr.set(new Int32(0), new BrsString("replacement for a"));
            arr.set(new Int32(2), new BrsString("replacement for c"));

            expect(arr.get(new Int32(0))).toEqual(new BrsString("replacement for a"));
            expect(arr.get(new Int32(2))).toEqual(new BrsString("replacement for c"));
        });

        it("sets values at out-of-bounds indexes", () => {
            let arr = new BrsArray([]);

            arr.set(new Int32(555), new BrsString("value set at index 555"));
            expect(arr.get(new Int32(555))).toEqual(new BrsString("value set at index 555"));
        });
    });

    describe("methods", () => {
        let interpreter;

        beforeEach(() => {
            interpreter = new Interpreter();
        });

        describe("peek", () => {
            it("returns the value at the highest index", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let arr = new BrsArray([a, b, c]);

                let peek = arr.getMethod("peek");
                expect(peek).toBeTruthy();
                expect(peek.call(interpreter)).toBe(c);
            });

            it("returns `invalid` when empty", () => {
                let arr = new BrsArray([]);

                let peek = arr.getMethod("peek");
                expect(peek).toBeTruthy();
                expect(peek.call(interpreter)).toBe(BrsInvalid.Instance);
            });
        });

        describe("pop", () => {
            it("returns and removes the value at the highest index", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let arr = new BrsArray([a, b, c]);

                let pop = arr.getMethod("pop");
                expect(pop).toBeTruthy();
                expect(pop.call(interpreter)).toBe(c);
                expect(arr.elements).toEqual([ a, b ]);
            });

            it("returns `invalid` and doesn't modify when empty", () => {
                let arr = new BrsArray([]);

                let pop = arr.getMethod("pop");
                expect(pop).toBeTruthy();

                let before = arr.getElements();
                expect(pop.call(interpreter)).toBe(BrsInvalid.Instance);
                expect(arr.getElements()).toEqual(before);
            });
        });

        describe("push", () => {
            it("appends a value to the end of the array", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let arr = new BrsArray([a, b]);

                let push = arr.getMethod("push");
                expect(push).toBeTruthy();
                expect(push.call(interpreter, c)).toBe(BrsInvalid.Instance);
                expect(arr.elements).toEqual([ a, b, c ]);
            });
        });


        describe("shift", () => {
            it("returns and removes the value at the lowest index", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let arr = new BrsArray([a, b, c]);

                let shift = arr.getMethod("shift");
                expect(shift).toBeTruthy();
                expect(shift.call(interpreter)).toBe(a);
                expect(arr.elements).toEqual([ b, c ]);
            });

            it("returns `invalid` and doesn't modify when empty", () => {
                let arr = new BrsArray([]);

                let shift = arr.getMethod("shift");
                expect(shift).toBeTruthy();

                let before = arr.getElements();
                expect(shift.call(interpreter)).toBe(BrsInvalid.Instance);
                expect(arr.getElements()).toEqual(before);
            });
        });

        describe("unshift", () => {
            it("inserts a value at the beginning of the array", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let arr = new BrsArray([b, c]);

                let unshift = arr.getMethod("unshift");
                expect(unshift).toBeTruthy();
                expect(unshift.call(interpreter, a)).toBe(BrsInvalid.Instance);
                expect(arr.elements).toEqual([ a, b, c ]);
            });
        });

        describe("delete", () => {
            it("removes elements from in-bounds indices", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let arr = new BrsArray([a, b, c]);

                let deleteMethod = arr.getMethod("delete");
                expect(deleteMethod).toBeTruthy();
                expect(deleteMethod.call(interpreter, new Int32(1))).toBe(BrsBoolean.True);
                expect(arr.elements).toEqual([ a, c ]);
            });

            it("doesn't remove elements from out-of-bounds indices", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let arr = new BrsArray([a, b, c]);

                let deleteMethod = arr.getMethod("delete");
                expect(deleteMethod).toBeTruthy();
                expect(deleteMethod.call(interpreter, new Int32(1111))).toBe(BrsBoolean.False);
                expect(deleteMethod.call(interpreter, new Int32(-1))).toBe(BrsBoolean.False);
                expect(arr.elements).toEqual([ a, b, c ]);
            });
        });

        describe("count", () => {
            it("returns the length of the array", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let arr = new BrsArray([a, b, c]);

                let count = arr.getMethod("count");
                expect(count).toBeTruthy();
                expect(count.call(interpreter)).toEqual(new Int32(3));
            });
        });

        describe("clear", () => {
            it("empties the array", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let c = new BrsString("c");

                let arr = new BrsArray([a, b]);

                let clear = arr.getMethod("clear");
                expect(clear).toBeTruthy();
                expect(clear.call(interpreter)).toBe(BrsInvalid.Instance);
                expect(arr.elements).toEqual([]);
            });
        });

        describe("append", () => {
            it("adds non-empty elements to the current array", () => {
                let a = new BrsString("a");
                let b = new BrsString("b");
                let src = new BrsArray([a, b]);

                let c = new BrsString("c");
                let d = new BrsString("d");
                let e = new BrsString("e");
                let f = new BrsString("f");
                let other = new BrsArray([c, undefined, d, undefined, undefined, e, f, undefined]);

                let append = src.getMethod("append");
                expect(append).toBeTruthy();
                expect(append.call(interpreter, other)).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual([a, b, c, d, e, f]);
            });
        });
    });
});
