const brs = require("../../bin/brs.node");
const {
    UCase,
    LCase,
    Asc,
    Chr,
    Left,
    Right,
    Instr,
    Len,
    Mid,
    Str,
    StrI,
    Substitute,
    Val,
    StrToI,
    STRING,
    StringI,
} = brs.stdlib;
const { Interpreter } = brs;
const { BrsString, Int32, Float } = brs.types;

const interpreter = new Interpreter();

describe("global string functions", () => {
    describe("UCase", () => {
        it("converts a BRS string to its uppercase form", async () => {
            expect(await UCase.call(interpreter, new BrsString("l0rEm"))).toEqual(
                new BrsString("L0REM")
            );
        });
    });

    describe("LCase", () => {
        it("converts a BRS string to its lowercase form", async () => {
            expect(await LCase.call(interpreter, new BrsString("l0rEm"))).toEqual(
                new BrsString("l0rem")
            );
        });
    });

    describe("Asc", () => {
        it("converts an empty BRS string to zero", async () => {
            expect(await Asc.call(interpreter, new BrsString(""))).toEqual(new Int32(0));
        });

        it("converts a character to a UTF-16 representation", async () => {
            expect(await Asc.call(interpreter, new BrsString("for"))).toEqual(new Int32(102)); // UTF-16 decimal for "f"

            expect(await Asc.call(interpreter, new BrsString("ぇ"))).toEqual(new Int32(12359));
        });
    });

    describe("Chr", () => {
        it("converts a negative or zero to an empty string", async () => {
            expect(await Chr.call(interpreter, new Int32(-1))).toEqual(new BrsString(""));

            expect(await Chr.call(interpreter, new Int32(0))).toEqual(new BrsString(""));
        });

        it("converts an UTF-16 integer to character", async () => {
            expect(await Chr.call(interpreter, new Int32(34))).toEqual(new BrsString('"'));

            expect(await Chr.call(interpreter, new Int32(12359))).toEqual(new BrsString("ぇ"));
        });
    });

    describe("Left", () => {
        it("get first n characters in a string longer than n characters", async () => {
            expect(await Left.call(interpreter, new BrsString("pineapple"), new Int32(4))).toEqual(
                new BrsString("pine")
            );
        });

        it("get the original string back with n larger than string length", async () => {
            expect(await Left.call(interpreter, new BrsString("boy"), new Int32(5))).toEqual(
                new BrsString("boy")
            );
        });

        it("get back empty string when character length is 0 or negative", async () => {
            expect(await Left.call(interpreter, new BrsString("apple"), new Int32(0))).toEqual(
                new BrsString("")
            );

            expect(await Left.call(interpreter, new BrsString("apple"), new Int32(-5))).toEqual(
                new BrsString("")
            );
        });
    });

    describe("Right", () => {
        it("returns the last (n) characters from a string", async () => {
            expect(await Right.call(interpreter, new BrsString("pineapple"), new Int32(4))).toEqual(
                new BrsString("pple")
            );
        });

        it("returns original string when (n) is longer than length", async () => {
            expect(await Right.call(interpreter, new BrsString("boy"), new Int32(5))).toEqual(
                new BrsString("boy")
            );
        });

        it("returns an empty string", async () => {
            expect(await Right.call(interpreter, new BrsString("apple"), new Int32(0))).toEqual(
                new BrsString("")
            );

            expect(await Right.call(interpreter, new BrsString("apple"), new Int32(-5))).toEqual(
                new BrsString("")
            );
        });
    });

    describe("Instr", () => {
        it("returns 0 if the string is not found", async () => {
            expect(
                await Instr.call(
                    interpreter,
                    new Int32(1),
                    new BrsString("apple"),
                    new BrsString("orange")
                )
            ).toEqual(new Int32(0));
        });

        it("returns the index of the first found string", async () => {
            expect(
                await Instr.call(
                    interpreter,
                    new Int32(1),
                    new BrsString("apple"),
                    new BrsString("a")
                )
            ).toEqual(new Int32(1));
        });

        it("returns the index of the first found after the starting index passed in", async () => {
            expect(
                await Instr.call(
                    interpreter,
                    new Int32(3),
                    new BrsString("apple"),
                    new BrsString("p")
                )
            ).toEqual(new Int32(3));
        });
    });

    describe("Len", () => {
        it("returns the length of the passed in string", async () => {
            expect(await Len.call(interpreter, new BrsString("abc"))).toEqual(new Int32(3));
        });

        it("returns zero with an empty string", async () => {
            expect(await Len.call(interpreter, new BrsString(""))).toEqual(new Int32(0));
        });
    });

    describe("Mid", () => {
        it("return the middle of a string", async () => {
            expect(
                await Mid.call(interpreter, new BrsString("abc"), new Int32(2), new Int32(1))
            ).toEqual(new BrsString("b"));
        });

        it("return the end of the string with only the position specified", async () => {
            expect(await Mid.call(interpreter, new BrsString("abc"), new Int32(2))).toEqual(
                new BrsString("bc")
            );
        });
    });

    describe("Str", () => {
        it("returns a string from a positive float", async () => {
            expect(await Str.call(interpreter, new Float(3.4))).toEqual(new BrsString(" 3.4"));
        });

        it("returns a string from a negative float", async () => {
            expect(await Str.call(interpreter, new Float(-3.5))).toEqual(new BrsString("-3.5"));
        });

        it("returns a string from a zero float", async () => {
            expect(await Str.call(interpreter, new Float(0.0))).toEqual(new BrsString(" 0"));
        });
    });

    describe("StrI", () => {
        it("returns a string from a positive integer", async () => {
            expect(await StrI.call(interpreter, new Int32(3))).toEqual(new BrsString(" 3"));
        });

        it("returns a string from a negative integer", async () => {
            expect(await StrI.call(interpreter, new Int32(-3))).toEqual(new BrsString("-3"));
        });

        it("returns a string from a zero integer", async () => {
            expect(await StrI.call(interpreter, new Int32(0))).toEqual(new BrsString(" 0"));
        });

        it("returns an empty string for invalid radices", async () => {
            expect(await StrI.call(interpreter, new Int32(0), new Int32(1))).toEqual(
                new BrsString("")
            );

            expect(await StrI.call(interpreter, new Int32(0), new Int32(37))).toEqual(
                new BrsString("")
            );
        });

        it("returns a string formatted by a radix", async () => {
            expect(await StrI.call(interpreter, new Int32(255), new Int32(16))).toEqual(
                new BrsString("ff")
            );
        });
    });

    describe("String", () => {
        it("returns a string composed of n copies of a character.", async () => {
            expect(await STRING.call(interpreter, new Int32(5), new BrsString("*"))).toEqual(
                new BrsString("*****")
            );
        });

        it("returns a string composed of n copies of a string.", async () => {
            expect(await STRING.call(interpreter, new Int32(3), new BrsString("brs"))).toEqual(
                new BrsString("brsbrsbrs")
            );
        });

        it("returns a string composed of n copies of an empty string.", async () => {
            expect(await STRING.call(interpreter, new Int32(1000), new BrsString(""))).toEqual(
                new BrsString("")
            );
        });
    });

    describe("StringI", () => {
        it("returns a string composed of n copies of a character from an ASCII char code.", async () => {
            expect(await StringI.call(interpreter, new Int32(7), new Int32(48))).toEqual(
                new BrsString("0000000")
            );
        });

        it("returns a string composed of n copies of a character from a UNICODE char code.", async () => {
            expect(await StringI.call(interpreter, new Int32(3), new Int32(936))).toEqual(
                new BrsString("ΨΨΨ")
            );
        });
    });

    describe("Substitute", () => {
        it("returns no substitution", async () => {
            expect(
                await Substitute.call(interpreter, new BrsString("Barry"), new BrsString("Mary"))
            ).toEqual(new BrsString("Barry"));
        });

        it("returns a single substitution", async () => {
            expect(
                await Substitute.call(
                    interpreter,
                    new BrsString("{0} is her name"),
                    new BrsString("Mary")
                )
            ).toEqual(new BrsString("Mary is her name"));

            expect(
                await Substitute.call(interpreter, new BrsString("{0}"), new BrsString(""))
            ).toEqual(new BrsString(""));
        });

        it("returns a bunch of substitutions", async () => {
            expect(
                await Substitute.call(
                    interpreter,
                    new BrsString("quick test: {0} {1} {2} {3}"),
                    new BrsString("harry"),
                    new BrsString("ron"),
                    new BrsString("hermione"),
                    new BrsString("dumbledore")
                )
            ).toEqual(new BrsString("quick test: harry ron hermione dumbledore"));
        });

        it("replaces multiple instances", async () => {
            expect(
                await Substitute.call(
                    interpreter,
                    new BrsString("{0} picked up {1}'s ball and gave it back to {1}"),
                    new BrsString("Greg"),
                    new BrsString("Mary")
                )
            ).toEqual(new BrsString("Greg picked up Mary's ball and gave it back to Mary"));
        });

        it("ignores partial tokens", async () => {
            expect(
                await Substitute.call(
                    interpreter,
                    new BrsString("{0 {1} 2}"),
                    new BrsString("Frank"),
                    new BrsString("Jane"),
                    new BrsString("Olga")
                )
            ).toEqual(new BrsString("{0 Jane 2}"));
        });
    });

    describe("Val", () => {
        it("returns a float from a positive decimal-formatted string", async () => {
            expect(await Val.call(interpreter, new BrsString("12.34"))).toEqual(new Float(12.34));
        });

        it("returns a float from a negative decimal-formatted string", async () => {
            expect(await Val.call(interpreter, new BrsString("-32.34"))).toEqual(new Float(-32.34));
        });

        it("returns a float from a zero decimal-formatted string", async () => {
            expect(await Val.call(interpreter, new BrsString("0.0"))).toEqual(new Float(0.0));
        });

        it("returns zero if the string is not a number", async () => {
            expect(await Val.call(interpreter, new BrsString(""))).toEqual(new Int32(0));

            expect(await Val.call(interpreter, new BrsString("Not a Number"))).toEqual(
                new Int32(0)
            );

            expect(await Val.call(interpreter, new BrsString("10+2"))).toEqual(new Int32(0));
        });

        it("returns an integer from a string", async () => {
            expect(await Val.call(interpreter, new BrsString("65535"))).toEqual(new Int32(65535));

            expect(await Val.call(interpreter, new BrsString("0xFA"))).toEqual(new Int32(250));
        });

        it("returns an integer from a string and radix", async () => {
            expect(await Val.call(interpreter, new BrsString("7"), new Int32(10))).toEqual(
                new Int32(7)
            );

            expect(await Val.call(interpreter, new BrsString("0x80"), new Int32(0))).toEqual(
                new Int32(128)
            );

            expect(await Val.call(interpreter, new BrsString("FF"), new Int32(16))).toEqual(
                new Int32(255)
            );

            expect(await Val.call(interpreter, new BrsString("1001"), new Int32(2))).toEqual(
                new Int32(9)
            );
        });
    });

    describe("StrToI", () => {
        it("returns an integer from a positive string", async () => {
            expect(await StrToI.call(interpreter, new BrsString("125"))).toEqual(new Int32(125));
        });

        it("returns an integer from a negative string", async () => {
            expect(await StrToI.call(interpreter, new BrsString("-16"))).toEqual(new Int32(-16));
        });

        it("returns an integer from a decimal-formatted string", async () => {
            expect(await StrToI.call(interpreter, new BrsString("65.47"))).toEqual(new Int32(65));
        });

        it("returns 0 if the parsed string is NaN", async () => {
            expect(await StrToI.call(interpreter, new BrsString("hola"))).toEqual(new Int32(0));
        });
    });
});
