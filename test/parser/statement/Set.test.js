const brs = require("brs");
const { Lexeme } = brs.lexer;
const { Int32 } = brs.types;

const { token, identifier, EOF } = require("../ParserTests");
describe("parser indexed assignment", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    it("assigns to dotted index", () => {
        let { statements, errors } = parser.parse([
            identifier("foo"),
            token(Lexeme.Dot, "."),
            identifier("bar"),
            token(Lexeme.Equal, "="),
            token(Lexeme.Function, "function"),
            token(Lexeme.LeftParen, "("),
            token(Lexeme.RightParen, ")"),
            token(Lexeme.Newline, "\\n"),
            token(Lexeme.EndFunction, "end function"),
            EOF
        ]);

        expect(errors).toEqual([])
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("assigns to bracketed index", () => {
        let { statements, errors } = parser.parse([
            identifier("someArray"),
            token(Lexeme.LeftSquare, "["),
            token(Lexeme.Integer, "0", new Int32(0)),
            token(Lexeme.RightSquare, "]"),
            token(Lexeme.Equal, "="),
            token(Lexeme.Function, "function"),
            token(Lexeme.LeftParen, "("),
            token(Lexeme.RightParen, ")"),
            token(Lexeme.Newline, "\\n"),
            token(Lexeme.EndFunction, "end function"),
            EOF
        ]);

        expect(errors).toEqual([])
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    test("location tracking", () => {
        /**
         *    0   0   0   1   1
         *    0   4   8   2   6
         *  +------------------
         * 1| arr[0] = 1
         * 2| obj.a = 5
         */
        let { statements, errors } = parser.parse([
            {
                kind: Lexeme.Identifier,
                text: "arr",
                isReserved: false,
                location: {
                    start: { line: 1, column: 0 },
                    end: { line: 1, column: 3 }
                }
            },
            {
                kind: Lexeme.LeftSquare,
                text: "[",
                isReserved: false,
                location: {
                    start: { line: 1, column: 3 },
                    end: { line: 1, column: 4 }
                }
            },
            {
                kind: Lexeme.Integer,
                text: "0",
                literal: new Int32(0),
                isReserved: false,
                location: {
                    start: { line: 1, column: 4 },
                    end: { line: 1, column: 5 }
                }
            },
            {
                kind: Lexeme.RightSquare,
                text: "]",
                isReserved: false,
                location: {
                    start: { line: 1, column: 5 },
                    end: { line: 1, column: 6 }
                }
            },
            {
                kind: Lexeme.Equal,
                text: "=",
                isReserved: false,
                location: {
                    start: { line: 1, column: 7 },
                    end: { line: 1, column: 8 }
                }
            },
            {
                kind: Lexeme.Integer,
                text: "1",
                literal: new Int32(1),
                isReserved: false,
                location: {
                    start: { line: 1, column: 9 },
                    end: { line: 1, column: 10}
                }
            },
            {
                kind: Lexeme.Newline,
                text: "\n",
                isReserved: false,
                location: {
                    start: { line: 1, column: 10 },
                    end: { line: 1, column: 11 }
                }
            },
            {
                kind: Lexeme.Identifier,
                text: "obj",
                isReserved: false,
                location: {
                    start: { line: 2, column: 0 },
                    end: { line: 2, column: 3 }
                }
            },
            {
                kind: Lexeme.Dot,
                text: ".",
                isReserved: false,
                location: {
                    start: { line: 2, column: 3 },
                    end: { line: 2, column: 4 }
                }
            },
            {
                kind: Lexeme.Identifier,
                text: "a",
                isReserved: false,
                location: {
                    start: { line: 2, column: 4 },
                    end: { line: 2, column: 5 }
                }
            },
            {
                kind: Lexeme.Equal,
                text: "=",
                isReserved: false,
                location: {
                    start: { line: 2, column: 6 },
                    end: { line: 2, column: 7 }
                }
            },
            {
                kind: Lexeme.Integer,
                text: "5",
                literal: new Int32(5),
                isReserved: false,
                location: {
                    start: { line: 2, column: 8 },
                    end: { line: 2, column: 9 }
                }
            },
            {
                kind: Lexeme.Eof,
                text: "\0",
                isReserved: false,
                location: {
                    start: { line: 2, column: 10 },
                    end: { line: 2, column: 11 }
                }
            }
        ]);

        expect(errors).toEqual([]);
        expect(statements.length).toBe(2);
        expect(statements.map(s => s.location)).toEqual([
            {
                start: { line: 1, column: 0 },
                end: { line: 1, column: 10 }
            },
            {
                start: { line: 2, column: 0 },
                end: { line: 2, column: 9 }
            }
        ]);
    });
});
