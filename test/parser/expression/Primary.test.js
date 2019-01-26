const brs = require("brs");
const { Lexeme } = brs.lexer;
const { Int32, BrsString } = brs.types;
const { Expr, Stmt } = brs.parser;

const { EOF } = require("../ParserTests");

describe("parser", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    describe("primary expressions", () => {
        it("parses numeric literals", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: 5, literal: new Int32(5), line: 1 },
                EOF
            ]);
            expect(statements).toEqual([
                new Stmt.Assignment(
                    { kind: Lexeme.Identifier, text: "_", line: 1 },
                    new Expr.Literal(
                        new Int32(5)
                    )
                )
            ]);
            expect(errors).toEqual([]);
        });

        it("parses string literals", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.String, text: "hello", literal: new BrsString("hello"), line: 1 },
                EOF
            ]);
            expect(statements).toEqual([
                new Stmt.Assignment(
                    { kind: Lexeme.Identifier, text: "_", line: 1 },
                    new Expr.Literal(
                        new BrsString("hello")
                    )
                )
            ]);
            expect(errors).toEqual([]);
        });

        it("parses expressions in parentheses", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: "1", literal: new Int32(1), line: 1 },
                { kind: Lexeme.Plus, text: "+", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },
                { kind: Lexeme.Integer, text: "2", literal: new Int32(2), line: 1 },
                { kind: Lexeme.Star, text: "*", line: 1 },
                { kind: Lexeme.Integer, text: "3", literal: new Int32(3), line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });
    });
});
