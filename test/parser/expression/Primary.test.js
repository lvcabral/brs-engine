const { Lexeme, BrsTypes, Parser } = require("brs");
const { Int32, BrsString } = BrsTypes;
const { Expr, Stmt } = Parser;
const BrsError = require("../../../lib/Error");

const { token, EOF } = require("../ParserTests");

describe("parser", () => {
    afterEach(() => BrsError.reset());

    describe("primary expressions", () => {
        it("parses literals", () => {
            let numeric = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: 5, literal: new Int32(5), line: 1 },
                EOF
            ]);
            expect(numeric).toEqual([
                new Stmt.Assignment(
                    { kind: Lexeme.Identifier, text: "_", line: 1 },
                    new Expr.Literal(
                        new Int32(5)
                    )
                )
            ]);
            expect(BrsError.found()).toBeFalsy();

            let parsedString = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.String, text: "hello", literal: new BrsString("hello"), line: 1 },
                EOF
            ]);
            expect(parsedString).toEqual([
                new Stmt.Assignment(
                    { kind: Lexeme.Identifier, text: "_", line: 1 },
                    new Expr.Literal(
                        new BrsString("hello")
                    )
                )
            ]);
            expect(BrsError.found()).toBeFalsy();
        });

        it("parses expressions in parentheses", () => {
            let withParens = Parser.parse([
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

            expect(BrsError.found()).toBeFalsy();
            expect(withParens).toBeDefined();
            expect(withParens).not.toBeNull();
            expect(withParens).toMatchSnapshot();
        });
    });
});
