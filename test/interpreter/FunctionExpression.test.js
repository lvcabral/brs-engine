const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { Interpreter } = require("../../lib/interpreter");
const brs = require("brs");
const { Lexeme } = brs.lexer;
const { ValueKind } = brs.types;

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
                    new Expr.Function(
                        [],
                        ValueKind.Void,
                        emptyBlock
                    )
                ),
                { kind: Lexeme.RightParen, text: ")", line: 2 },
                []
            )
        ];

        interpreter.exec(statements);

        expect(emptyBlock.accept).toHaveBeenCalledTimes(1);
    });
});