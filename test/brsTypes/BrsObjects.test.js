const brs = require("../../packages/node/bin/brs.node");
const { RoAssociativeArray, BrsObjects } = brs.types;

describe("BrsObjects", () => {
    describe("new object instances", () => {
        it("maps a new instance of associative array", () => {
            let obj = BrsObjects.get("roassociativearray");
            expect(obj().elements).toEqual(new RoAssociativeArray([]).elements);
        });
    });
});
