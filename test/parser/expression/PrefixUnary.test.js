const brs = require("brs");
const { Lexeme } = brs.lexer;
const { Int32, BrsBoolean } = brs.types;

const { token, identifier, EOF } = require("../ParserTests");

describe("parser prefix unary expressions", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    it("parses unary 'not'", () => {
        let { statements, errors } = parser.parse([
            identifier("_"),
            token(Lexeme.Equal, "="),
            token(Lexeme.Not, "not"),
            token(Lexeme.True, "true", BrsBoolean.True),
            EOF,
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("parses consecutive unary 'not'", () => {
        let { statements, errors } = parser.parse([
            identifier("_"),
            token(Lexeme.Equal, "="),
            token(Lexeme.Not, "not"),
            token(Lexeme.Not, "not"),
            token(Lexeme.Not, "not"),
            token(Lexeme.Not, "not"),
            token(Lexeme.Not, "not"),
            token(Lexeme.True, "true", BrsBoolean.True),
            EOF,
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("parses unary '-'", () => {
        let { statements, errors } = parser.parse([
            identifier("_"),
            token(Lexeme.Equal, "="),
            token(Lexeme.Minus, "-"),
            token(Lexeme.Integer, "5", new Int32(5)),
            EOF,
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("parses consecutive unary '-'", () => {
        let { statements, errors } = parser.parse([
            identifier("_"),
            token(Lexeme.Equal, "="),
            token(Lexeme.Minus, "-"),
            token(Lexeme.Minus, "-"),
            token(Lexeme.Minus, "-"),
            token(Lexeme.Minus, "-"),
            token(Lexeme.Minus, "-"),
            token(Lexeme.Integer, "5", new Int32(5)),
            EOF,
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("parses unary '+'", () => {
        let { statements, errors } = parser.parse([
            identifier("_"),
            token(Lexeme.Equal, "="),
            token(Lexeme.Plus, "+"),
            token(Lexeme.Integer, "5", new Int32(5)),
            EOF,
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("parses consecutive unary '+'", () => {
        let { statements, errors } = parser.parse([
            identifier("_"),
            token(Lexeme.Equal, "="),
            token(Lexeme.Plus, "+"),
            token(Lexeme.Plus, "+"),
            token(Lexeme.Plus, "+"),
            token(Lexeme.Plus, "+"),
            token(Lexeme.Plus, "+"),
            token(Lexeme.Integer, "5", new Int32(5)),
            EOF,
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("parses consecutive mixed unary operators", () => {
        let { statements, errors } = parser.parse([
            identifier("_"),
            token(Lexeme.Equal, "="),
            token(Lexeme.Plus, "-"),
            token(Lexeme.Plus, "+"),
            token(Lexeme.Plus, "-"),
            token(Lexeme.Plus, "+"),
            token(Lexeme.Plus, "-"),
            token(Lexeme.Plus, "+"),
            token(Lexeme.Integer, "5", new Int32(5)),
            EOF,
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
         * 1| _false = not true
         */
        let { statements, errors } = parser.parse([
            {
                kind: Lexeme.Identifier,
                text: "_false",
                isReserved: false,
                location: {
                    start: { line: 1, column: 0 },
                    end: { line: 1, column: 6 },
                },
            },
            {
                kind: Lexeme.Equal,
                text: "=",
                isReserved: false,
                location: {
                    start: { line: 1, column: 7 },
                    end: { line: 1, column: 8 },
                },
            },
            {
                kind: Lexeme.Not,
                text: "not",
                isReserved: true,
                location: {
                    start: { line: 1, column: 9 },
                    end: { line: 1, column: 12 },
                },
            },
            {
                kind: Lexeme.True,
                text: "true",
                literal: BrsBoolean.True,
                isReserved: true,
                location: {
                    start: { line: 1, column: 13 },
                    end: { line: 1, column: 17 },
                },
            },
            {
                kind: Lexeme.Eof,
                text: "\0",
                isReserved: false,
                location: {
                    start: { line: 1, column: 17 },
                    end: { line: 1, column: 18 },
                },
            },
        ]);

        expect(errors).toEqual([]);
        expect(statements.length).toBe(1);
        expect(statements[0].value.location).toEqual({
            start: { line: 1, column: 9 },
            end: { line: 1, column: 17 },
        });
    });
});
