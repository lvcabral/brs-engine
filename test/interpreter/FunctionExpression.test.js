const brs = require("../../bin/brs.node");
const { Lexeme } = brs.lexer;
const { Expr, Stmt } = brs.parser;
const { Interpreter } = brs;
const { ValueKind } = brs.types;

const { token } = require("../parser/ParserTests");

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
                        right: token(Lexeme.RightParen),
                    },
                    new Expr.Function(
                        [],
                        ValueKind.Void,
                        emptyBlock,
                        token(Lexeme.Sub, "sub"),
                        token(Lexeme.EndSub, "end sub")
                    )
                ),
                token(Lexeme.RightParen, ")"),
                []
            ),
        ];

        interpreter.exec(statements);

        expect(emptyBlock.accept).toHaveBeenCalledTimes(1);
    });
});
