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
                new Stmt.IndexedSet(
                    new Expr.Variable({ kind: Lexeme.Identifier, text: "array", line: 2 }),
                    new Expr.Literal(new Int32(0)),
                    new Expr.Literal(new BrsString("new index0")),
                    { kind: Lexeme.RightSquare, text: "]", line: 2 }
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
                new Stmt.IndexedSet(
                    new Expr.IndexedGet(
                        new Expr.Variable({ kind: Lexeme.Identifier, text: "array", line: 2 }),
                        new Expr.Literal(new Int32(2)),
                    ),
                    new Expr.Literal(new Int32(1)),
                    new Expr.Literal(new BrsString("new (2,1)")),
                    { kind: Lexeme.RightSquare, text: "]", line: 2 }
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

    describe("associative arrays", () => {
        test("one-dimensional", () => {
            let ast = [
                new Stmt.Assignment(
                    { kind: Lexeme.Identifier, text: "aa", line: 1 },
                    new Expr.AALiteral([
                        {
                            name: new BrsString("foo"),
                            value: new Expr.Literal(new BrsString("foo's value")),
                        }
                    ])
                ),
                new Stmt.DottedSet(
                    new Expr.Variable({ kind: Lexeme.Identifier, text: "aa", line: 2 }),
                    { kind: Lexeme.Identifier, text: "foo", line: 2 },
                    new Expr.Literal(new BrsString("new foo"))
                ),
                new Stmt.IndexedSet(
                    new Expr.Variable({ kind: Lexeme.Identifier, text: "aa", line: 3 }),
                    new Expr.Literal(new BrsString("bar")),
                    new Expr.Literal(new BrsString("added bar")),
                    { kind: Lexeme.RightSquare, text: "]", line: 3 }
                ),
                new Stmt.Assignment(
                    { kind: Lexeme.Identifier, text: "fooResult", line: 4 },
                    new Expr.DottedGet(
                        new Expr.Variable({ kind: Lexeme.Identifier, text: "aa", line: 4 }),
                        { kind: Lexeme.Identifier, text: "foo", line: 4 }
                    )
                ),
                new Stmt.Assignment(
                    { kind: Lexeme.Identifier, text: "barResult", line: 5 },
                    new Expr.DottedGet(
                        new Expr.Variable({ kind: Lexeme.Identifier, text: "aa", line: 5 }),
                        { kind: Lexeme.Identifier, text: "bar", line: 5 }
                    )
                )
            ];

            interpreter.exec(ast);

            expect(BrsError.found()).toBeFalsy();

            expect(
                interpreter.environment.get(
                    { kind: Lexeme.Identifier, text: "fooResult", line: -1 }
                )
            ).toEqual(new BrsString("new foo"));
            expect(
                interpreter.environment.get(
                    { kind: Lexeme.Identifier, text: "barResult", line: -1 }
                )
            ).toEqual(new BrsString("added bar"));
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
                                    value: new Expr.Literal(new BrsString("original aa.foo.bar")),
                                }
                            ])
                        }
                    ])
                ),
                new Stmt.DottedSet(
                    new Expr.IndexedGet(
                        new Expr.Variable({ kind: Lexeme.Identifier, text: "aa", line: 2 }),
                        new Expr.Literal(new BrsString("foo")),
                        { kind: Lexeme.RightSquare, text: "]", line: 2 }
                    ),
                    { kind: Lexeme.Identifier, text: "bar", line: 2 },
                    new Expr.Literal(new BrsString("new aa.foo.bar"))
                ),
                new Stmt.IndexedSet(
                    new Expr.DottedGet(
                        new Expr.Variable({ kind: Lexeme.Identifier, text: "aa", line: 3 }),
                        { kind: Lexeme.Identifier, text: "foo", line: 3 }
                    ),
                    new Expr.Literal(new BrsString("baz")),
                    new Expr.Literal(new BrsString("added aa.foo.baz")),
                    { kind: Lexeme.RightSquare, text: "]", line: 3 }
                ),
                new Stmt.Assignment(
                    { kind: Lexeme.Identifier, text: "barResult", line: 4 },
                    new Expr.DottedGet(
                        new Expr.DottedGet(
                            new Expr.Variable({ kind: Lexeme.Identifier, text: "aa", line: 4 }),
                            { kind: Lexeme.Identifier, text: "foo", line: 4 }
                        ),
                        { kind: Lexeme.Identifier, text: "bar", line: 4 }
                    )
                ),
                new Stmt.Assignment(
                    { kind: Lexeme.Identifier, text: "bazResult", line: 5 },
                    new Expr.DottedGet(
                        new Expr.DottedGet(
                            new Expr.Variable({ kind: Lexeme.Identifier, text: "aa", line: 5 }),
                            { kind: Lexeme.Identifier, text: "foo", line: 5 }
                        ),
                        { kind: Lexeme.Identifier, text: "baz", line: 5 }
                    )
                )
            ];

            interpreter.exec(ast);

            expect(BrsError.found()).toBeFalsy();

            expect(
                interpreter.environment.get(
                    { kind: Lexeme.Identifier, text: "barResult", line: -1 }
                )
            ).toEqual(new BrsString("new aa.foo.bar"));
            expect(
                interpreter.environment.get(
                    { kind: Lexeme.Identifier, text: "bazResult", line: -1 }
                )
            ).toEqual(new BrsString("added aa.foo.baz"));
        });
    });
});