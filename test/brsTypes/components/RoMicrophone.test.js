const brs = require("../../../packages/node/bin/brs.node");
const { Interpreter } = brs;
const { RoMicrophone, RoMessagePort, BrsString, BrsBoolean, BrsInvalid } = brs.types;

describe("RoMicrophone", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    describe("stringification", () => {
        it("lists stringified value", () => {
            let mic = new RoMicrophone();
            expect(mic.toString()).toEqual("<Component: roMicrophone>");
        });
    });

    describe("canRecord", () => {
        it("returns false (no microphone available)", () => {
            let mic = new RoMicrophone();
            let canRecord = mic.getMethod("canRecord");

            expect(canRecord).toBeTruthy();
            expect(canRecord.call(interpreter)).toEqual(BrsBoolean.False);
        });
    });

    describe("setPrompt", () => {
        it("returns invalid (no-op)", () => {
            let mic = new RoMicrophone();
            let setPrompt = mic.getMethod("setPrompt");

            expect(setPrompt).toBeTruthy();
            expect(setPrompt.call(interpreter, new BrsString("Speak now"))).toBe(BrsInvalid.Instance);
        });
    });

    describe("recording", () => {
        it("reports failure for recordToFile, startRecording and stopRecording", () => {
            let mic = new RoMicrophone();

            expect(mic.getMethod("recordToFile").call(interpreter, new BrsString("tmp:/rec.wav"))).toEqual(
                BrsBoolean.False
            );
            expect(mic.getMethod("startRecording").call(interpreter)).toEqual(BrsBoolean.False);
            expect(mic.getMethod("stopRecording").call(interpreter)).toEqual(BrsBoolean.False);
        });
    });

    describe("message port", () => {
        it("stores and returns the assigned message port", () => {
            let mic = new RoMicrophone();
            let port = new RoMessagePort();
            mic.getMethod("setMessagePort").call(interpreter, port);

            expect(mic.getMethod("getMessagePort").call(interpreter)).toBe(port);
        });
    });
});
