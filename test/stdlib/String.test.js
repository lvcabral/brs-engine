const { UCase, LCase, Asc, Chr, Left, Right, Instr, Len, Mid, Str, StrI, Val } = require("../../lib/stdlib/index");
const { Interpreter } = require("../../lib/interpreter");
const { BrsString, BrsBoolean, Int32, Float } = require("../../lib/brsTypes");

const interpreter = new Interpreter();

describe("global string functions", () => {
    describe("UCase", () => {
        it("converts a BRS string to its uppercase form", () => {
            expect(
                UCase.call(interpreter, new BrsString("l0rEm"))
            ).toEqual(new BrsString("L0REM"));
        });
    });

    describe("LCase", () => {
        it("converts a BRS string to its lowercase form", () => {
            expect(
                LCase.call(interpreter, new BrsString("l0rEm"))
            ).toEqual(new BrsString("l0rem"));
        });
    });

    describe("Asc", () => {
        it("converts an empty BRS string to zero", () => {
            expect(
                Asc.call(interpreter, new BrsString(""))
            ).toEqual(new Int32(0));
        });

        it("converts a character to a UTF-16 representation", () => {
            expect(
                Asc.call(interpreter, new BrsString("for"))
            ).toEqual(new Int32(102)); // UTF-16 decimal for "f"

            expect(
                Asc.call(interpreter, new BrsString("ぇ"))
            ).toEqual(new Int32(12359));
        });
    });

    describe("Chr", () => {
        it("converts a negative or zero to an empty string", () => {
            expect(
                Chr.call(interpreter, new Int32(-1))
            ).toEqual(new BrsString(""));

            expect(
                Chr.call(interpreter, new Int32(0))
            ).toEqual(new BrsString(""));
        });

        it("converts an UTF-16 integer to character", () => {
            expect(
                Chr.call(interpreter, new Int32(34))
            ).toEqual(new BrsString("\""));

            expect(
                Chr.call(interpreter, new Int32(12359))
            ).toEqual(new BrsString("ぇ"));
        });
    });

    describe("Left", () => {
        it("get first n characters in a string longer than n characters", () => {
            expect(
                Left.call(interpreter, new BrsString("pineapple"), new Int32(4))
            ).toEqual(new BrsString("pine"));
        });

        it("get the original string back with n larger than string length", () => {
            expect(
                Left.call(interpreter, new BrsString("boy"), new Int32(5))
            ).toEqual(new BrsString("boy"));
        });

        it("get back empty string when character length is 0 or negative", () => {
            expect(
                Left.call(interpreter, new BrsString("apple"), new Int32(0))
            ).toEqual(new BrsString(""));

            expect(
                Left.call(interpreter, new BrsString("apple"), new Int32(-5))
            ).toEqual(new BrsString(""));
        });
    });

    describe("Right", () => {
        it("returns the last (n) characters from a string", () => {
            expect(
                Right.call(interpreter, new BrsString("pineapple"), new Int32(4))
            ).toEqual(new BrsString("pple"));
        });

        it("returns original string when (n) is longer than length", () => {
            expect(
                Right.call(interpreter, new BrsString("boy"), new Int32(5))
            ).toEqual(new BrsString("boy"));
        });

        it("returns an empty string", () => {
            expect(
                Right.call(interpreter, new BrsString("apple"), new Int32(0))
            ).toEqual(new BrsString(""));

            expect(
                Right.call(interpreter, new BrsString("apple"), new Int32(-5))
            ).toEqual(new BrsString(""));
        });
    });

    describe("Instr", () => {
        it("returns 0 if the string is not found", () => {
            expect(
                Instr.call(interpreter, new Int32(1), new BrsString("apple"), new BrsString("orange"))
            ).toEqual(new Int32(0));
        });

        it("returns the index of the first found string", () => {
            expect(
                Instr.call(interpreter, new Int32(1), new BrsString("apple"), new BrsString("a"))
            ).toEqual(new Int32(1));
        });

        it("returns the index of the first found after the starting index passed in", () => {
            expect(
                Instr.call(interpreter, new Int32(3), new BrsString("apple"), new BrsString("p"))
            ).toEqual(new Int32(3));
        });
    });

    describe("Len", () => {
       it("returns the length of the passed in string", () => {
           expect(
               Len.call(interpreter, new BrsString("abc"))
           ).toEqual(new Int32(3));
       });

       it("returns zero with an empty string", () => {
            expect(
                Len.call(interpreter, new BrsString(""))
            ).toEqual(new Int32(0));
       });
    });

    describe("Mid", () => {
        it("return the middle of a string", () => {
            expect(
                Mid.call(interpreter, new BrsString("abc"), new Int32(2), new Int32(1))
            ).toEqual(new BrsString("b"));
        });

        it("return the end of the string with only the position specified", () => {
            expect(
                Mid.call(interpreter, new BrsString("abc"), new Int32(2))
            ).toEqual(new BrsString("bc"));
        });
    });

    describe("Str", () => {
        it("returns a string from a positive float", () => {
            expect(
                Str.call(interpreter, new Float(3.4))
            ).toEqual(new BrsString(" 3.4"));
        });

        it("returns a string from a negative float", () => {
            expect(
                Str.call(interpreter, new Float(-3.5))
            ).toEqual(new BrsString("-3.5"));
        });

        it("returns a string from a zero float", () => {
            expect(
                Str.call(interpreter, new Float(0.0))
            ).toEqual(new BrsString("0"));
        });
    });

    describe("StrI", () => {
        it("returns a string from a positive integer", () => {
            expect(
                StrI.call(interpreter, new Int32(3))
            ).toEqual(new BrsString(" 3"));
        });

        it("returns a string from a negative integer", () => {
            expect(
                StrI.call(interpreter, new Int32(-3))
            ).toEqual(new BrsString("-3"));
        });

        it("returns a string from a zero integer", () => {
            expect(
                StrI.call(interpreter, new Int32(0))
            ).toEqual(new BrsString("0"));
        });

        it("returns an empty string for invalid radices", () => {
            expect(
                StrI.call(interpreter, new Int32(0), new Int32(1))
            ).toEqual(new BrsString(""));

            expect(
                StrI.call(interpreter, new Int32(0), new Int32(37))
            ).toEqual(new BrsString(""));
        })

        it("returns a string formatted by a radix", () => {
            expect(
                StrI.call(interpreter, new Int32(255), new Int32(16))
            ).toEqual(new BrsString("ff"));
        });
    });

    describe("Val", () => {
        it("returns a float from a positive decimal-formatted string", () => {
            expect(
                Val.call(interpreter, new BrsString("12.34"))
            ).toEqual(new Float(12.34));
        });

        it("returns a float from a negative decimal-formatted string", () => {
            expect(
                Val.call(interpreter, new BrsString("-32.34"))
            ).toEqual(new Float(-32.34));
        });

        it("returns a float from a zero decimal-formatted string", () => {
            expect(
                Val.call(interpreter, new BrsString("0.0"))
            ).toEqual(new Float(0.0));
        })

        it("returns an integer from a string an radix", () => {
            expect(
                Val.call(interpreter, new BrsString("7"), new Int32(10))
            ).toEqual(new Int32(7));

            expect(
                Val.call(interpreter, new BrsString("0x80"), new Int32(0))
            ).toEqual(new Int32(128));

            expect(
                Val.call(interpreter, new BrsString("FF"), new Int32(16))
            ).toEqual(new Int32(255));

            expect(
                Val.call(interpreter, new BrsString("1001"), new Int32(2))
            ).toEqual(new Int32(9));
        })
    });
});
