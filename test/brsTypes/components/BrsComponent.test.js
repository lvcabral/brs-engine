const brs = require("../../../packages/node/bin/brs.node");
const { BrsComponent, BrsInterface, BrsString, BrsInvalid, Callable, ValueKind } = brs.types;
const { GetInterface, FindMemberFunction } = brs.stdlib;
const { Interpreter } = brs;

describe("BrsComponent without registered methods", () => {
    const interpreter = new Interpreter();
    const ping = () =>
        new Callable("ping", {
            signature: { args: [], returns: ValueKind.String },
            impl: () => new BrsString("pong"),
        });

    it("finds no methods or interfaces", () => {
        const component = new BrsComponent("roEmpty");
        expect(component.getMethod("ping")).toBeUndefined();
        expect(component.hasInterface("ifPing")).toBe(false);
        expect(GetInterface.call(interpreter, component, new BrsString("ifPing"))).toBe(BrsInvalid.Instance);
        expect(FindMemberFunction.call(interpreter, component, new BrsString("ping"))).toBe(BrsInvalid.Instance);
    });

    it("ignores overrides for methods it does not have", () => {
        const component = new BrsComponent("roEmpty");
        component.overrideMethods([ping()]);
        expect(component.getMethod("ping")).toBeUndefined();
    });

    it("keeps its interfaces separate from other components", () => {
        const first = new BrsComponent("roEmpty");
        const second = new BrsComponent("roEmpty");
        first.interfaces.set("ifping", new BrsInterface("ifPing", new Set(["ping"])));
        expect(first.hasInterface("ifPing")).toBe(true);
        expect(second.hasInterface("ifPing")).toBe(false);
    });

    it("finds methods appended after construction", () => {
        const component = new BrsComponent("roEmpty");
        component.appendMethods([ping()]);
        expect(component.getMethod("PING")).toBeDefined();
    });
});
