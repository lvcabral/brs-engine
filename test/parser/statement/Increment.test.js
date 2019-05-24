const brs = require("brs");
const { Lexeme } = brs.lexer;
const { Int32, BrsBoolean } = brs.types;

const { token, identifier, EOF } = require("../ParserTests");

describe("parser postfix unary expressions", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    it("parses postfix '++' for variables", () => {
        let { statements, errors } = parser.parse([
            identifier("foo"),
            token(Lexeme.PlusPlus, "++"),
            EOF,
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("parses postfix '--' for dotted get expressions", () => {
        let { statements, errors } = parser.parse([
            identifier("obj"),
            token(Lexeme.Dot, "."),
            identifier("property"),
            token(Lexeme.MinusMinus, "--"),
            EOF,
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("parses postfix '++' for indexed get expressions", () => {
        let { statements, errors } = parser.parse([
            identifier("obj"),
            token(Lexeme.LeftSquare, "["),
            identifier("property"),
            token(Lexeme.RightSquare, "]"),
            token(Lexeme.PlusPlus, "++"),
            EOF,
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("disallows consecutive postfix operators", () => {
        let { errors } = parser.parse([
            identifier("foo"),
            token(Lexeme.PlusPlus, "++"),
            token(Lexeme.PlusPlus, "++"),
            EOF,
        ]);

        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatchObject({
            message: expect.stringMatching(
                "Consecutive increment/decrement operators are not allowed"
            ),
        });
    });

    it("disallows postfix '--' for function call results", () => {
        let { errors } = parser.parse([
            identifier("func"),
            token(Lexeme.LeftParen, "("),
            token(Lexeme.RightParen, ")"),
            token(Lexeme.MinusMinus, "--"),
            EOF,
        ]);

        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatchObject({
            message: expect.stringMatching(
                "Increment/decrement operators are not allowed on the result of a function call"
            ),
        });
    });

    it("allows '++' at the end of a function", () => {
        let { statements, errors } = parser.parse([
            token(Lexeme.Sub, "sub"),
            identifier("foo"),
            token(Lexeme.LeftParen, "("),
            token(Lexeme.RightParen, ")"),
            token(Lexeme.Newline, "\n"),
            identifier("someValue"),
            token(Lexeme.PlusPlus, "++"),
            token(Lexeme.Newline, "\n"),
            token(Lexeme.EndSub, "end sub"),
            EOF,
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
         * 1| someNumber++
         */
        let { statements, errors } = parser.parse([
            {
                kind: Lexeme.Identifier,
                text: "someNumber",
                isReserved: false,
                location: {
                    start: { line: 1, column: 0 },
                    end: { line: 1, column: 10 },
                },
            },
            {
                kind: Lexeme.PlusPlus,
                text: "++",
                isReserved: false,
                location: {
                    start: { line: 1, column: 10 },
                    end: { line: 1, column: 12 },
                },
            },
            {
                kind: Lexeme.Eof,
                text: "\0",
                isReserved: false,
                location: {
                    start: { line: 1, column: 12 },
                    end: { line: 1, column: 13 },
                },
            },
        ]);

        expect(errors).toEqual([]);
        expect(statements).toHaveLength(1);
        expect(statements[0].location).toMatchObject({
            start: { line: 1, column: 0 },
            end: { line: 1, column: 12 },
        });
    });
});
