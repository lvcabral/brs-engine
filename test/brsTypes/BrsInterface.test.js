const Brs = require("brs");
const { BrsInterface, BrsBoolean, Callable } = Brs.types;

describe("Interface", () => {
    it("doesn't equal anything", () => {
        let a = new BrsInterface("ifArray", []);
        let b = new BrsInterface("ifArray", []);
        expect(a.equalTo(b)).toBe(BrsBoolean.False);
    });

    it("stringifies to <Interface: name>", () => {
        let ifRegex = new BrsInterface("ifRegex", []);
        expect(ifRegex.toString()).toBe("<Interface: ifRegex>");
    });

    it("exposes known method names", () => {
        let ifArray = new BrsInterface("ifArray", [
            new Callable("clear", { args: [], impl: () => {} }),
        ]);
        expect(ifArray.methodNames).toContain("clear");
    });
});
