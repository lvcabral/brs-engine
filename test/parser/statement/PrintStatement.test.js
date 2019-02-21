const brs = require("brs");
const { Lexeme } = brs.lexer;
const { BrsString } = brs.types;

const { token, EOF } = require("../ParserTests");

describe("parser print statements", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    it("parses singular print statements", () => {
        let { statements, errors } = parser.parse([
            token(Lexeme.Print),
            token(Lexeme.String, "Hello, world"),
            EOF
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("parses print lists with no separator", () => {
        let { statements, errors } = parser.parse([
            token(Lexeme.Print),
            token(Lexeme.String, "Foo", new BrsString("Foo")),
            token(Lexeme.String, "bar", new BrsString("bar")),
            token(Lexeme.String, "baz", new BrsString("baz")),
            EOF
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("parses print lists with separators", () => {
        let { statements, errors } = parser.parse([
            token(Lexeme.Print),
            token(Lexeme.String, "Foo", new BrsString("Foo")),
            token(Lexeme.Semicolon),
            token(Lexeme.String, "bar", new BrsString("bar")),
            token(Lexeme.Semicolon),
            token(Lexeme.String, "baz", new BrsString("baz")),
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
         * 1| print "foo"
         */
        let { statements, errors } = parser.parse([
            {
                kind: Lexeme.Print,
                text: "print",
                isReserved: true,
                location: {
                    start: { line: 1, column: 0 },
                    end: { line: 1, column: 5 }
                }
            },
            {
                kind: Lexeme.String,
                text: `"foo"`,
                literal: new BrsString("foo"),
                isReserved: false,
                location: {
                    start: { line: 1, column: 6 },
                    end: { line: 1, column: 11 }
                }
            },
            {
                kind: Lexeme.Eof,
                text: "\0",
                isReserved: false,
                location: {
                    start: { line: 1, column: 11 },
                    end: { line: 1, column: 12 }
                }
            }
        ]);

        expect(errors).toEqual([]);
        expect(statements.length).toBe(1);
        expect(statements[0].location).toEqual({
            start: { line: 1, column: 0 },
            end: { line: 1, column: 11 }
        });
    });
});
