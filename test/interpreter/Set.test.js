const BrsError = require("../../lib/Error");
const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { Interpreter } = require("../../lib/interpreter");
const { Lexeme, BrsTypes } = require("brs");
const { Int32, BrsString } = BrsTypes;

let interpreter;

describe("property setting", () => {
    beforeEach(() => {
        BrsError.reset();
        interpreter = new Interpreter();
    });

    describe("arrays", () => {
        test("one-dimensional", () => {
            let ast = [
                new Stmt.Assignment(
                    { kind: Lexeme.Identifier, text: "array", line: 1 },
                    new Expr.ArrayLiteral([
                        new Expr.Literal(new BrsString("index0")),
                        new Expr.Literal(new BrsString("index1")),
                        new Expr.Literal(new BrsString("index2")),
                    ])
                ),
                new Stmt.Expression(
                    new Expr.IndexedSet(
                        new Expr.Variable({ kind: Lexeme.Identifier, text: "array", line: 2 }),
                        new Expr.Literal(new Int32(0)),
                        new Expr.Literal(new BrsString("new index0")),
                        { kind: Lexeme.RightSquare, text: "]", line: 2 }
                    )
                ),
                new Stmt.Assignment(
                    { kind: Lexeme.Identifier, text: "result", line: 3 },
                    new Expr.IndexedGet(
                        new Expr.Variable({ kind: Lexeme.Identifier, text: "array", line: 3 }),
                        new Expr.Literal(new Int32(0)),
                        { kind: Lexeme.RightSquare, text: "]", line: 3 }
                    )
                )
            ];

            interpreter.exec(ast);

            expect(BrsError.found()).toBe(false);
            expect(
                interpreter.environment.get(
                    { kind: Lexeme.Identifier, text: "result", line: -1 }
                )
            ).toEqual(new BrsString("new index0"));
        });

        test("multi-dimensional", () => {
            let ast = [
                new Stmt.Assignment(
                    { kind: Lexeme.Identifier, text: "array", line: 1 },
                    new Expr.ArrayLiteral([
                        new Expr.ArrayLiteral([
                            new Expr.Literal(new BrsString("(0,0)")),
                            new Expr.Literal(new BrsString("(0,1)")),
                            new Expr.Literal(new BrsString("(0,2)"))
                        ]),
                        new Expr.ArrayLiteral([
                            new Expr.Literal(new BrsString("(1,0)")),
                            new Expr.Literal(new BrsString("(1,1)")),
                            new Expr.Literal(new BrsString("(1,2)"))
                        ]),
                        new Expr.ArrayLiteral([
                            new Expr.Literal(new BrsString("(2,0)")),
                            new Expr.Literal(new BrsString("(2,1)")),
                            new Expr.Literal(new BrsString("(2,2)"))
                        ])
                    ])
                ),
                new Stmt.Expression(
                    new Expr.IndexedSet(
                        new Expr.IndexedGet(
                            new Expr.Variable({ kind: Lexeme.Identifier, text: "array", line: 2 }),
                            new Expr.Literal(new Int32(2)),
                        ),
                        new Expr.Literal(new Int32(1)),
                        new Expr.Literal(new BrsString("new (2,1)")),
                        { kind: Lexeme.RightSquare, text: "]", line: 2 }
                    )
                ),
                new Stmt.Assignment(
                    { kind: Lexeme.Identifier, text: "result", line: 3 },
                    new Expr.IndexedGet(
                        new Expr.IndexedGet(
                            new Expr.Variable({ kind: Lexeme.Identifier, text: "array", line: 2 }),
                            new Expr.Literal(new Int32(2)),
                            { kind: Lexeme.RightSquare, text: "]", line: 3 }
                        ),
                        new Expr.Literal(new Int32(1)),
                        { kind: Lexeme.RightSquare, text: "]", line: 3 }
                    )
                )
            ];

            interpreter.exec(ast);

            expect(BrsError.found()).toBe(false);
            expect(
                interpreter.environment.get(
                    { kind: Lexeme.Identifier, text: "result", line: -1 }
                )
            ).toEqual(new BrsString("new (2,1)"));
        });

    });
});