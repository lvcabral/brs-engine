const brs = require("../../../packages/node/bin/brs.node");
const { RoAssociativeArray, BrsBoolean, BrsInvalid, RoInvalid } = brs.types;

describe("RoInvalid", () => {
    describe("comparisons", () => {
        it("is equal to itself", () => {
            let a = new RoInvalid();
            expect(a.equalTo(a)).toBe(BrsBoolean.True);
        });

        it("is equal to invalid", () => {
            let a = new RoInvalid();
            expect(a.equalTo(BrsInvalid.Instance)).toBe(BrsBoolean.True);
        });

        it("is equal to roInvalid", () => {
            let a = new RoInvalid();
            expect(a.equalTo(new RoInvalid())).toBe(BrsBoolean.True);
        });

        it("is not equal to a RoAssocArray", () => {
            let a = new RoInvalid();
            let b = new RoAssociativeArray([]);
            expect(a.equalTo(b)).toBe(BrsBoolean.False);
        });
    });

    describe("stringification", () => {
        it("stringifies itself", () => {
            let a = new RoInvalid();
            expect(a.toString()).toBe("<Component: roInvalid>");
        });
    });
});
