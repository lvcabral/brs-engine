const brs = require("../../packages/node/bin/brs.node");
const { Interpreter, Lexeme, Expr, Stmt } = brs;
const { Int32, BrsString } = brs.types;

const { token, identifier, fakeLocation } = require("../parser/ParserTests");

const LEFT_SQUARE = token(Lexeme.LeftSquare, "[");
const RIGHT_SQUARE = token(Lexeme.RightSquare, "]");
const LEFT_BRACE = token(Lexeme.LeftBrace, "{");
const RIGHT_BRACE = token(Lexeme.RightBrace, "}");

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
                new Stmt.IndexedSet(
                    new Expr.Variable(identifier("array")),
                    [new Expr.Literal(new Int32(0), fakeLocation)],
                    new Expr.Literal(new BrsString("new index0"), fakeLocation),
                    RIGHT_SQUARE
                ),
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("result"),
                    new Expr.IndexedGet(
                        new Expr.Variable(identifier("array")),
                        [new Expr.Literal(new Int32(0), fakeLocation)],
                        RIGHT_SQUARE
                    )
                ),
            ];

            interpreter.exec(ast);

            expect(interpreter.environment.get(identifier("result"))).toEqual(new BrsString("new index0", true));
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
                new Stmt.IndexedSet(
                    new Expr.IndexedGet(
                        new Expr.Variable(identifier("array")),
                        [new Expr.Literal(new Int32(2), fakeLocation)],
                        RIGHT_SQUARE
                    ),
                    [new Expr.Literal(new Int32(1), fakeLocation)],
                    new Expr.Literal(new BrsString("new (2,1)"), fakeLocation),
                    RIGHT_SQUARE
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

            expect(interpreter.environment.get(identifier("result"))).toEqual(new BrsString("new (2,1)", true));
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
                                value: new Expr.Literal(new BrsString("foo's value"), fakeLocation),
                            },
                        ],
                        LEFT_BRACE,
                        RIGHT_BRACE
                    )
                ),
                new Stmt.DottedSet(
                    new Expr.Variable(identifier("aa")),
                    identifier("foo"),
                    new Expr.Literal(new BrsString("new foo"), fakeLocation)
                ),
                new Stmt.IndexedSet(
                    new Expr.Variable(identifier("aa")),
                    [new Expr.Literal(new BrsString("bar"), fakeLocation)],
                    new Expr.Literal(new BrsString("added bar"), fakeLocation),
                    RIGHT_BRACE
                ),
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("fooResult"),
                    new Expr.DottedGet(new Expr.Variable(identifier("aa")), identifier("foo"))
                ),
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("barResult"),
                    new Expr.DottedGet(new Expr.Variable(identifier("aa")), identifier("bar"))
                ),
            ];

            interpreter.exec(ast);

            expect(interpreter.environment.get(identifier("fooResult"))).toEqual(new BrsString("new foo", true));
            expect(interpreter.environment.get(identifier("barResult"))).toEqual(new BrsString("added bar", true));
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
                                            value: new Expr.Literal(new BrsString("original aa.foo.bar"), fakeLocation),
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
                new Stmt.DottedSet(
                    new Expr.IndexedGet(
                        new Expr.Variable(identifier("aa")),
                        [new Expr.Literal(new BrsString("foo"), fakeLocation)],
                        RIGHT_SQUARE
                    ),
                    identifier("bar"),
                    new Expr.Literal(new BrsString("new aa.foo.bar"), fakeLocation)
                ),
                new Stmt.IndexedSet(
                    new Expr.DottedGet(new Expr.Variable(identifier("aa")), identifier("foo")),
                    [new Expr.Literal(new BrsString("baz"), fakeLocation)],
                    new Expr.Literal(new BrsString("added aa.foo.baz"), fakeLocation),
                    RIGHT_SQUARE
                ),
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("barResult"),
                    new Expr.DottedGet(
                        new Expr.DottedGet(new Expr.Variable(identifier("aa")), identifier("foo")),
                        identifier("bar")
                    )
                ),
                new Stmt.Assignment(
                    { equals: token(Lexeme.Equals, "=") },
                    identifier("bazResult"),
                    new Expr.DottedGet(
                        new Expr.DottedGet(new Expr.Variable(identifier("aa")), identifier("foo")),
                        identifier("baz")
                    )
                ),
            ];

            interpreter.exec(ast);

            expect(interpreter.environment.get(identifier("barResult"))).toEqual(new BrsString("new aa.foo.bar", true));
            expect(interpreter.environment.get(identifier("bazResult"))).toEqual(
                new BrsString("added aa.foo.baz", true)
            );
        });
    });
});
