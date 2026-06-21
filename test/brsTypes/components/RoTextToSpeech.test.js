const brs = require("../../../packages/node/bin/brs.node");
const { Interpreter } = brs;
const { RoTextToSpeech, RoMessagePort, BrsString, BrsBoolean, Int32 } = brs.types;

describe("RoTextToSpeech", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    describe("stringification", () => {
        it("lists stringified value", () => {
            let tts = new RoTextToSpeech();
            expect(tts.toString()).toEqual("<Component: roTextToSpeech>");
        });
    });

    describe("say", () => {
        it("returns incrementing speech IDs without speaking", () => {
            let tts = new RoTextToSpeech();
            let say = tts.getMethod("say");

            expect(say).toBeTruthy();
            expect(say.call(interpreter, new BrsString("hello"))).toEqual(new Int32(1));
            expect(say.call(interpreter, new BrsString("world"))).toEqual(new Int32(2));
        });
    });

    describe("silence", () => {
        it("returns the requested duration", () => {
            let tts = new RoTextToSpeech();
            let silence = tts.getMethod("silence");

            expect(silence).toBeTruthy();
            expect(silence.call(interpreter, new Int32(500))).toEqual(new Int32(500));
        });
    });

    describe("isEnabled", () => {
        it("returns false (no text-to-speech in the engine)", () => {
            let tts = new RoTextToSpeech();
            let isEnabled = tts.getMethod("isEnabled");

            expect(isEnabled).toBeTruthy();
            expect(isEnabled.call(interpreter)).toEqual(BrsBoolean.False);
        });
    });

    describe("available languages and voices", () => {
        it("returns empty arrays", () => {
            let tts = new RoTextToSpeech();
            let getAvailableLanguages = tts.getMethod("getAvailableLanguages");
            let getAvailableVoices = tts.getMethod("getAvailableVoices");

            expect(getAvailableLanguages.call(interpreter).getElements()).toEqual([]);
            expect(getAvailableVoices.call(interpreter).getElements()).toEqual([]);
        });
    });

    describe("language and voice state", () => {
        it("defaults to en-US language and empty voice", () => {
            let tts = new RoTextToSpeech();
            expect(tts.getMethod("getLanguage").call(interpreter)).toEqual(new BrsString("en-US"));
            expect(tts.getMethod("getVoice").call(interpreter)).toEqual(new BrsString(""));
        });

        it("stores the language and voice that were set", () => {
            let tts = new RoTextToSpeech();
            tts.getMethod("setLanguage").call(interpreter, new BrsString("es-ES"));
            tts.getMethod("setVoice").call(interpreter, new BrsString("female"));

            expect(tts.getMethod("getLanguage").call(interpreter)).toEqual(new BrsString("es-ES"));
            expect(tts.getMethod("getVoice").call(interpreter)).toEqual(new BrsString("female"));
        });
    });

    describe("volume, rate and pitch state", () => {
        it("returns the documented defaults", () => {
            let tts = new RoTextToSpeech();
            expect(tts.getMethod("getVolume").call(interpreter)).toEqual(new Int32(1000));
            expect(tts.getMethod("getRate").call(interpreter)).toEqual(new Int32(0));
            expect(tts.getMethod("getPitch").call(interpreter)).toEqual(new Int32(0));
        });

        it("stores the values that were set", () => {
            let tts = new RoTextToSpeech();
            tts.getMethod("setVolume").call(interpreter, new Int32(750));
            tts.getMethod("setRate").call(interpreter, new Int32(50));
            tts.getMethod("setPitch").call(interpreter, new Int32(-20));

            expect(tts.getMethod("getVolume").call(interpreter)).toEqual(new Int32(750));
            expect(tts.getMethod("getRate").call(interpreter)).toEqual(new Int32(50));
            expect(tts.getMethod("getPitch").call(interpreter)).toEqual(new Int32(-20));
        });
    });

    describe("message port", () => {
        it("stores and returns the assigned message port", () => {
            let tts = new RoTextToSpeech();
            let port = new RoMessagePort();
            tts.getMethod("setMessagePort").call(interpreter, port);

            expect(tts.getMethod("getMessagePort").call(interpreter)).toBe(port);
        });
    });
});
