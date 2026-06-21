const brs = require("../../../packages/node/bin/brs.node");
const { Interpreter } = brs;
const { RoAudioGuide, BrsString, BrsBoolean, Int32, BrsInvalid } = brs.types;

describe("RoAudioGuide", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    describe("stringification", () => {
        it("lists stringified value", () => {
            let audioGuide = new RoAudioGuide();
            expect(audioGuide.toString()).toEqual("<Component: roAudioGuide>");
        });
    });

    describe("say", () => {
        it("returns incrementing speech IDs without speaking", () => {
            let audioGuide = new RoAudioGuide();
            let say = audioGuide.getMethod("say");

            expect(say).toBeTruthy();
            expect(say.call(interpreter, new BrsString("hello"), BrsBoolean.True, BrsBoolean.False)).toEqual(
                new Int32(1)
            );
            expect(say.call(interpreter, new BrsString("world"), BrsBoolean.False, BrsBoolean.False)).toEqual(
                new Int32(2)
            );
        });
    });

    describe("flush", () => {
        it("returns invalid (no-op)", () => {
            let audioGuide = new RoAudioGuide();
            let flush = audioGuide.getMethod("flush");

            expect(flush).toBeTruthy();
            expect(flush.call(interpreter)).toBe(BrsInvalid.Instance);
        });
    });

    describe("silence", () => {
        it("returns the requested duration", () => {
            let audioGuide = new RoAudioGuide();
            let silence = audioGuide.getMethod("silence");

            expect(silence).toBeTruthy();
            expect(silence.call(interpreter, new Int32(250))).toEqual(new Int32(250));
        });
    });
});
