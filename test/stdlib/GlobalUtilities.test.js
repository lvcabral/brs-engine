const brs = require("../../bin/brs.node");
const { RoAssociativeArray, BrsString, BrsInvalid, BrsInterface, Int32 } = brs.types;
const { GetInterface, ObjFun } = brs.stdlib;
const { Interpreter } = brs;

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
    describe("ObjFun", () => {
        it("successfully call a method of a function with no arguments", () => {
            let assocarray = new RoAssociativeArray([
                { name: new BrsString("letter1"), value: new BrsString("a") },
                { name: new BrsString("letter2"), value: new BrsString("b") },
            ]);
            let iface = GetInterface.call(
                interpreter,
                assocarray,
                new BrsString("ifAssociativeArray")
            );
            expect(iface).toBeInstanceOf(BrsInterface);
            expect(iface.name).toBe("ifAssociativeArray");
            let result = ObjFun.call(interpreter, assocarray, iface, new BrsString("Count"));
            expect(result).toEqual(new Int32(2));
        });

        it("successfully call a method of a function with arguments", () => {
            let assocarray = new RoAssociativeArray([
                { name: new BrsString("letter1"), value: new BrsString("a") },
                { name: new BrsString("letter2"), value: new BrsString("b") },
            ]);
            let iface = GetInterface.call(
                interpreter,
                assocarray,
                new BrsString("ifAssociativeArray")
            );
            expect(iface).toBeInstanceOf(BrsInterface);
            expect(iface.name).toBe("ifAssociativeArray");
            let result = ObjFun.call(
                interpreter,
                assocarray,
                iface,
                new BrsString("lookup"),
                new BrsString("letter1")
            );
            expect(result).toEqual(new BrsString("a", true));
        });
    });
});
