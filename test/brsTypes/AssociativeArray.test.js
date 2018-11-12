const { AssociativeArray, BrsArray, BrsBoolean, BrsString, Int32, BrsInvalid } = require("../../lib/brsTypes");
const BrsError = require("../../lib/Error");

describe("AssociativeArray", () => {
    beforeEach(() => BrsError.reset());

    describe("comparisons", () => {
        it("is less than nothing", () => {
            let a = new AssociativeArray([]);
            expect(a.lessThan(a)).toBe(BrsBoolean.False);
        });
        it("is greater than nothing", () => {
            let a = new AssociativeArray([]);
            expect(a.greaterThan(a)).toBe(BrsBoolean.False);
        });
        it("is equal to nothing", () => {
            let a = new AssociativeArray([]);
            expect(a.equalTo(a)).toBe(BrsBoolean.False);
        });
    });

    describe("stringification", () => {
        it("lists all primitive values", () => {
            let aa = new AssociativeArray([
                { name: new BrsString("array"), value: new BrsArray([ new BrsString("I shouldn't appear")]) },
                { name: new BrsString("associative-array"), value: new AssociativeArray([]) },
                { name: new BrsString("boolean"), value: BrsBoolean.True },
                { name: new BrsString("string"), value: new BrsString("a string") },
                { name: new BrsString("number"), value: new Int32(-1) },
                { name: new BrsString("invalid"), value: BrsInvalid.Instance }
            ]);
            expect(aa.toString()).toEqual(
`<Component: roAssociativeArray> =
{
    array: <Component: roArray>
    associative-array: <Component: roAssociativeArray>
    boolean: true
    string: a string
    number: -1
    invalid: invalid
}`
            );
        });
    });
});