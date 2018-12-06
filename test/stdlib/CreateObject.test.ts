const { AssociativeArray, BrsObjects, CreateObject, BrsInvalid } = require("../../lib/brsTypes");
const BrsError = require("../../lib/Error");

describe("CreateObject", () => {
    it("creates a new instance of associative array", () => {
        let obj = CreateObject("roAssociativeArray");
        expect(obj).toEqual(new AssociativeArray([]));
    });

    it("returns invalid for an undefined BrsObject", () => {
        let obj = CreateObject("notAnObject");
        expect(obj).toEqual(BrsInvalid.Instance);
    });
});
