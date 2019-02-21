const brs = require("brs");
const { Lexeme } = brs.lexer;
const { Int32 } = brs.types;

const { token, identifier, EOF } = require("../ParserTests");

describe("parser indexing", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    describe("one level", () => {
        test("dotted", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                identifier("foo"),
                token(Lexeme.Dot, "."),
                identifier("bar"),
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        test("bracketed", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                identifier("foo"),
                token(Lexeme.LeftSquare, "["),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.RightSquare, "]"),
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        test("location tracking", () => {
            /**
             *    0   0   0   1
             *    0   4   8   2
             *  +--------------
             * 1| a = foo.bar
             * 2| b = foo[2]
             */
            let { statements, errors } = parser.parse([
                {
                    kind: Lexeme.Identifier,
                    text: "a",
                    isReserved: false,
                    location: {
                        start: { line: 1, column: 0 },
                        end: { line: 1, column: 1 }
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
                    kind: Lexeme.Identifier,
                    text: "foo",
                    isReserved: false,
                    location: {
                        start: { line: 1, column: 4 },
                        end: { line: 1, column: 7 }
                    }
                },
                {
                    kind: Lexeme.Dot,
                    text: ".",
                    isReserved: false,
                    location: {
                        start: { line: 1, column: 7 },
                        end: { line: 1, column: 8 },
                    }
                },
                {
                    kind: Lexeme.Identifier,
                    text: "bar",
                    isReserved: false,
                    location: {
                        start: { line: 1, column: 8 },
                        end: { line: 1, column: 11 }
                    }
                },
                {
                    kind: Lexeme.Newline,
                    text: "\n",
                    isReserved: false,
                    location: {
                        start: { line: 1, column: 11 },
                        end: { line: 1, column: 12 }
                    }
                },
                {
                    kind: Lexeme.Identifier,
                    text: "b",
                    isReserved: false,
                    location: {
                        start: { line: 2, column: 0 },
                        end: { line: 2, column: 1 }
                    }
                },
                {
                    kind: Lexeme.Equal,
                    text: "=",
                    isReserved: false,
                    location: {
                        start: { line: 2, column: 2 },
                        end: { line: 2, column: 3 },
                    }
                },
                {
                    kind: Lexeme.Identifier,
                    text: "bar",
                    isReserved: false,
                    location: {
                        start: { line: 2, column: 4 },
                        end: { line: 2, column: 7 }
                    }
                },
                {
                    kind: Lexeme.LeftSquare,
                    text: "[",
                    isReserved: false,
                    location: {
                        start: { line: 2, column: 7 },
                        end: { line: 2, column: 8 }
                    }
                },
                {
                    kind: Lexeme.Integer,
                    text: "2",
                    literal: new Int32(2),
                    isReserved: false,
                    location: {
                        start: { line: 2, column: 8 },
                        end: { line: 2, column: 9 }
                    }
                },
                {
                    kind: Lexeme.RightSquare,
                    text: "]",
                    isReserved: false,
                    location: {
                        start: { line: 2, column: 9 },
                        end: { line: 2, column: 10 }
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
            expect(statements.map(s => s.value.location)).toEqual([
                {
                    start: { line: 1, column: 4 },
                    end: { line: 1, column: 11 }
                },
                {
                    start: { line: 2, column: 4 },
                    end: { line: 2, column: 10 }
                }
            ]);
        });
    });

    describe("multi-level", () => {
        test("dotted", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                identifier("foo"),
                token(Lexeme.Dot, "."),
                identifier("bar"),
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        test("bracketed", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                identifier("foo"),
                token(Lexeme.LeftSquare, "["),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.RightSquare, "]"),
                token(Lexeme.LeftSquare, "["),
                token(Lexeme.Integer, "0", new Int32(0)),
                token(Lexeme.RightSquare, "]"),
                token(Lexeme.LeftSquare, "["),
                token(Lexeme.Integer, "6", new Int32(6)),
                token(Lexeme.RightSquare, "]"),
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        test("mixed", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                identifier("foo"),
                token(Lexeme.Dot, "."),
                identifier("bar"),
                token(Lexeme.LeftSquare, "["),
                token(Lexeme.Integer, "0", new Int32(0)),
                token(Lexeme.RightSquare, "]"),
                token(Lexeme.Dot, "."),
                identifier("baz"),
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });
    });
});
