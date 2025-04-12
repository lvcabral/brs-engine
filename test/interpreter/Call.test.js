const brs = require("../../bin/brs.node");
const { Lexeme } = brs.lexer;
const { Expr, Stmt } = brs.parser;
const { Interpreter } = brs;
const { BrsString, Int32, RoInt, ValueKind, BrsInvalid, RoInvalid } = brs.types;

const { token, identifier, fakeLocation } = require("../parser/ParserTests");

const FUNCTION = token(Lexeme.Function, "function");
const END_FUNCTION = token(Lexeme.EndFunction, "end function");

let interpreter;

describe("interpreter calls", () => {
    beforeEach(() => {
        interpreter = new Interpreter();
    });

    it("calls functions", () => {
        const call = new Stmt.Expression(
            new Expr.Call(new Expr.Variable(identifier("UCase")), token(Lexeme.RightParen, ")"), [
                new Expr.Literal(new BrsString("h@lL0"), fakeLocation),
            ])
        );
        const [result] = interpreter.exec([call]);
        expect(result.toString()).toBe("H@LL0");
    });

    it("sets a new `m` pointer when called from an associative array", () => {
        const ast = [
            new Stmt.Assignment(
                { equals: token(Lexeme.Equals, "=") },
                identifier("foo"),
                new Expr.AALiteral(
                    [
                        {
                            name: new BrsString("setMId"),
                            value: new Expr.Function(
                                [],
                                ValueKind.Void,
                                new Stmt.Block([
                                    new Stmt.DottedSet(
                                        new Expr.Variable(identifier("m")),
                                        identifier("id"),
                                        new Expr.Literal(new BrsString("this is an ID"))
                                    ),
                                ]),
                                FUNCTION,
                                END_FUNCTION
                            ),
                        },
                    ],
                    token(Lexeme.LeftBrace, "{"),
                    token(Lexeme.RightBrace, "}")
                )
            ),
            new Stmt.Expression(
                new Expr.Call(
                    new Expr.DottedGet(new Expr.Variable(identifier("foo")), identifier("setMId")),
                    token(Lexeme.RightParen, ")"),
                    [] // no args required
                )
            ),
        ];

        interpreter.exec(ast);

        let foo = interpreter.environment.get(identifier("foo"));
        expect(foo.kind).toBe(ValueKind.Object);
        expect(foo.get(new BrsString("id"))).toEqual(new BrsString("this is an ID", true));
    });

    it("automatically boxes return values when appropriate", () => {
        const ast = [
            new Stmt.Function(
                identifier("foo"),
                new Expr.Function(
                    [],
                    ValueKind.Object,
                    new Stmt.Block(
                        [
                            new Stmt.Return(
                                { return: token(Lexeme.Return, "return") },
                                new Expr.Literal(new Int32(5), fakeLocation)
                            ),
                        ],
                        token(Lexeme.Newline, "\n")
                    ),
                    FUNCTION,
                    END_FUNCTION
                )
            ),
            new Stmt.Assignment(
                { equals: token(Lexeme.Equals, "=") },
                identifier("result"),
                new Stmt.Expression(
                    new Expr.Call(
                        new Expr.Variable(identifier("foo")),
                        token(Lexeme.RightParen, ")"),
                        [] // no args required
                    )
                )
            ),
        ];

        interpreter.exec(ast);

        let result = interpreter.environment.get(identifier("result"));
        expect(result.kind).toBe(ValueKind.Object);
        expect(result.value).toEqual(new RoInt(new Int32(5)).value);
    });

    it("automatically boxes arguments when appropriate", () => {
        const ast = [
            new Stmt.Assignment(
                { equals: token(Lexeme.Equals, "=") },
                identifier("result"),
                new Stmt.Expression(
                    new Expr.Call(
                        new Expr.Variable(identifier("GetInterface")),
                        token(Lexeme.RightParen, ")"),
                        [
                            new Expr.Literal(new BrsString("primitive")), // brsString doesn't implement ifString, but roString does!
                            new Expr.Literal(new BrsString("ifString")),
                        ]
                    )
                )
            ),
        ];

        interpreter.exec(ast);

        let result = interpreter.environment.get(identifier("result"));
        expect(result.kind).toBe(ValueKind.Interface);
    });

    it("errors when not enough arguments provided", () => {
        const call = new Stmt.Expression(
            new Expr.Call(
                new Expr.Variable(identifier("UCase")),
                token(Lexeme.RightParen, ")"),
                [] // no arugments
            )
        );

        expect(() => interpreter.exec([call])).toThrow(/UCase.*arguments/);
    });

    it("errors when too many arguments are provided", () => {
        const call = new Stmt.Expression(
            new Expr.Call(new Expr.Variable(identifier("UCase")), token(Lexeme.RightParen, ")"), [
                new Expr.Literal(new BrsString("h@lL0")),
                new Expr.Literal(new BrsString("too many args")),
            ])
        );

        expect(() => interpreter.exec([call])).toThrow(/UCase.*arguments/);
    });

    it("errors when argument types are incorrect", () => {
        const call = new Stmt.Expression(
            new Expr.Call(new Expr.Variable(identifier("UCase")), token(Lexeme.RightParen, ")"), [
                new Expr.Literal(new Int32(5)),
            ])
        );

        expect(() => interpreter.exec([call])).toThrow(/Argument '.+' must be of type/);
    });

    it("errors when return types don't match", () => {
        const ast = [
            new Stmt.Function(
                identifier("foo"),
                new Expr.Function(
                    [],
                    ValueKind.String,
                    new Stmt.Block(
                        [
                            new Stmt.Return(
                                { return: token(Lexeme.Return, "return") },
                                new Expr.Literal(new Int32(5), fakeLocation)
                            ),
                        ],
                        token(Lexeme.Newline, "\n")
                    ),
                    FUNCTION,
                    END_FUNCTION
                )
            ),
            new Stmt.Expression(
                new Expr.Call(
                    new Expr.Variable(identifier("foo")),
                    token(Lexeme.RightParen, ")"),
                    [] // no args required
                )
            ),
        ];

        expect(() => interpreter.exec(ast)).toThrow("Type Mismatch.");
    });

    it("boxes invalid when return type is Object", () => {
        const ast = [
            new Stmt.Function(
                identifier("foo"),
                new Expr.Function(
                    [],
                    ValueKind.Object,
                    new Stmt.Block(
                        [
                            new Stmt.Return(
                                { return: token(Lexeme.Return, "return") },
                                new Expr.Literal(BrsInvalid.Instance, fakeLocation)
                            ),
                        ],
                        token(Lexeme.Newline, "\n")
                    ),
                    FUNCTION,
                    END_FUNCTION
                )
            ),
            new Stmt.Assignment(
                { equals: token(Lexeme.Equals, "=") },
                identifier("result"),
                new Stmt.Expression(
                    new Expr.Call(
                        new Expr.Variable(identifier("foo")),
                        token(Lexeme.RightParen, ")"),
                        [] // no args required
                    )
                )
            ),
        ];
        interpreter.exec(ast);
        let result = interpreter.environment.get(identifier("result"));
        expect(result.kind).toEqual(ValueKind.Object);
        expect(result.value).toEqual(new RoInvalid().value);
    });

    it("errors when returning from a void return", () => {
        const ast = [
            new Stmt.Function(
                identifier("foo"),
                new Expr.Function(
                    [],
                    ValueKind.Void,
                    new Stmt.Block(
                        [
                            new Stmt.Return(
                                { return: token(Lexeme.Return, "return") },
                                new Expr.Literal(new Int32(5), fakeLocation)
                            ),
                        ],
                        token(Lexeme.Newline, "\n")
                    ),
                    FUNCTION,
                    END_FUNCTION
                )
            ),
            new Stmt.Expression(
                new Expr.Call(
                    new Expr.Variable(identifier("foo")),
                    token(Lexeme.RightParen, ")"),
                    [] // no args required
                )
            ),
        ];

        expect(() => interpreter.exec(ast)).toThrow(
            /Return can not have a return-value if inside a Sub or Function with Void return type./
        );
    });

    it("errors when returning void from a non-void return", () => {
        const ast = [
            new Stmt.Function(
                identifier("foo"),
                new Expr.Function(
                    [],
                    ValueKind.String,
                    new Stmt.Block(
                        [new Stmt.Return({ return: token(Lexeme.Return, "return") })],
                        token(Lexeme.Newline, "\n")
                    ),
                    FUNCTION,
                    END_FUNCTION
                )
            ),
            new Stmt.Expression(
                new Expr.Call(
                    new Expr.Variable(identifier("foo")),
                    token(Lexeme.RightParen, ")"),
                    [] // no args required
                )
            ),
        ];

        expect(() => interpreter.exec(ast)).toThrow(/Return must return a value./);
    });
});
