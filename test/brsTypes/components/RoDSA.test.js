const brs = require("../../../packages/node/bin/brs.node");
const { Interpreter } = brs;
const { RoDSA, RoByteArray, BrsString, BrsBoolean, Int32, BrsInvalid } = brs.types;

describe("RoDSA", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    describe("stringification", () => {
        it("lists stringified value", () => {
            let dsa = new RoDSA();
            expect(dsa.toString()).toEqual("<Component: roDSA>");
        });
    });

    describe("key configuration", () => {
        it("reports invalid keys (mock cannot validate)", () => {
            let dsa = new RoDSA();

            expect(dsa.getMethod("setPrivateKey").call(interpreter, new BrsString("tmp:/key.txt"))).toEqual(
                new Int32(0)
            );
            expect(dsa.getMethod("setPrivateKeyFromByteArray").call(interpreter, new RoByteArray())).toEqual(
                new Int32(0)
            );
            expect(dsa.getMethod("setPublicKey").call(interpreter, new BrsString("tmp:/key.txt"))).toEqual(
                new Int32(0)
            );
        });
    });

    describe("algorithm configuration", () => {
        it("accepts any digest and sign algorithm", () => {
            let dsa = new RoDSA();

            expect(dsa.getMethod("setDigestAlgorithm").call(interpreter, new BrsString("sha256"))).toEqual(
                BrsBoolean.True
            );
            expect(dsa.getMethod("setSignAlgorithm").call(interpreter, new BrsString("ECDSA"))).toEqual(
                BrsBoolean.True
            );
        });
    });

    describe("sign", () => {
        it("returns invalid (mock cannot sign)", () => {
            let dsa = new RoDSA();
            let sign = dsa.getMethod("sign");

            expect(sign).toBeTruthy();
            expect(sign.call(interpreter, new RoByteArray())).toBe(BrsInvalid.Instance);
        });
    });

    describe("verify", () => {
        it("reports no match (mock cannot verify)", () => {
            let dsa = new RoDSA();
            let verify = dsa.getMethod("verify");

            expect(verify).toBeTruthy();
            expect(verify.call(interpreter, new RoByteArray(), new RoByteArray())).toEqual(new Int32(0));
        });
    });
});
