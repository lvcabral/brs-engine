const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { Interpreter } = require("../../lib/interpreter");
const brs = require("brs");
const { Lexeme } = brs.lexer;
const { ValueKind } = brs.types;

const { token, identifier } = require("../parser/ParserTests");

let interpreter;

describe("interpreter function expressions", () => {
    beforeEach(() => {
        interpreter = new Interpreter();
    });

    it("creates callable functions", () => {
        let emptyBlock = new Stmt.Block([]);
        jest.spyOn(emptyBlock, "accept");

        let statements = [
            new Expr.Call(
                new Expr.Grouping(
                    {
                        left: token(Lexeme.LeftParen),
                        right: token(Lexeme.RightParen)
                    },
                    new Expr.Function(
                        [],
                        ValueKind.Void,
                        emptyBlock
                    )
                ),
                token(Lexeme.RightParen, ")"),
                []
            )
        ];

        interpreter.exec(statements);

        expect(emptyBlock.accept).toHaveBeenCalledTimes(1);
    });
});