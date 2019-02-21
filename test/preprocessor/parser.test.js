const brs = require("brs");
const preprocessor = brs.preprocessor;
const { Lexeme } = brs.lexer;
const { BrsBoolean } = brs.types;

const { token, identifier, EOF } = require("../parser/ParserTests");

describe("preprocessor parser", () => {
    let parser;

    beforeEach(() => {
        parser = new preprocessor.Parser();
    });

    it("parses chunks of brightscript", () => {
        let { chunks, errors } = parser.parse([
            identifier("someFunction"),
            token(Lexeme.LeftParen, "("),
            token(Lexeme.RightParen, ")"),
            token(Lexeme.Newline, "\n"),
            token(Lexeme.Eof, "\0")
        ]);

        expect(errors).toEqual([]);
        expect(chunks).toBeDefined();
        expect(chunks).not.toBeNull();
        expect(chunks).toMatchSnapshot();
    });

    it("parses #const", () => {
        let { chunks, errors } = parser.parse([
            token(Lexeme.HashConst, "#const"),
            identifier("foo"),
            token(Lexeme.Equal, "="),
            token(Lexeme.True, "true", BrsBoolean.True),
            token(Lexeme.Newline, "\n"),
            token(Lexeme.Eof, "\0")
        ]);

        expect(errors).toEqual([]);
        expect(chunks).toBeDefined();
        expect(chunks).not.toBeNull();
        expect(chunks).toMatchSnapshot();
    });

    it("parses #error", () => {
        let { chunks, errors } = parser.parse([
            token(Lexeme.HashError, "#error"),
            token(Lexeme.HashErrorMessage, "I'm an error message!"),
            token(Lexeme.Eof, "\0")
        ]);

        expect(errors).toEqual([]);
        expect(chunks).toBeDefined();
        expect(chunks).not.toBeNull();
        expect(chunks).toMatchSnapshot();
    });

    describe("conditionals", () => {
        test("#if only", () => {
            let { chunks, errors } = parser.parse([
                token(Lexeme.HashIf, "#if"),
                identifier("foo"),
                token(Lexeme.Newline, "\n"),
                identifier("fooIsTrue"),
                token(Lexeme.LeftParen, "("),
                token(Lexeme.RightParen, ")"),
                token(Lexeme.Newline, "\n"),
                token(Lexeme.HashEndIf, "#endif"),
                token(Lexeme.Eof, "\0")
            ]);

            expect(errors).toEqual([]);
            expect(chunks).toBeDefined();
            expect(chunks).not.toBeNull();
            expect(chunks).toMatchSnapshot();
        });

        test("#if and #else", () => {
            let { chunks, errors } = parser.parse([
                token(Lexeme.HashIf, "#if"),
                identifier("foo"),
                token(Lexeme.Newline, "\n"),

                identifier("fooIsTrue"),
                token(Lexeme.LeftParen, "("),
                token(Lexeme.RightParen, ")"),
                token(Lexeme.Newline, "\n"),

                token(Lexeme.HashElse, "#else"),
                token(Lexeme.Newline, "\n"),

                identifier("fooIsFalse"),
                token(Lexeme.LeftParen, "("),
                token(Lexeme.RightParen, ")"),
                token(Lexeme.Newline, "\n"),

                token(Lexeme.HashEndIf, "#endif"),
                token(Lexeme.Eof, "\0")
            ]);

            expect(errors).toEqual([]);
            expect(chunks).toBeDefined();
            expect(chunks).not.toBeNull();
            expect(chunks).toMatchSnapshot();
        });

        test("#if #else if and #else", () => {
            let { chunks, errors } = parser.parse([
                token(Lexeme.HashIf, "#if"),
                identifier("foo"),
                token(Lexeme.Newline, "\n"),

                identifier("fooIsTrue"),
                token(Lexeme.LeftParen, "("),
                token(Lexeme.RightParen, ")"),
                token(Lexeme.Newline, "\n"),

                token(Lexeme.HashElseIf, "#elseif"),
                identifier("bar"),
                token(Lexeme.Newline, "\n"),

                identifier("bar"),
                token(Lexeme.LeftParen, "("),
                token(Lexeme.RightParen, ")"),
                token(Lexeme.Newline, "\n"),

                token(Lexeme.HashElse, "#else"),
                token(Lexeme.Newline, "\n"),

                identifier("neither"),
                token(Lexeme.LeftParen, "("),
                token(Lexeme.RightParen, ")"),
                token(Lexeme.Newline, "\n"),

                token(Lexeme.HashEndIf, "#endif"),
                token(Lexeme.Eof, "\0")
            ]);

            expect(errors).toEqual([]);
            expect(chunks).toBeDefined();
            expect(chunks).not.toBeNull();
            expect(chunks).toMatchSnapshot();
        });
    });
});
