const brs = require("brs");
const { Lexeme } = brs.lexer;
const { BrsBoolean, BrsString, Int32 } = brs.types;
const { token, identifier, EOF } = require("../ParserTests");

describe("parser while statements", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    test("while without exit", () => {
        const { statements, errors } = parser.parse([
            token(Lexeme.While, "while"),
            token(Lexeme.True, "true", BrsBoolean.True),
            token(Lexeme.Newline, "\n"),
            token(Lexeme.Print, "print"),
            token(Lexeme.String, "looping", new BrsString("looping")),
            token(Lexeme.Newline, "\n"),
            token(Lexeme.EndWhile, "end while"),
            EOF,
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    test("while with exit", () => {
        const { statements, errors } = parser.parse([
            token(Lexeme.While, "while"),
            token(Lexeme.True, "true", BrsBoolean.True),
            token(Lexeme.Newline, "\n"),
            token(Lexeme.Print, "print"),
            token(Lexeme.String, "looping", new BrsString("looping")),
            token(Lexeme.Newline, "\n"),
            token(Lexeme.ExitWhile, "exit while"),
            token(Lexeme.Newline, "\n"),
            token(Lexeme.EndWhile, "end while"),
            EOF,
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    test("nested", () => {
        const { tokens } = brs.lexer.Lexer.scan(
            `
            while i < 1000
                while j < 1000
                    while k < 1000 : k++ : end while
                    j++
                end while
                i++
            end while
            `
        );

        const { statements, errors } = parser.parse(tokens);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    test("location tracking", () => {
        /**
         *    0   0   0   1   1
         *    0   4   8   2   6
         *  +------------------
         * 1| while true
         * 2|   Rnd(0)
         * 3| end while
         */
        const { statements, errors } = parser.parse([
            {
                kind: Lexeme.While,
                text: "while",
                isReserved: true,
                location: {
                    start: { line: 1, column: 0 },
                    end: { line: 1, column: 5 },
                },
            },
            {
                kind: Lexeme.True,
                text: "true",
                literal: BrsBoolean.True,
                isReserved: true,
                location: {
                    start: { line: 1, column: 6 },
                    end: { line: 1, column: 10 },
                },
            },
            {
                kind: Lexeme.Newline,
                text: "\n",
                isReserved: false,
                location: {
                    start: { line: 1, column: 10 },
                    end: { line: 1, column: 11 },
                },
            },
            // loop body isn't significant for location tracking, so helper functions are safe
            identifier("Rnd"),
            token(Lexeme.LeftParen, "("),
            token(Lexeme.Integer, "0", new Int32(0)),
            token(Lexeme.RightParen, ")"),
            token(Lexeme.Newline, "\n"),

            {
                kind: Lexeme.EndWhile,
                text: "end while",
                isReserved: false,
                location: {
                    start: { line: 3, column: 0 },
                    end: { line: 3, column: 9 },
                },
            },
            EOF,
        ]);

        expect(errors).toEqual([]);
        expect(statements.length).toBe(1);
        expect(statements[0].location).toEqual({
            start: { line: 1, column: 0 },
            end: { line: 3, column: 9 },
        });
    });
});
