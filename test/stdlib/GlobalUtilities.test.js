const brs = require("brs");
const { RoAssociativeArray, BrsString, BrsInvalid, BrsInterface } = brs.types;
const { GetInterface } = require("../../lib/stdlib");
const { Interpreter } = require("../../lib/interpreter");

describe("global utility functions", () => {
    let interpreter = new Interpreter();

    describe("GetInterface", () => {
        it("returns invalid for unimplemented interfaces", () => {
            let assocarray = new RoAssociativeArray([]);
            expect(GetInterface.call(interpreter, assocarray, new BrsString("ifArray"))).toBe(
                BrsInvalid.Instance
            );
        });

        it("returns an interface for implemented interfaces", () => {
            let assocarray = new RoAssociativeArray([]);
            let iface = GetInterface.call(
                interpreter,
                assocarray,
                new BrsString("ifAssociativeArray")
            );
            expect(iface).toBeInstanceOf(BrsInterface);
            expect(iface.name).toBe("ifAssociativeArray");
        });
    });
});
