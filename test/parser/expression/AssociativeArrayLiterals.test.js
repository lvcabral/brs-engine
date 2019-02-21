const brs = require("brs");
const { Lexeme } = brs.lexer;
const { BrsString, Int32 } = brs.types;

const { token, identifier, EOF } = require("../ParserTests");

describe("parser associative array literals", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    describe("empty associative arrays", () => {
        test("on one line", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                token(Lexeme.LeftBrace, "{"),
                token(Lexeme.RightBrace, "}"),
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        test("on multiple lines", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                token(Lexeme.LeftBrace, "{"),
                token(Lexeme.Newline, "\n"),
                token(Lexeme.Newline, "\n"),
                token(Lexeme.Newline, "\n"),
                token(Lexeme.Newline, "\n"),
                token(Lexeme.Newline, "\n"),
                token(Lexeme.Newline, "\n"),
                token(Lexeme.RightBrace, "}"),
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });
    });

    describe("filled arrays", () => {
        test("on one line", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                token(Lexeme.LeftBrace, "{"),
                identifier("foo"),
                token(Lexeme.Colon, ":"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Comma, ","),
                identifier("bar"),
                token(Lexeme.Colon, ":"),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.Comma, ","),
                identifier("baz"),
                token(Lexeme.Colon, ":"),
                token(Lexeme.Integer, "3", new Int32(3)),
                token(Lexeme.RightBrace, "}"),
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        test("on multiple lines with commas", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                token(Lexeme.LeftBrace, "{"),
                token(Lexeme.Newline, "\n"),
                identifier("foo"),
                token(Lexeme.Colon, ":"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Comma, ","),
                token(Lexeme.Newline, "\n"),
                identifier("bar"),
                token(Lexeme.Colon, ":"),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.Comma, ","),
                token(Lexeme.Newline, "\n"),
                identifier("baz"),
                token(Lexeme.Colon, ":"),
                token(Lexeme.Integer, "3", new Int32(3)),
                token(Lexeme.Newline, "\n"),
                token(Lexeme.RightBrace, "}"),
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        test("on multiple lines without commas", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                token(Lexeme.LeftBrace, "{"),
                token(Lexeme.Newline, "\n"),
                identifier("foo"),
                token(Lexeme.Colon, ":"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Newline, "\n"),
                identifier("bar"),
                token(Lexeme.Colon, ":"),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.Newline, "\n"),
                identifier("baz"),
                token(Lexeme.Colon, ":"),
                token(Lexeme.Integer, "3", new Int32(3)),
                token(Lexeme.Newline, "\n"),
                token(Lexeme.RightBrace, "}"),
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });
    });

    it("allows a mix of quoted and unquoted keys", () => {
        let { statements, errors } = parser.parse([
            identifier("_"),
            token(Lexeme.Equal, "="),
            token(Lexeme.LeftBrace, "{"),
            token(Lexeme.Newline, "\n"),
            token(Lexeme.String, "foo", new BrsString("foo")),
            token(Lexeme.Colon, ":"),
            token(Lexeme.Integer, "1", new Int32(1)),
            token(Lexeme.Comma, ","),
            token(Lexeme.Newline, "\n"),
            identifier("bar"),
            token(Lexeme.Colon, ":"),
            token(Lexeme.Integer, "2", new Int32(2)),
            token(Lexeme.Comma, ","),
            token(Lexeme.Newline, "\n"),
            token(Lexeme.String, "requires-hyphens", new BrsString("requires-hypens")),
            token(Lexeme.Colon, ":"),
            token(Lexeme.Integer, "3", new Int32(3)),
            token(Lexeme.Newline, "\n"),
            token(Lexeme.RightBrace, "}"),
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
         * 1| a = {   }
         * 2|
         * 3| b = {
         * 4|
         * 5|
         * 6| }
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
                    end: { line: 1, column: 3 }
                }
            },
            {
                kind: Lexeme.LeftBrace,
                text: "{",
                isReserved: false,
                location: {
                    start: { line: 1, column: 4 },
                    end: { line: 1, column: 5 }

                }
            },
            {
                kind: Lexeme.RightBrace,
                text: "}",
                isReserved: false,
                location: {
                    start: { line: 1, column: 8 },
                    end: { line: 1, column: 9 }
                }
            },
            {
                kind: Lexeme.Newline,
                text: "\n",
                isReserved: false,
                location: {
                    start: { line: 1, column: 9 },
                    end: { line: 1, column: 10 },
                }
            },
            {
                kind: Lexeme.Newline,
                text: "\n",
                isReserved: false,
                location: {
                    start: { line: 2, column: 0 },
                    end: { line: 2, column: 1 },
                }
            },
            {
                kind: Lexeme.Identifier,
                text: "b",
                isReserved: false,
                location: {
                    start: { line: 3, column: 0 },
                    end: { line: 3, column: 1 }
                }
            },
            {
                kind: Lexeme.Equal,
                text: "=",
                isReserved: false,
                location: {
                    start: { line: 3, column: 2 },
                    end: { line: 3, column: 3 }
                }
            },
            {
                kind: Lexeme.LeftBrace,
                text: "{",
                isReserved: false,
                location: {
                    start: { line: 3, column: 4 },
                    end: { line: 3, column: 5 }

                }
            },
            {
                kind: Lexeme.Newline,
                text: "\n",
                isReserved: false,
                location: {
                    start: { line: 4, column: 0 },
                    end: { line: 4, column: 1 },
                }
            },
            {
                kind: Lexeme.Newline,
                text: "\n",
                isReserved: false,
                location: {
                    start: { line: 5, column: 0 },
                    end: { line: 5, column: 1 },
                }
            },
            {
                kind: Lexeme.RightBrace,
                text: "}",
                isReserved: false,
                location: {
                    start: { line: 6, column: 0 },
                    end: { line: 6, column: 1 }
                }
            },
            {
                kind: Lexeme.Eof,
                text: "\0",
                isReserved: false,
                location: {
                    start: { line: 6, column: 1 },
                    end: { line: 6, column: 2 }
                }
            }
        ]);

        expect(errors).toEqual([]);
        expect(statements.length).toEqual(2);
        expect(statements.map(s => s.value.location)).toEqual([
            {
                start: { line: 1, column: 4 },
                end: { line: 1, column: 9 }
            },
            {
                start: { line: 3, column: 4 },
                end: { line: 6, column: 1 }
            }
        ]);
    });
});
