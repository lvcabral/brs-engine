const brs = require("brs");
const { Lexeme } = brs.lexer;
const { Int32, BrsInvalid } = brs.types;

const { token, identifier, EOF } = require("../ParserTests");

describe("parser variable declarations", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    it("allows newlines before assignments", () => {
        let { statements, errors } = parser.parse([
            token(Lexeme.Newline),
            token(Lexeme.Newline),
            token(Lexeme.Newline),
            identifier("hasNewlines"),
            token(Lexeme.Equal),
            token(Lexeme.True),
            EOF
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
    });

    it("allows newlines after assignments", () => {
        let { statements, errors } = parser.parse([
            identifier("hasNewlines"),
            token(Lexeme.Equal),
            token(Lexeme.True),
            token(Lexeme.Newline),
            EOF
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
    });

    it("parses literal value assignments", () => {
        let { statements, errors } = parser.parse([
            identifier("foo"),
            token(Lexeme.Equal),
            token(Lexeme.Integer, "5", new Int32(5)),
            EOF
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("parses evaluated value assignments", () => {
        let { statements, errors } = parser.parse([
            identifier("bar"),
            token(Lexeme.Equal),
            token(Lexeme.Integer, "5", new Int32(5)),
            token(Lexeme.Caret),
            token(Lexeme.Integer, "3", new Int32(3)),
            EOF
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("parses variable aliasing", () => {
        let { statements, errors } = parser.parse([
            identifier("baz"),
            token(Lexeme.Equal),
            identifier("foo"),
            EOF
        ]);

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
         * 1| foo = invalid
         */
        let { statements, errors } = parser.parse([
            {
                kind: Lexeme.Identifier,
                text: "foo",
                isReserved: false,
                location: {
                    start: { line: 1, column: 0 },
                    end: { line: 1, column: 3 }
                }
            },
            {
                kind: Lexeme.Equal,
                text: "=",
                isReserved: false,
                location: {
                    start: { line: 1, column: 4 },
                    end: { line: 1, column: 5 }
                }
            },
            {
                kind: Lexeme.Invalid,
                text: "invalid",
                literal: BrsInvalid.Instance,
                isReserved: true,
                location: {
                    start: { line: 1, column: 6 },
                    end: { line: 1, column: 13 }
                }
            },
            {
                kind: Lexeme.Eof,
                text: "\0",
                isReserved: false,
                location: {
                    start: { line: 1, column: 13 },
                    end: { line: 1, column: 14 }
                }
            }
        ]);

        expect(errors).toEqual([]);
        expect(statements.length).toBe(1);
        expect(statements[0].location).toEqual({
            start: { line: 1, column: 0 },
            end: { line: 1, column: 13 }
        });
    });
});
