const { BrsArray, BrsBoolean, BrsString, Int32, BrsInvalid } = require("../../lib/brsTypes");
const BrsError = require("../../lib/Error");

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
});