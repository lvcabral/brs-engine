const brs = require("../../bin/brs.node");
const { Lexeme } = brs.lexer;
const { Expr, Stmt } = brs.parser;
const { Interpreter } = brs;
const { Int32 } = brs.types;

const { token, identifier } = require("../parser/ParserTests");

let interpreter;
let decrementSpy;

describe("interpreter while loops", () => {
    const initializeFoo = new Stmt.Assignment(
        { equals: token(Lexeme.Equals, "=") },
        identifier("foo"),
        new Expr.Literal(new Int32(5))
    );

    const decrementFoo = new Stmt.Assignment(
        { equals: token(Lexeme.Equals, "=") },
        identifier("foo"),
        new Expr.Binary(new Expr.Variable(identifier("foo")), token(Lexeme.Minus, "-"), new Expr.Literal(new Int32(1)))
    );

    beforeEach(() => {
        decrementSpy = jest.spyOn(decrementFoo, "accept");

        interpreter = new Interpreter();
    });

    afterEach(() => {
        decrementSpy.mockReset();
        decrementSpy.mockRestore();
    });

    it("loops until 'condition' is false", () => {
        const statements = [
            initializeFoo,
            new Stmt.While(
                {
                    while: token(Lexeme.While, "while"),
                    endWhile: token(Lexeme.EndWhile, "end while"),
                },
                new Expr.Binary(
                    new Expr.Variable(identifier("foo")),
                    token(Lexeme.Greater, ">"),
                    new Expr.Literal(new Int32(0))
                ),
                new Stmt.Block([decrementFoo])
            ),
        ];

        interpreter.exec(statements);
        expect(decrementSpy).toHaveBeenCalledTimes(5);
    });

    it("evaluates 'condition' before every loop", () => {
        const greaterThanZero = new Expr.Binary(
            new Expr.Variable(identifier("foo")),
            token(Lexeme.Greater, ">"),
            new Expr.Literal(new Int32(0))
        );
        jest.spyOn(greaterThanZero, "accept");

        const statements = [
            initializeFoo,
            new Stmt.While(
                {
                    while: token(Lexeme.While, "while"),
                    endWhile: token(Lexeme.EndWhile, "end while"),
                },
                greaterThanZero,
                new Stmt.Block([decrementFoo])
            ),
        ];

        let results = interpreter.exec(statements);
        // body executes five times, but the condition is evaluated once more to know it should exit
        expect(greaterThanZero.accept).toHaveBeenCalledTimes(6);
    });

    it("exits early when it encounters 'exit while'", () => {
        const statements = [
            initializeFoo,
            new Stmt.While(
                {
                    while: token(Lexeme.While, "while"),
                    endWhile: token(Lexeme.EndWhile, "end while"),
                },
                new Expr.Binary(
                    new Expr.Variable(identifier("foo")),
                    token(Lexeme.Greater, ">"),
                    new Expr.Literal(new Int32(0))
                ),
                new Stmt.Block([decrementFoo, new Stmt.ExitWhile({ exitWhile: token(Lexeme.ExitWhile, "exit while") })])
            ),
        ];

        interpreter.exec(statements);
        expect(decrementSpy).toHaveBeenCalledTimes(1);
    });

    it("prevent exit early using 'continue while' skipping 'exit while'", () => {
        const statements = [
            initializeFoo,
            new Stmt.While(
                {
                    while: token(Lexeme.While, "while"),
                    endWhile: token(Lexeme.EndWhile, "end while"),
                },
                new Expr.Binary(
                    new Expr.Variable(identifier("foo")),
                    token(Lexeme.Greater, ">"),
                    new Expr.Literal(new Int32(0))
                ),
                new Stmt.Block([
                    decrementFoo,
                    new Stmt.ContinueWhile({
                        continueWhile: token(Lexeme.ContinueWhile, "continue while"),
                    }),
                    new Stmt.ExitWhile({ exitWhile: token(Lexeme.ExitWhile, "exit while") }),
                ])
            ),
        ];

        interpreter.exec(statements);
        expect(decrementSpy).toHaveBeenCalledTimes(5);
    });
});
