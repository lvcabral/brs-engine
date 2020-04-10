const brs = require("brs");
const { RoAssociativeArray, BrsBoolean, BrsInvalid, roInvalid } = brs.types;

describe("RoInvalid", () => {
    describe("comparisons", () => {
        it("is equal to itself", () => {
            let a = new roInvalid();
            expect(a.equalTo(a)).toBe(BrsBoolean.True);
        });

        it("is equal to invalid", () => {
            let a = new roInvalid();
            expect(a.equalTo(BrsInvalid.Instance)).toBe(BrsBoolean.True);
        });

        it("is equal to roInvalid", () => {
            let a = new roInvalid();
            expect(a.equalTo(new roInvalid())).toBe(BrsBoolean.True);
        });

        it("is not equal to a RoAssocArray", () => {
            let a = new roInvalid();
            let b = new RoAssociativeArray([]);
            expect(a.equalTo(b)).toBe(BrsBoolean.False);
        });
    });

    describe("stringification", () => {
        it("stringifies itself", () => {
            let a = new roInvalid();
            expect(a.toString()).toBe("<Component: roInvalid>");
        });
    });
});
