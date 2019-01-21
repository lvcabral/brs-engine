const { Lexeme, preprocessor, BrsTypes } = require("brs");
const { BrsBoolean } = BrsTypes;

describe("preprocessor parser", () => {
    let parser;

    beforeEach(() => {
        parser = new preprocessor.Parser();
    });

    it("parses chunks of brightscript", () => {
        let chunks = parser.parse([
            { kind: Lexeme.Identifier, text: "someFunction", line: 1, isReserved: false },
            { kind: Lexeme.LeftParen, text: "(", line: 1, isReserved: false },
            { kind: Lexeme.RightParen, text: ")", line: 1, isReserved: false },
            { kind: Lexeme.Newline, text: "\n", line: 1, isReserved: false },
            { kind: Lexeme.Eof, text: "\0", line: 2, isReserved: true }
        ]);

        expect(chunks).toBeDefined();
        expect(chunks).not.toBeNull();
        expect(chunks).toMatchSnapshot();
    });

    it("parses #const", () => {
        let chunks = parser.parse([
            { kind: Lexeme.HashConst, text: "#const", line: 1, isReserved: false },
            { kind: Lexeme.Identifier, text: "foo", line: 1, isReserved: false },
            { kind: Lexeme.Equal, text: "=", line: 1, isReserved: false },
            { kind: Lexeme.True, text: "true", literal: BrsBoolean.True, line: 1, isReserved: true },
            { kind: Lexeme.Newline, text: "\n", line: 1, isReserved: false },
            { kind: Lexeme.Eof, text: "\0", line: 1, isReserved: false }
        ]);

        expect(chunks).toBeDefined();
        expect(chunks).not.toBeNull();
        expect(chunks).toMatchSnapshot();
    });

    it("parses #error", () => {
        let chunks = parser.parse([
            { kind: Lexeme.HashError, text: "#error", line: 1, isReserved: false },
            { kind: Lexeme.HashErrorMessage, text: "I'm an error message!", line: 1, isReserved: false },
            { kind: Lexeme.Eof, text: "\0", line: 1, isReserved: true }
        ]);

        expect(chunks).toBeDefined();
        expect(chunks).not.toBeNull();
        expect(chunks).toMatchSnapshot();
    });

    describe("conditionals", () => {
        test("#if only", () => {
            let chunks = parser.parse([
                { kind: Lexeme.HashIf, text: "#if", line: 1, isReserved: false },
                { kind: Lexeme.Identifier, text: "foo", line: 1, isReserved: false },
                { kind: Lexeme.Newline, text: "\n", line: 1, isReserved: false },
                { kind: Lexeme.Identifier, text: "fooIsTrue", line: 2, isReserved: false },
                { kind: Lexeme.LeftParen, text: "(", line: 2, isReserved: false },
                { kind: Lexeme.RightParen, text: ")", line: 2, isReserved: false },
                { kind: Lexeme.Newline, text: "\n", line: 2, isReserved: false },
                { kind: Lexeme.HashEndIf, text: "#endif", line: 3, isReserved: false },
                { kind: Lexeme.Eof, text: "\0", line: 3, isReserved: false }
            ]);

            expect(chunks).toBeDefined();
            expect(chunks).not.toBeNull();
            expect(chunks).toMatchSnapshot();
        });

        test("#if and #else", () => {
            let chunks = parser.parse([
                { kind: Lexeme.HashIf, text: "#if", line: 1, isReserved: false },
                { kind: Lexeme.Identifier, text: "foo", line: 1, isReserved: false },
                { kind: Lexeme.Newline, text: "\n", line: 1, isReserved: false },

                { kind: Lexeme.Identifier, text: "fooIsTrue", line: 2, isReserved: false },
                { kind: Lexeme.LeftParen, text: "(", line: 2, isReserved: false },
                { kind: Lexeme.RightParen, text: ")", line: 2, isReserved: false },
                { kind: Lexeme.Newline, text: "\n", line: 2, isReserved: false },

                { kind: Lexeme.HashElse, text: "#else", line: 3, isReserved: false },
                { kind: Lexeme.Newline, text: "\n", line: 3, isReserved: false },

                { kind: Lexeme.Identifier, text: "fooIsFalse", line: 4, isReserved: false },
                { kind: Lexeme.LeftParen, text: "(", line: 4, isReserved: false },
                { kind: Lexeme.RightParen, text: ")", line: 4, isReserved: false },
                { kind: Lexeme.Newline, text: "\n", line: 4, isReserved: false },

                { kind: Lexeme.HashEndIf, text: "#endif", line: 5, isReserved: false },
                { kind: Lexeme.Eof, text: "\0", line: 5, isReserved: false }
            ]);

            expect(chunks).toBeDefined();
            expect(chunks).not.toBeNull();
            expect(chunks).toMatchSnapshot();
        });

        test("#if #else if and #else", () => {
            let chunks = parser.parse([
                { kind: Lexeme.HashIf, text: "#if", line: 1, isReserved: false },
                { kind: Lexeme.Identifier, text: "foo", line: 1, isReserved: false },
                { kind: Lexeme.Newline, text: "\n", line: 1, isReserved: false },

                { kind: Lexeme.Identifier, text: "fooIsTrue", line: 2, isReserved: false },
                { kind: Lexeme.LeftParen, text: "(", line: 2, isReserved: false },
                { kind: Lexeme.RightParen, text: ")", line: 2, isReserved: false },
                { kind: Lexeme.Newline, text: "\n", line: 2, isReserved: false },

                { kind: Lexeme.HashElseIf, text: "#elseif", line: 3, isReserved: false },
                { kind: Lexeme.Identifier, text: "bar", line: 3, isReserved: false },
                { kind: Lexeme.Newline, text: "\n", line: 3, isReserved: false },

                { kind: Lexeme.Identifier, text: "bar", line: 4, isReserved: false },
                { kind: Lexeme.LeftParen, text: "(", line: 4, isReserved: false },
                { kind: Lexeme.RightParen, text: ")", line: 4, isReserved: false },
                { kind: Lexeme.Newline, text: "\n", line: 4, isReserved: false },

                { kind: Lexeme.HashElse, text: "#else", line: 5, isReserved: false },
                { kind: Lexeme.Newline, text: "\n", line: 5, isReserved: false },

                { kind: Lexeme.Identifier, text: "neither", line: 6, isReserved: false },
                { kind: Lexeme.LeftParen, text: "(", line: 6, isReserved: false },
                { kind: Lexeme.RightParen, text: ")", line: 6, isReserved: false },
                { kind: Lexeme.Newline, text: "\n", line: 6, isReserved: false },

                { kind: Lexeme.HashEndIf, text: "#endif", line: 7, isReserved: false },
                { kind: Lexeme.Eof, text: "\0", line: 7, isReserved: false }
            ]);

            expect(chunks).toBeDefined();
            expect(chunks).not.toBeNull();
            expect(chunks).toMatchSnapshot();
        });
    });
});
