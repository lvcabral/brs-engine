const { BrsTypes } = require("brs");
const { BrsArray, BrsBoolean, BrsString, Int32, BrsInvalid } = BrsTypes;
const BrsError = require("../../../lib/Error");

describe("Array", () => {
    beforeEach(() => BrsError.reset());
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
});
