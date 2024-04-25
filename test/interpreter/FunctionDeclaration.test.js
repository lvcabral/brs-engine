const brs = require("../../bin/brs.node");
const { Lexeme } = brs.lexer;
const { Expr, Stmt } = brs.parser;
const { Interpreter } = brs;
const { Int32, BrsString, BrsInvalid, Callable, ValueKind, StdlibArgument } = brs.types;

const { token, identifier } = require("../parser/ParserTests");

const FUNCTION = token(Lexeme.Function, "function");
const END_FUNCTION = token(Lexeme.EndFunction, "end function");

let interpreter;

describe("interpreter function declarations", () => {
    beforeEach(() => {
        interpreter = new Interpreter();
    });

    it("creates function callables", () => {
        let statements = [
            new Stmt.Function(
                identifier("foo"),
                new Expr.Function([], ValueKind.Void, new Stmt.Block([]), FUNCTION, END_FUNCTION)
            ),
        ];

        interpreter.exec(statements);

        let storedValue = interpreter.environment.get(identifier("foo"));
        expect(storedValue).not.toBe(BrsInvalid.Instance);
        expect(storedValue).toBeInstanceOf(Callable);
    });

    it("can call functions after definition", () => {
        let emptyBlock = new Stmt.Block([]);
        jest.spyOn(emptyBlock, "accept");

        let statements = [
            new Stmt.Function(
                identifier("foo"),
                new Expr.Function([], ValueKind.Void, emptyBlock, FUNCTION, END_FUNCTION)
            ),
            new Stmt.Expression(
                new Expr.Call(
                    new Expr.Variable(identifier("foo")),
                    token(Lexeme.RightParen, ")"),
                    []
                )
            ),
        ];

        interpreter.exec(statements);

        expect(emptyBlock.accept).toHaveBeenCalledTimes(1);
    });

    it("returns values", () => {
        let statements = [
            new Stmt.Function(
                identifier("foo"),
                new Expr.Function(
                    [],
                    ValueKind.String,
                    new Stmt.Block(
                        [
                            new Stmt.Return(
                                { return: token(Lexeme.Return, "return") },
                                new Expr.Literal(new BrsString("hello, world"))
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
                new Expr.Call(
                    new Expr.Variable(identifier("foo")),
                    token(Lexeme.RightParen, ")"),
                    []
                )
            ),
        ];

        interpreter.exec(statements);

        let storedResult = interpreter.environment.get(identifier("result"));
        expect(storedResult).toEqual(new BrsString("hello, world"));
    });

    it("evaluates default arguments", () => {
        let statements = [
            new Stmt.Function(
                identifier("ident"),
                new Expr.Function(
                    [new StdlibArgument("input", ValueKind.Int32, new Int32(-32))],
                    ValueKind.Int32,
                    new Stmt.Block([
                        new Stmt.Return(
                            { return: token(Lexeme.Return, "return") },
                            new Expr.Variable(identifier("input"))
                        ),
                    ]),
                    FUNCTION,
                    END_FUNCTION
                )
            ),
            new Stmt.Assignment(
                { equals: token(Lexeme.Equals, "=") },
                identifier("result"),
                new Expr.Call(
                    new Expr.Variable(identifier("ident")),
                    token(Lexeme.RightParen, ")"),
                    []
                )
            ),
        ];

        interpreter.exec(statements);

        let storedResult = interpreter.environment.get(identifier("result"));
        expect(storedResult).toEqual(new Int32(-32));

        expect(interpreter.environment.has(identifier("input"))).toBe(false);
    });

    it("enforces return value type checking", () => {
        let statements = [
            new Stmt.Function(
                identifier("foo"),
                new Expr.Function(
                    [],
                    ValueKind.Int32,
                    new Stmt.Block(
                        [
                            new Stmt.Return(
                                { return: token(Lexeme.Return, "return") },
                                new Expr.Literal(new BrsString("not a number"))
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
                new Expr.Call(
                    new Expr.Variable(identifier("foo")),
                    token(Lexeme.RightParen, ")"),
                    []
                )
            ),
        ];

        expect(() => interpreter.exec(statements)).toThrow("Type Mismatch.");
    });

    it("evaluates default arguments", () => {
        let statements = [
            new Stmt.Function(
                identifier("ident"),
                new Expr.Function(
                    [new StdlibArgument("input", ValueKind.Int32, new Int32(-32))],
                    ValueKind.Int32,
                    new Stmt.Block(
                        [
                            new Stmt.Return(
                                { return: token(Lexeme.Return, "return") },
                                new Expr.Variable(identifier("input"))
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
                new Expr.Call(
                    new Expr.Variable(identifier("ident")),
                    token(Lexeme.RightParen, ")"),
                    []
                )
            ),
        ];

        interpreter.exec(statements);

        let storedResult = interpreter.environment.get(identifier("result"));
        expect(storedResult).toEqual(new Int32(-32));

        expect(interpreter.environment.has(identifier("input"))).toBe(false);
    });

    it("disallows functions named after reserved words", () => {
        let statements = [
            new Stmt.Function(
                identifier("type"),
                new Expr.Function([], ValueKind.Void, new Stmt.Block([]), FUNCTION, END_FUNCTION)
            ),
        ];

        expect(() => interpreter.exec(statements)).toThrow(/reserved name/);
    });

    it("allows functions to override global stdlib functions", () => {
        let statements = [
            new Stmt.Function(
                identifier("UCase"),
                new Expr.Function(
                    [], // accepts no arguments
                    ValueKind.Void, // returns nothing
                    new Stmt.Block([]), // does nothing. It's a really silly function, but the implementation doesn't matter
                    FUNCTION,
                    END_FUNCTION
                )
            ),
        ];

        expect(() => interpreter.exec(statements)).not.toThrow();
    });

    it("automatically calls main()", () => {
        let mainBody = new Stmt.Block([]);
        jest.spyOn(mainBody, "accept");

        let statements = [
            new Stmt.Function(
                identifier("Main"),
                new Expr.Function(
                    [], // accepts no arguments
                    ValueKind.Void, // returns nothing
                    mainBody,
                    FUNCTION,
                    END_FUNCTION
                )
            ),
        ];

        expect(() => interpreter.exec(statements)).not.toThrow();
        expect(mainBody.accept).toHaveBeenCalledTimes(1);
    });
});
