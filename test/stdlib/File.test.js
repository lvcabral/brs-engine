const { ReadAsciiFile, WriteAsciiFile, getMemfsPath, getVolumeByPath } = require("../../lib/stdlib/index");
const { Interpreter } = require("../../lib/interpreter");
const { BrsTypes } = require("brs");
const { BrsString } = BrsTypes;

let interpreter;

describe("global file I/O functions", () => {
    beforeEach(() => {
        interpreter = new Interpreter(); // reset the file systems
    });

    describe("file I/O utility utilities", () => {
        it("gets a volume by path", () => {
            expect(getVolumeByPath(interpreter, "tmp:///test.txt")).toEqual(interpreter.temporaryVolume);
        });

        it("converts a brs path to a memfs path", () => {
            expect(getMemfsPath("tmp:/test.txt")).toEqual("/test.txt");
            expect(getMemfsPath("tmp:///test.txt")).toEqual("/test.txt");
        })
    });


    describe("ReadAsciiFile", () => {
        it("reads an ascii file", () => {
            interpreter.temporaryVolume.writeFileSync("/test.txt", "test contents");
            
            expect(
                ReadAsciiFile.call(interpreter, new BrsString("tmp:///test.txt")).value
            ).toEqual("test contents");

            expect(
                ReadAsciiFile.call(interpreter, new BrsString("tmp:/test.txt")).value
            ).toEqual("test contents");
        });
    });

    describe("WriteAsciiFile", () => {
        it("fails writing to bad paths", () => {
            expect(
                WriteAsciiFile.call(interpreter, new BrsString("hello.txt"), new BrsString("test contents")).value
            ).toBeFalsy();
        });

        it("writes an ascii file", () => {
            expect(
                WriteAsciiFile.call(interpreter, new BrsString("tmp:///hello.txt"), new BrsString("test contents")).value
            ).toBeTruthy();

            expect(interpreter.temporaryVolume.toJSON()).toEqual({ "/hello.txt": "test contents" });
        });
    });
});
