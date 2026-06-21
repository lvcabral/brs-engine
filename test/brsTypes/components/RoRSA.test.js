const brs = require("../../../packages/node/bin/brs.node");
const { Interpreter } = brs;
const { RoRSA, RoByteArray, BrsString, BrsBoolean, Int32, BrsInvalid } = brs.types;

describe("RoRSA", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    describe("stringification", () => {
        it("lists stringified value", () => {
            let rsa = new RoRSA();
            expect(rsa.toString()).toEqual("<Component: roRSA>");
        });
    });

    describe("key configuration", () => {
        it("reports invalid keys (mock cannot validate)", () => {
            let rsa = new RoRSA();

            expect(rsa.getMethod("setPrivateKey").call(interpreter, new BrsString("tmp:/key.txt"))).toEqual(
                new Int32(0)
            );
            expect(rsa.getMethod("setPublicKey").call(interpreter, new BrsString("tmp:/key.txt"))).toEqual(
                new Int32(0)
            );
        });
    });

    describe("setDigestAlgorithm", () => {
        it("accepts any digest algorithm", () => {
            let rsa = new RoRSA();
            let setDigestAlgorithm = rsa.getMethod("setDigestAlgorithm");

            expect(setDigestAlgorithm).toBeTruthy();
            expect(setDigestAlgorithm.call(interpreter, new BrsString("sha1"))).toEqual(BrsBoolean.True);
        });
    });

    describe("sign", () => {
        it("returns invalid (mock cannot sign)", () => {
            let rsa = new RoRSA();
            let sign = rsa.getMethod("sign");

            expect(sign).toBeTruthy();
            expect(sign.call(interpreter, new RoByteArray())).toBe(BrsInvalid.Instance);
        });
    });

    describe("verify", () => {
        it("reports no match (mock cannot verify)", () => {
            let rsa = new RoRSA();
            let verify = rsa.getMethod("verify");

            expect(verify).toBeTruthy();
            expect(verify.call(interpreter, new RoByteArray(), new RoByteArray())).toEqual(new Int32(0));
        });
    });
});
