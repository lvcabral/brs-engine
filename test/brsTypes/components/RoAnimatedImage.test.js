const brs = require("../../../packages/node/bin/brs.node");
const { Interpreter } = brs;
const { BrsString, BrsBoolean, BrsInvalid, Int32, RoAnimatedImage, RoAssociativeArray, RoMessagePort } = brs.types;

// Full uri-load coverage (SetContent against a real animated WebP served through pkg:/) lives in
// the CLI e2e fixture, matching how RoRegion/RoTextureManager's file-loading is tested — this file
// covers what's reachable without a mounted filesystem: defaults, pretranslation, target state, and
// the message-port ready-event contract on the synchronous-failure path.

describe("RoAnimatedImage", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    it("stringifies as roAnimatedImage", () => {
        const animg = new RoAnimatedImage();
        expect(animg.toString()).toEqual("<Component: roAnimatedImage>");
    });

    it("defaults to a 1x1 size and state None before any content is set", () => {
        const animg = new RoAnimatedImage();
        const getWidth = animg.getMethod("getWidth");
        const getHeight = animg.getMethod("getHeight");
        const getState = animg.getMethod("getState");

        expect(getWidth.call(interpreter)).toEqual(new Int32(1));
        expect(getHeight.call(interpreter)).toEqual(new Int32(1));
        expect(getState.call(interpreter)).toEqual(new Int32(0)); // AnimatedImageState.None
    });

    describe("SetPretranslation", () => {
        it("stores and reads back the pretranslation offset", () => {
            const animg = new RoAnimatedImage();
            const setPretranslation = animg.getMethod("setPretranslation");
            const getPretranslationX = animg.getMethod("getPretranslationX");
            const getPretranslationY = animg.getMethod("getPretranslationY");

            expect(getPretranslationX.call(interpreter)).toEqual(new Int32(0));
            expect(getPretranslationY.call(interpreter)).toEqual(new Int32(0));

            setPretranslation.call(interpreter, new Int32(-10), new Int32(-20));

            expect(getPretranslationX.call(interpreter)).toEqual(new Int32(-10));
            expect(getPretranslationY.call(interpreter)).toEqual(new Int32(-20));
        });
    });

    describe("SetContent", () => {
        it("fails synchronously and pushes a Failed ready event for a non-AA argument", () => {
            const animg = new RoAnimatedImage();
            const port = new RoMessagePort();
            animg.getMethod("setMessagePort").call(interpreter, port);

            const setContent = animg.getMethod("setContent");
            const result = setContent.call(interpreter, BrsInvalid.Instance);

            expect(result).toEqual(BrsBoolean.False);

            const getMessage = port.getMethod("getMessage");
            const event = getMessage.call(interpreter);
            expect(event.getMethod("getState").call(interpreter)).toEqual(new Int32(3)); // Failed
        });

        it("fails for a missing/invalid uri", () => {
            const animg = new RoAnimatedImage();
            const port = new RoMessagePort();
            animg.getMethod("setMessagePort").call(interpreter, port);

            const content = new RoAssociativeArray([
                { name: new BrsString("uri"), value: new BrsString("") },
                { name: new BrsString("mimeType"), value: new BrsString("image/webp") },
            ]);
            const result = animg.getMethod("setContent").call(interpreter, content);

            expect(result).toEqual(BrsBoolean.False);
            const event = port.getMethod("getMessage").call(interpreter);
            expect(event.getMethod("getState").call(interpreter)).toEqual(new Int32(3)); // Failed
            expect(event.getMethod("getURI").call(interpreter)).toEqual(new BrsString(""));
        });
    });

    describe("SetTargetState", () => {
        it("accepts the confirmed 'loop' state without error", () => {
            const animg = new RoAnimatedImage();
            const setTargetState = animg.getMethod("setTargetState");

            expect(() => setTargetState.call(interpreter, new BrsString("loop"))).not.toThrow();
        });
    });
});
