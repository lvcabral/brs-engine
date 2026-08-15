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

    it("defaults to a 1x1 size, invalid, and state init before any content is set", () => {
        const animg = new RoAnimatedImage();
        const getWidth = animg.getMethod("getWidth");
        const getHeight = animg.getMethod("getHeight");
        const getState = animg.getMethod("getState");
        const isValid = animg.getMethod("isValid");

        expect(getWidth.call(interpreter)).toEqual(new Int32(1));
        expect(getHeight.call(interpreter)).toEqual(new Int32(1));
        expect(getState.call(interpreter)).toEqual(new BrsString("init"));
        expect(isValid.call(interpreter)).toEqual(BrsBoolean.False);
    });

    it("GetID returns a stable, unique id per instance", () => {
        const first = new RoAnimatedImage();
        const second = new RoAnimatedImage();

        const firstId = first.getMethod("getId").call(interpreter);
        const secondId = second.getMethod("getId").call(interpreter);

        expect(firstId).toEqual(first.getMethod("getId").call(interpreter));
        expect(firstId).not.toEqual(secondId);
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
        it("fails synchronously and pushes a failed event for a non-AA argument", () => {
            const animg = new RoAnimatedImage();
            const port = new RoMessagePort();
            animg.getMethod("setMessagePort").call(interpreter, port);

            const setContent = animg.getMethod("setContent");
            const result = setContent.call(interpreter, BrsInvalid.Instance);

            expect(result).toEqual(BrsBoolean.False);
            expect(animg.getMethod("isValid").call(interpreter)).toEqual(BrsBoolean.False);

            const event = port.getMethod("getMessage").call(interpreter);
            expect(event.getMethod("getMessage").call(interpreter)).toEqual(new BrsString("failed"));

            const info = event.getMethod("getInfo").call(interpreter);
            expect(info.get(new BrsString("id")).value).toEqual(animg.getMethod("getId").call(interpreter).value);
            expect(info.get(new BrsString("error"))).toBeInstanceOf(BrsString);
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
            expect(event.getMethod("getMessage").call(interpreter)).toEqual(new BrsString("failed"));
        });
    });

    describe("SetTargetState", () => {
        it("accepts the documented 'loop'/'play'/'pause'/'rewind' values and returns true", () => {
            const animg = new RoAnimatedImage();
            const setTargetState = animg.getMethod("setTargetState");

            for (const state of ["loop", "play", "pause", "rewind"]) {
                expect(setTargetState.call(interpreter, new BrsString(state))).toEqual(BrsBoolean.True);
            }
        });

        it("rejects an undocumented value and returns false", () => {
            const animg = new RoAnimatedImage();
            const setTargetState = animg.getMethod("setTargetState");

            expect(setTargetState.call(interpreter, new BrsString("stop"))).toEqual(BrsBoolean.False);
        });
    });

    describe("Update", () => {
        it("is a no-op in automatic mode (no content loaded, no throw)", () => {
            const animg = new RoAnimatedImage();
            const update = animg.getMethod("update");

            expect(() => update.call(interpreter, new Int32(16667))).not.toThrow();
        });
    });
});
