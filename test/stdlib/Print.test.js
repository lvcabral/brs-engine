const brs = require("../../bin/brs.node");
const { Pos, Tab } = brs.stdlib;
const { Interpreter } = brs;
const { BrsString, Int32 } = brs.types;

const { createMockStreams } = require("../e2e/E2ETests");

describe("print utility functions", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter(createMockStreams());
    });

    describe("Pos", () => {
        it("returns the current output cursor position", async () => {
            interpreter.stdout.write("ends in a newline so doesn't affect pos\n");
            interpreter.stdout.write("lorem");

            expect(await Pos.call(interpreter, new Int32(0))).toEqual(new Int32(5));
        });

        it("handles multi-line output correctly", async () => {
            interpreter.stdout.write("foo\nbar\nbaz");

            expect(await Pos.call(interpreter, new Int32(0))).toEqual(new Int32(3));
        });
    });

    describe("Tab", () => {
        it("ignores indentations", async () => {
            expect(await Tab.call(interpreter, new Int32(-33))).toEqual(new BrsString(""));
        });

        it("ignores indentations less than current `pos`", async () => {
            interpreter.stdout.write("lorem ipsum dolor sit amet");

            expect(await Tab.call(interpreter, new Int32(8))).toEqual(new BrsString(""));
        });

        it("provides whitespace to indent to the desired column", async () => {
            interpreter.stdout.write("lorem");

            expect(await Tab.call(interpreter, new Int32(8))).toEqual(new BrsString("   "));
        });
    });
});
