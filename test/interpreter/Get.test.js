const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { Interpreter } = require("../../lib/interpreter");
const { Lexeme, BrsTypes } = require("brs");
const { Int32, BrsString } = BrsTypes;

let interpreter;

describe("property getting", () => {
    beforeEach(() => {
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
                new Stmt.Assignment(
                    { kind: Lexeme.Identifier, text: "result", line: 2 },
                    new Expr.IndexedGet(
                        new Expr.Variable({ kind: Lexeme.Identifier, text: "array", line: 2 }),
                        new Expr.Literal(new Int32(1)),
                        { kind: Lexeme.RightSquare, text: "]", line: 2 }
                    )
                )
            ];

            interpreter.exec(ast);

            expect(
                interpreter.environment.get(
                    { kind: Lexeme.Identifier, text: "result", line: -1 }
                )
            ).toEqual(new BrsString("index1"));
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
                new Stmt.Assignment(
                    { kind: Lexeme.Identifier, text: "result", line: 2 },
                    new Expr.IndexedGet(
                        new Expr.IndexedGet(
                            new Expr.Variable({ kind: Lexeme.Identifier, text: "array", line: 2 }),
                            new Expr.Literal(new Int32(2)),
                            { kind: Lexeme.RightSquare, text: "]", line: 2 }
                        ),
                        new Expr.Literal(new Int32(1)),
                        { kind: Lexeme.RightSquare, text: "]", line: 2 }
                    )
                )
            ];

            interpreter.exec(ast);

            expect(
                interpreter.environment.get(
                    { kind: Lexeme.Identifier, text: "result", line: -1 }
                )
            ).toEqual(new BrsString("(2,1)"));
        });
    });

    describe("associative arrays", () => {
        test("one-dimensional", () => {
            let ast = [
                new Stmt.Assignment(
                    { kind: Lexeme.Identifier, text: "aa", line: 1 },
                    new Expr.AALiteral([
                        {
                            name: new BrsString("foo"),
                            value: new Expr.Binary(
                                new Expr.Literal(new BrsString("foo's ")),
                                { kind: Lexeme.Plus, text: "+", line: 1 },
                                new Expr.Literal(new BrsString("value"))
                            )
                        }
                    ])
                ),
                new Stmt.Assignment(
                    { kind: Lexeme.Identifier, text: "result", line: 2 },
                    new Expr.DottedGet(
                        new Expr.Variable({ kind: Lexeme.Identifier, text: "aa", line: 2 }),
                        { kind: Lexeme.Identifier, text: "foo", line: 2 }
                    )
                )
            ];

            interpreter.exec(ast);

            expect(
                interpreter.environment.get(
                    { kind: Lexeme.Identifier, text: "result", line: -1 }
                )
            ).toEqual(new BrsString("foo's value"));
        });

        test("multi-dimensional", () => {
            let ast = [
                new Stmt.Assignment(
                    { kind: Lexeme.Identifier, text: "aa", line: 1 },
                    new Expr.AALiteral([
                        {
                            name: new BrsString("foo"),
                            value: new Expr.AALiteral([
                                {
                                    name: new BrsString("bar"),
                                    value: new Expr.Literal(new BrsString("aa.foo.bar's value"))
                                }
                            ])
                        }
                    ])
                ),
                new Stmt.Assignment(
                    { kind: Lexeme.Identifier, text: "result", line: 2 },
                    new Expr.DottedGet(
                        new Expr.DottedGet(
                            new Expr.Variable({ kind: Lexeme.Identifier, text: "aa", line: 2 }),
                            { kind: Lexeme.Identifier, text: "foo", line: 2 }
                        ),
                        { kind: Lexeme.Identifier, text: "bar", line: 2 }
                    )
                )
            ];

            interpreter.exec(ast);
            expect(
                interpreter.environment.get(
                    { kind: Lexeme.Identifier, text: "result", line: -1 }
                )
            ).toEqual(new BrsString("aa.foo.bar's value"));
        });
    });
});