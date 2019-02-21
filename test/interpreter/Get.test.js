const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { Interpreter } = require("../../lib/interpreter");
const brs = require("brs");
const { Lexeme } = brs.lexer;
const { Int32, BrsString } = brs.types;

const { token, identifier } = require("../parser/ParserTests");

let interpreter;

describe("property getting", () => {
    beforeEach(() => {
        interpreter = new Interpreter();
    });

    describe("arrays", () => {
        test("one-dimensional", () => {
            let ast = [
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("array"),
                    new Expr.ArrayLiteral([
                        new Expr.Literal(new BrsString("index0")),
                        new Expr.Literal(new BrsString("index1")),
                        new Expr.Literal(new BrsString("index2")),
                    ])
                ),
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("result"),
                    new Expr.IndexedGet(
                        new Expr.Variable(identifier("array")),
                        new Expr.Literal(new Int32(1)),
                        token(Lexeme.RightSquare, "]")
                    )
                )
            ];

            interpreter.exec(ast);

            expect(
                interpreter.environment.get(
                    identifier("result")
                )
            ).toEqual(new BrsString("index1"));
        });

        test("multi-dimensional", () => {
            let ast = [
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("array"),
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
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("result"),
                    new Expr.IndexedGet(
                        new Expr.IndexedGet(
                            new Expr.Variable(identifier("array")),
                            new Expr.Literal(new Int32(2)),
                            token(Lexeme.RightSquare, "]")
                        ),
                        new Expr.Literal(new Int32(1)),
                        token(Lexeme.RightSquare, "]")
                    )
                )
            ];

            interpreter.exec(ast);

            expect(
                interpreter.environment.get(
                    identifier("result")
                )
            ).toEqual(new BrsString("(2,1)"));
        });
    });

    describe("associative arrays", () => {
        test("one-dimensional", () => {
            let ast = [
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("aa"),
                    new Expr.AALiteral([
                        {
                            name: new BrsString("foo"),
                            value: new Expr.Binary(
                                new Expr.Literal(new BrsString("foo's ")),
                                token(Lexeme.Plus, "+"),
                                new Expr.Literal(new BrsString("value"))
                            )
                        }
                    ])
                ),
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("result"),
                    new Expr.DottedGet(
                        new Expr.Variable(identifier("aa")),
                        identifier("foo")
                    )
                )
            ];

            interpreter.exec(ast);

            expect(
                interpreter.environment.get(
                    identifier("result")
                )
            ).toEqual(new BrsString("foo's value"));
        });

        test("multi-dimensional", () => {
            let ast = [
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("aa"),
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
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("result"),
                    new Expr.DottedGet(
                        new Expr.DottedGet(
                            new Expr.Variable(identifier("aa")),
                            identifier("foo")
                        ),
                        identifier("bar")
                    )
                )
            ];

            interpreter.exec(ast);
            expect(
                interpreter.environment.get(
                    identifier("result")
                )
            ).toEqual(new BrsString("aa.foo.bar's value"));
        });
    });
});