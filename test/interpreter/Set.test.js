const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { Interpreter } = require("../../lib/interpreter");
const brs = require("brs");
const { Lexeme } = brs.lexer;
const { Int32, BrsString } = brs.types;

const { token, identifier } = require("../parser/ParserTests");

let interpreter;

describe("property setting", () => {
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
                new Stmt.IndexedSet(
                    new Expr.Variable(identifier("array")),
                    new Expr.Literal(new Int32(0)),
                    new Expr.Literal(new BrsString("new index0")),
                    token(Lexeme.RightSquare, "]")
                ),
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("result"),
                    new Expr.IndexedGet(
                        new Expr.Variable(identifier("array")),
                        new Expr.Literal(new Int32(0)),
                        token(Lexeme.RightSquare, "]")
                    )
                )
            ];

            interpreter.exec(ast);

            expect(
                interpreter.environment.get(
                    identifier("result")
                )
            ).toEqual(new BrsString("new index0"));
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
                new Stmt.IndexedSet(
                    new Expr.IndexedGet(
                        new Expr.Variable(identifier("array")),
                        new Expr.Literal(new Int32(2)),
                    ),
                    new Expr.Literal(new Int32(1)),
                    new Expr.Literal(new BrsString("new (2,1)")),
                    token(Lexeme.RightSquare, "]")
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
            ).toEqual(new BrsString("new (2,1)"));
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
                            value: new Expr.Literal(new BrsString("foo's value")),
                        }
                    ])
                ),
                new Stmt.DottedSet(
                    new Expr.Variable(identifier("aa")),
                    identifier("foo"),
                    new Expr.Literal(new BrsString("new foo"))
                ),
                new Stmt.IndexedSet(
                    new Expr.Variable(identifier("aa")),
                    new Expr.Literal(new BrsString("bar")),
                    new Expr.Literal(new BrsString("added bar")),
                    token(Lexeme.RightSquare, "]")
                ),
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("fooResult"),
                    new Expr.DottedGet(
                        new Expr.Variable(identifier("aa")),
                        identifier("foo")
                    )
                ),
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("barResult"),
                    new Expr.DottedGet(
                        new Expr.Variable(identifier("aa")),
                        identifier("bar")
                    )
                )
            ];

            interpreter.exec(ast);

            expect(
                interpreter.environment.get(
                    identifier("fooResult")
                )
            ).toEqual(new BrsString("new foo"));
            expect(
                interpreter.environment.get(
                    identifier("barResult")
                )
            ).toEqual(new BrsString("added bar"));
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
                                    value: new Expr.Literal(new BrsString("original aa.foo.bar")),
                                }
                            ])
                        }
                    ])
                ),
                new Stmt.DottedSet(
                    new Expr.IndexedGet(
                        new Expr.Variable(identifier("aa")),
                        new Expr.Literal(new BrsString("foo")),
                        token(Lexeme.RightSquare, "]")
                    ),
                    identifier("bar"),
                    new Expr.Literal(new BrsString("new aa.foo.bar"))
                ),
                new Stmt.IndexedSet(
                    new Expr.DottedGet(
                        new Expr.Variable(identifier("aa")),
                        identifier("foo")
                    ),
                    new Expr.Literal(new BrsString("baz")),
                    new Expr.Literal(new BrsString("added aa.foo.baz")),
                    token(Lexeme.RightSquare, "]")
                ),
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("barResult"),
                    new Expr.DottedGet(
                        new Expr.DottedGet(
                            new Expr.Variable(identifier("aa")),
                            identifier("foo")
                        ),
                        identifier("bar")
                    )
                ),
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("bazResult"),
                    new Expr.DottedGet(
                        new Expr.DottedGet(
                            new Expr.Variable(identifier("aa")),
                            identifier("foo")
                        ),
                        identifier("baz")
                    )
                )
            ];

            interpreter.exec(ast);

            expect(
                interpreter.environment.get(
                    identifier("barResult")
                )
            ).toEqual(new BrsString("new aa.foo.bar"));
            expect(
                interpreter.environment.get(
                    identifier("bazResult")
                )
            ).toEqual(new BrsString("added aa.foo.baz"));
        });
    });
});