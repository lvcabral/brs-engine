const brs = require("brs");
const { Lexeme } = brs.lexer;
const { BrsBoolean } = brs.types;

const { token, identifier, EOF } = require("../ParserTests");

describe("parser boolean expressions", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    it("parses boolean ANDs", () => {
        let { statements, errors } = parser.parse([
            identifier("_"),
            token(Lexeme.Equal, "="),
            token(Lexeme.True, "true", BrsBoolean.True),
            token(Lexeme.And, "and"),
            token(Lexeme.False, "false", BrsBoolean.False),
            EOF
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("parses boolean ORs", () => {
        let { statements, errors } = parser.parse([
            identifier("_"),
            token(Lexeme.Equal, "="),
            token(Lexeme.True, "true", BrsBoolean.True),
            token(Lexeme.Or, "or"),
            token(Lexeme.False, "false", BrsBoolean.False),
            EOF
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    test("location tracking", () => {
        /**
         *    0   0   0   1   1   2
         *    0   4   8   2   6   0
         *  +----------------------
         * 1| a = true and false
         */
        let { statements, errors } = parser.parse([
            {
                kind: Lexeme.Identifier,
                text: "a",
                isReserved: false,
                location: {
                    start: { line: 1, column: 0 },
                    end: { line: 1, column: 1 },
                }
            },
            {
                kind: Lexeme.Equal,
                text: "=",
                isReserved: false,
                location: {
                    start: { line: 1, column: 2 },
                    end: { line: 1, column: 3 },
                }
            },
            {
                kind: Lexeme.True,
                text: "true",
                literal: BrsBoolean.True,
                isReserved: true,
                location: {
                    start: { line: 1, column: 4 },
                    end: { line: 1, column: 8 },
                }
            },
            {
                kind: Lexeme.And,
                text: "and",
                isReserved: true,
                location: {
                    start: { line: 1, column: 9 },
                    end: { line: 1, column: 12 },
                }
            },
            {
                kind: Lexeme.False,
                text: "false",
                literal: BrsBoolean.False,
                isReserved: true,
                location: {
                    start: { line: 1, column: 13 },
                    end: { line: 1, column: 18 },
                }
            },
            {
                kind: Lexeme.Eof,
                text: "\0",
                isReserved: false,
                location: {
                    start: { line: 1, column: 18 },
                    end: { line: 1, column: 19 }
                }
            }
        ]);

        expect(errors).toEqual([]);
        expect(statements.length).toBe(1);
        expect(statements[0].value.location).toEqual({
            start: { line: 1, column: 4 },
            end: { line: 1, column: 18 }
        });
    });
});
