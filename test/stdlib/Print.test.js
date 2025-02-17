const brs = require("../../bin/brs.node");
const { Pos, Tab } = brs.stdlib;
const { Interpreter, BrsDevice } = brs;
const { BrsString, Int32 } = brs.types;

const { createMockStreams } = require("../e2e/E2ETests");

describe("print utility functions", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter(createMockStreams());
    });

    describe("Pos", () => {
        it("returns the current output cursor position", () => {
            BrsDevice.stdout.write("ends in a newline so doesn't affect pos\n");
            BrsDevice.stdout.write("lorem");

            expect(Pos.call(interpreter, new Int32(0))).toEqual(new Int32(5));
        });

        it("handles multi-line output correctly", () => {
            BrsDevice.stdout.write("foo\nbar\nbaz");

            expect(Pos.call(interpreter, new Int32(0))).toEqual(new Int32(3));
        });
    });

    describe("Tab", () => {
        it("ignores indentations", () => {
            expect(Tab.call(interpreter, new Int32(-33))).toEqual(new BrsString(""));
        });

        it("ignores intendations less than current `pos`", () => {
            BrsDevice.stdout.write("lorem ipsum dolor sit amet");

            expect(Tab.call(interpreter, new Int32(8))).toEqual(new BrsString(""));
        });

        it("provides whitespace to indent to the desired column", () => {
            BrsDevice.stdout.write("lorem");

            expect(Tab.call(interpreter, new Int32(8))).toEqual(new BrsString("   "));
        });
    });
});
