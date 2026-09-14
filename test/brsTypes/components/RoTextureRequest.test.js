const brs = require("../../../packages/node/bin/brs.node");
const { RoTextureRequest, BrsString, BrsBoolean, Uninitialized } = brs.types;
const { Interpreter } = brs;

// Full request/response coverage (SetMessagePort + RequestTexture against a real download) lives in
// the CLI e2e fixture (test/cli/resources/roTextureManager.brs), matching how RoRegion/RoTextureManager's
// file-loading is tested. This file covers the request object's own setters without a mounted filesystem.

describe("RoTextureRequest", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    it("defaults to non-drawable", () => {
        const request = new RoTextureRequest(new BrsString("pkg:/images/test.png"));
        expect(request.drawable).toBe(false);
    });

    it("setDrawable(true) flips the drawable flag", () => {
        const request = new RoTextureRequest(new BrsString("pkg:/images/test.png"));
        const result = request.getMethod("setDrawable").call(interpreter, BrsBoolean.True);
        expect(result).toBe(Uninitialized.Instance);
        expect(request.drawable).toBe(true);
    });

    it("setDrawable(false) reverts to non-drawable", () => {
        const request = new RoTextureRequest(new BrsString("pkg:/images/test.png"));
        request.getMethod("setDrawable").call(interpreter, BrsBoolean.True);
        request.getMethod("setDrawable").call(interpreter, BrsBoolean.False);
        expect(request.drawable).toBe(false);
    });
});
