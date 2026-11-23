const brs = require("../../packages/node/bin/brs.node");
const { BlockEnd } = brs;

const location = {
    file: "test.brs",
    start: { line: 1, column: 0 },
    end: { line: 1, column: 6 },
};

describe("BlockEnd", () => {
    let original;

    beforeEach(() => {
        original = Object.getOwnPropertyDescriptor(Error, "stackTraceLimit");
    });

    afterEach(() => {
        if (original) {
            Object.defineProperty(Error, "stackTraceLimit", original);
        } else {
            delete Error.stackTraceLimit;
        }
    });

    it("restores Error.stackTraceLimit after construction", () => {
        Error.stackTraceLimit = 25;
        const err = new BlockEnd("`return` encountered", location);
        expect(err.message).toBe("`return` encountered");
        expect(err.location).toBe(location);
        expect(Error.stackTraceLimit).toBe(25);
    });

    it("constructs when Error.stackTraceLimit is read-only", () => {
        Object.defineProperty(Error, "stackTraceLimit", { value: 10, writable: false, configurable: true });
        const err = new BlockEnd("`exit for` encountered", location);
        expect(err.location).toBe(location);
        expect(Error.stackTraceLimit).toBe(10);
    });

    it("does not define Error.stackTraceLimit when the engine has none", () => {
        delete Error.stackTraceLimit;
        new BlockEnd("`goto` encountered", location);
        expect(Object.hasOwn(Error, "stackTraceLimit")).toBe(false);
    });
});
