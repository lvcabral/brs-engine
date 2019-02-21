const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { Interpreter } = require("../../lib/interpreter");
const brs = require("brs");
const { Lexeme } = brs.lexer;
const { BrsString, Int32, ValueKind } = brs.types;

const { token, identifier } = require("../parser/ParserTests");

let interpreter;

describe("interpreter calls", () => {
    beforeEach(() => {
        interpreter = new Interpreter();
    });

    it("calls functions", () => {
        const call = new Stmt.Expression(
            new Expr.Call(
                new Expr.Variable(identifier("UCase")),
                token(Lexeme.RightParen, ")"),
                [ new Expr.Literal(new BrsString("h@lL0")) ]
            )
        );
        const [ result ] = interpreter.exec([call]);
        expect(result.toString()).toBe("H@LL0");
    });

    it("sets a new `m` pointer when called from an associative array", () => {
        const ast = [
            new Stmt.Assignment(
                { equals: token(Lexeme.Equals, "=") },
                identifier("foo"),
                new Expr.AALiteral([
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
                                )
                            ])
                        )
                    }
                ])
            ),
            new Stmt.Expression(
                new Expr.Call(
                    new Expr.DottedGet(
                        new Expr.Variable(identifier("foo")),
                        identifier("setMId")
                    ),
                    token(Lexeme.RightParen, ")"),
                    [ ] // no args required
                )
            )
        ];

        interpreter.exec(ast);

        let foo = interpreter.environment.get(identifier("foo"));
        expect(foo.kind).toBe(ValueKind.Object);
        expect(
            foo.get(new BrsString("id"))
        ).toEqual(new BrsString("this is an ID"));
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
            new Expr.Call(
                new Expr.Variable(identifier("UCase")),
                token(Lexeme.RightParen, ")"),
                [
                    new Expr.Literal(new BrsString("h@lL0")),
                    new Expr.Literal(new BrsString("too many args")),
                ]
            )
        );

        expect(() => interpreter.exec([call])).toThrow(/UCase.*arguments/);
    });

    it("errors when argument types are incorrect", () => {
        const call = new Stmt.Expression(
            new Expr.Call(
                new Expr.Variable(identifier("UCase")),
                token(Lexeme.RightParen, ")"),
                [
                    new Expr.Literal(new Int32(5)),
                ]
            )
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
                                new Expr.Literal(new Int32(5))
                            )
                        ],
                        token(Lexeme.Newline, "\n")
                    )
                )
            ),
            new Stmt.Expression(
                new Expr.Call(
                    new Expr.Variable(identifier("foo")),
                    token(Lexeme.RightParen, ")"),
                    [] // no args required
                )
            )
        ];

        expect(() => interpreter.exec(ast)).toThrow(
            /Attempting to return value of type Integer, but function foo declares return value of type String/
        );
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
                                new Expr.Literal(new Int32(5))
                            )
                        ],
                        token(Lexeme.Newline, "\n")
                    )
                )
            ),
            new Stmt.Expression(
                new Expr.Call(
                    new Expr.Variable(identifier("foo")),
                    token(Lexeme.RightParen, ")"),
                    [] // no args required
                )
            )
        ];

        expect(() => interpreter.exec(ast)).toThrow(
            /Attempting to return value of non-void type/
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
                        [
                            new Stmt.Return(
                                { return: token(Lexeme.Return, "return") }
                            )
                        ],
                        token(Lexeme.Newline, "\n")
                    )
                )
            ),
            new Stmt.Expression(
                new Expr.Call(
                    new Expr.Variable(identifier("foo")),
                    token(Lexeme.RightParen, ")"),
                    [] // no args required
                )
            )
        ];

        expect(() => interpreter.exec(ast)).toThrow(
            /Attempting to return void value/
        );
    });
});
