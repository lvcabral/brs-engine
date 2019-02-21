const brs = require("brs");
const { Lexeme } = brs.lexer;
const { Int32, BrsString } = brs.types;

const { token, identifier, EOF } = require("../ParserTests");

describe("parser call expressions", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    it("parses named function calls", () => {
        const { statements, errors } = parser.parse([
            identifier("RebootSystem"),
            { kind: Lexeme.LeftParen,  text: "(", line: 1 },
            token(Lexeme.RightParen, ")"),
            EOF
        ]);

        expect(errors).toEqual([])
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("allows closing parentheses on separate line", () => {
        const { statements, errors } = parser.parse([
            identifier("RebootSystem"),
            { kind: Lexeme.LeftParen,  text: "(", line: 1 },
            token(Lexeme.Newline, "\\n"),
            token(Lexeme.Newline, "\\n"),
            token(Lexeme.RightParen, ")"),
            EOF
        ]);

        expect(errors).toEqual([])
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("accepts arguments", () => {
        const { statements, errors } = parser.parse([
            identifier("add"),
            { kind: Lexeme.LeftParen,  text: "(", line: 1 },
            token(Lexeme.Integer, "1", new Int32(1)),
            { kind: Lexeme.Comma,  text: ",", line: 1 },
            token(Lexeme.Integer, "2", new Int32(2)),
            token(Lexeme.RightParen, ")"),
            EOF
        ]);

        expect(errors).toEqual([])
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements[0].expression.args).toBeTruthy();
        expect(statements).toMatchSnapshot();
    });

    test("location tracking", () => {
        /**
         *    0   0   0   1   1   2
         *    0   4   8   2   6   0
         *  +----------------------
         * 1| foo("bar", "baz")
         */
        const { statements, errors } = parser.parse([
            {
                kind: Lexeme.Identifier,
                text: "foo",
                isReserved: false,
                location: {
                    start: { line: 1, column: 0 },
                    end: { line: 1, column: 3 },
                }
            },
            {
                kind: Lexeme.LeftParen,
                text: "(",
                isReserved: false,
                location: {
                    start: { line: 1, column: 3 },
                    end: { line: 1, column: 4 }
                }
            },
            {
                kind: Lexeme.String,
                text: `"bar"`,
                literal: new BrsString("bar"),
                isReserved: false,
                location: {
                    start: { line: 1, column: 4 },
                    end: { line: 1, column: 9 }
                }
            },
            {
                kind: Lexeme.Comma,
                text: ",",
                isReserved: false,
                location: {
                    start: { line: 1, column: 9 },
                    end: { line: 1, column: 10 }
                }
            },
            {
                kind: Lexeme.String,
                text: `"baz"`,
                literal: new BrsString("baz"),
                isReserved: false,
                location: {
                    start: { line: 1, column: 11 },
                    end: { line: 1, column: 16 }
                }
            },
            {
                kind: Lexeme.RightParen,
                text: ")",
                isReserved: false,
                location: {
                    start: { line: 1, column: 16 },
                    end: { line: 1, column: 17 }
                }
            },
            {
                kind: Lexeme.Eof,
                text: "\0",
                isReserved: false,
                location: {
                    start: { line: 1, column: 17 },
                    end: { line: 1, column: 18 }
                }
            }
        ]);

        expect(errors).toEqual([]);
        expect(statements.length).toBe(1);
        expect(statements[0].location).toEqual({
            start: { line: 1, column: 0 },
            end: { line: 1, column: 17 }
        });
    });
});
