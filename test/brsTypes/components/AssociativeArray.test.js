const { BrsTypes } = require("brs");
const { AssociativeArray, BrsArray, BrsBoolean, BrsString, Int32, BrsInvalid } = BrsTypes;
const BrsError = require("../../../lib/Error");

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

    describe("get", () => {
        it("returns value given a key it contains", () => {
            let aa = new AssociativeArray([
                { name: new BrsString("foo"), value: new Int32(-99) }
            ]);

            expect(aa.get(new BrsString("foo"))).toEqual(new Int32(-99));
        });

        it("returns 'invalid' given a key it doesn't contain", () => {
            let aa = new AssociativeArray([]);

            expect(aa.get(new BrsString("does_not_exist"))).toEqual(BrsInvalid.Instance);
        });
    });

    describe("set", () => {
        it("sets values with new keys", () => {
            let aa = new AssociativeArray([
                { name: new BrsString("foo"), value: new Int32(-99) }
            ]);
            let ninetyNine = aa.get(new BrsString("foo"));

            aa.set(new BrsString("bar"), new Int32(808));
            expect(aa.get(new BrsString("bar"))).toEqual(new Int32(808));

            // ensure other keya don't get modified
            expect(aa.get(new BrsString("foo"))).toBe(ninetyNine);
        });

        it("overwrites values with existing keys", () => {
            let aa = new AssociativeArray([
                { name: new BrsString("foo"), value: new Int32(-99) }
            ]);

            aa.set(new BrsString("foo"), new BrsString("not ninetynine"));

            expect(aa.get(new BrsString("foo"))).toEqual(new BrsString("not ninetynine"));
        });
    });
});
