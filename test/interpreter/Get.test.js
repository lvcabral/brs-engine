const brs = require("../../bin/brs.node");
const { Lexeme } = brs.lexer;
const { Expr, Stmt } = brs.parser;
const { Interpreter } = brs;
const { Int32, BrsString } = brs.types;

const { token, identifier, fakeLocation } = require("../parser/ParserTests");

let interpreter;

const LEFT_SQUARE = token(Lexeme.LeftSquare, "[");
const RIGHT_SQUARE = token(Lexeme.RightSquare, "]");
const LEFT_BRACE = token(Lexeme.LeftBrace, "{");
const RIGHT_BRACE = token(Lexeme.RightBrace, "}");

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
                    new Expr.ArrayLiteral(
                        [
                            new Expr.Literal(new BrsString("index0"), fakeLocation),
                            new Expr.Literal(new BrsString("index1"), fakeLocation),
                            new Expr.Literal(new BrsString("index2"), fakeLocation),
                        ],
                        LEFT_SQUARE,
                        RIGHT_SQUARE
                    )
                ),
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("result"),
                    new Expr.IndexedGet(
                        new Expr.Variable(identifier("array")),
                        [new Expr.Literal(new Int32(1), fakeLocation)],
                        RIGHT_SQUARE
                    )
                ),
            ];

            interpreter.exec(ast);

            expect(interpreter.environment.get(identifier("result"))).toEqual(
                new BrsString("index1", true)
            );
        });

        test("multi-dimensional", () => {
            let ast = [
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("array"),
                    new Expr.ArrayLiteral(
                        [
                            new Expr.ArrayLiteral(
                                [
                                    new Expr.Literal(new BrsString("(0,0)"), fakeLocation),
                                    new Expr.Literal(new BrsString("(0,1)"), fakeLocation),
                                    new Expr.Literal(new BrsString("(0,2)"), fakeLocation),
                                ],
                                LEFT_SQUARE,
                                RIGHT_SQUARE
                            ),
                            new Expr.ArrayLiteral(
                                [
                                    new Expr.Literal(new BrsString("(1,0)"), fakeLocation),
                                    new Expr.Literal(new BrsString("(1,1)"), fakeLocation),
                                    new Expr.Literal(new BrsString("(1,2)"), fakeLocation),
                                ],
                                LEFT_SQUARE,
                                RIGHT_SQUARE
                            ),
                            new Expr.ArrayLiteral(
                                [
                                    new Expr.Literal(new BrsString("(2,0)"), fakeLocation),
                                    new Expr.Literal(new BrsString("(2,1)"), fakeLocation),
                                    new Expr.Literal(new BrsString("(2,2)"), fakeLocation),
                                ],
                                LEFT_SQUARE,
                                RIGHT_SQUARE
                            ),
                        ],
                        LEFT_SQUARE,
                        RIGHT_SQUARE
                    )
                ),
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("result"),
                    new Expr.IndexedGet(
                        new Expr.IndexedGet(
                            new Expr.Variable(identifier("array")),
                            [new Expr.Literal(new Int32(2), fakeLocation)],
                            RIGHT_SQUARE
                        ),
                        [new Expr.Literal(new Int32(1), fakeLocation)],
                        RIGHT_SQUARE
                    )
                ),
            ];

            interpreter.exec(ast);

            expect(interpreter.environment.get(identifier("result"))).toEqual(
                new BrsString("(2,1)", true)
            );
        });
    });

    describe("associative arrays", () => {
        test("one-dimensional", () => {
            let ast = [
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("aa"),
                    new Expr.AALiteral(
                        [
                            {
                                name: new BrsString("foo"),
                                value: new Expr.Binary(
                                    new Expr.Literal(new BrsString("foo's "), fakeLocation),
                                    token(Lexeme.Plus, "+"),
                                    new Expr.Literal(new BrsString("value"), fakeLocation)
                                ),
                            },
                        ],
                        LEFT_BRACE,
                        RIGHT_BRACE
                    )
                ),
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("result"),
                    new Expr.DottedGet(new Expr.Variable(identifier("aa")), identifier("foo"))
                ),
            ];

            interpreter.exec(ast);

            expect(interpreter.environment.get(identifier("result"))).toEqual(
                new BrsString("foo's value", true)
            );
        });

        test("multi-dimensional", () => {
            let ast = [
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("aa"),
                    new Expr.AALiteral(
                        [
                            {
                                name: new BrsString("foo"),
                                value: new Expr.AALiteral(
                                    [
                                        {
                                            name: new BrsString("bar"),
                                            value: new Expr.Literal(
                                                new BrsString("aa.foo.bar's value"),
                                                fakeLocation
                                            ),
                                        },
                                    ],
                                    LEFT_BRACE,
                                    RIGHT_BRACE
                                ),
                            },
                        ],
                        LEFT_BRACE,
                        RIGHT_BRACE
                    )
                ),
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("result"),
                    new Expr.DottedGet(
                        new Expr.DottedGet(new Expr.Variable(identifier("aa")), identifier("foo")),
                        identifier("bar")
                    )
                ),
            ];

            interpreter.exec(ast);
            expect(interpreter.environment.get(identifier("result"))).toEqual(
                new BrsString("aa.foo.bar's value", true)
            );
        });
    });
});
