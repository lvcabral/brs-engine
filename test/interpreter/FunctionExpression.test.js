const BrsError = require("../../lib/Error");
const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { Interpreter } = require("../../lib/interpreter");
const { Lexeme, BrsTypes } = require("brs");
const { ValueKind } = BrsTypes;

let interpreter;

describe("interpreter function expressions", () => {
    beforeEach(() => {
        BrsError.reset();

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
        expect(BrsError.found()).toBe(false);

        expect(emptyBlock.accept).toHaveBeenCalledTimes(1);
    });
});