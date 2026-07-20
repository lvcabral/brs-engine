const brs = require("../../../packages/node/bin/brs.node");
const { Interpreter } = brs;
const { BrsString, RoURLTransfer, Callable } = brs.types;

describe("RoURLTransfer", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    describe("escape", () => {
        it("percent-encodes reserved URI characters, matching Roku device behavior", () => {
            let transfer = new RoURLTransfer();
            let escape = transfer.getMethod("escape");
            expect(escape).toBeInstanceOf(Callable);

            expect(escape.call(interpreter, new BrsString("!@#"))).toEqual(new BrsString("%21%40%23"));
        });

        it("leaves unreserved characters untouched", () => {
            let transfer = new RoURLTransfer();
            let escape = transfer.getMethod("escape");

            expect(escape.call(interpreter, new BrsString("ABcde_-.~"))).toEqual(new BrsString("ABcde_-.~"));
        });
    });

    describe("urlEncode", () => {
        it("percent-encodes reserved URI characters, matching Roku device behavior", () => {
            let transfer = new RoURLTransfer();
            let urlEncode = transfer.getMethod("urlEncode");
            expect(urlEncode).toBeInstanceOf(Callable);

            expect(urlEncode.call(interpreter, new BrsString("!@#"))).toEqual(new BrsString("%21%40%23"));
        });
    });

    describe("unescape", () => {
        it("decodes percent-encoded reserved URI characters", () => {
            let transfer = new RoURLTransfer();
            let unescape = transfer.getMethod("unescape");
            expect(unescape).toBeInstanceOf(Callable);

            expect(unescape.call(interpreter, new BrsString("%21%40%23"))).toEqual(new BrsString("!@#"));
        });

        it("round-trips through escape", () => {
            let transfer = new RoURLTransfer();
            let escape = transfer.getMethod("escape");
            let unescape = transfer.getMethod("unescape");

            let encoded = escape.call(interpreter, new BrsString("test=!@#"));
            expect(unescape.call(interpreter, encoded)).toEqual(new BrsString("test=!@#"));
        });
    });
});
