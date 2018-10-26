const { BrsArray, BrsBoolean } = require("../../lib/brsTypes");
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
});