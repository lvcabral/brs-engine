const brs = require("../../bin/brs.node");
const { Lexeme } = brs.lexer;
const { Expr, Stmt } = brs.parser;
const { Interpreter } = brs;
const { Int32 } = brs.types;

const { token, identifier } = require("../parser/ParserTests");

let interpreter;

describe("interpreter for loops", () => {
    const initializeCounter = new Stmt.Assignment(
        { equals: token(Lexeme.Equals, "=") },
        identifier("i"),
        new Expr.Literal(new Int32(0))
    );

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        jest.resetAllMocks();
        jest.restoreAllMocks();
    });

    it("initializes the counter variable", () => {
        const counterSpy = jest.spyOn(initializeCounter, "accept");

        const statements = [
            new Stmt.For(
                {
                    for: token(Lexeme.For, "for"),
                    to: token(Lexeme.To, "to"),
                    endFor: token(Lexeme.EndFor, "end for"),
                },
                initializeCounter,
                /* final value */ new Expr.Literal(new Int32(5)),
                /* step */ new Expr.Literal(new Int32(1)),
                /* body */ new Stmt.Block([])
            ),
        ];

        interpreter.exec(statements);
        expect(counterSpy).toHaveBeenCalledTimes(1);
    });

    it("evaluates final value expression only once", () => {
        const finalValue = new Expr.Literal(new Int32(5));
        const finalValueSpy = jest.spyOn(finalValue, "accept");

        const statements = [
            new Stmt.For(
                {
                    for: token(Lexeme.For, "for"),
                    to: token(Lexeme.To, "to"),
                    endFor: token(Lexeme.EndFor, "end for"),
                },
                initializeCounter,
                finalValue,
                /* step */ new Expr.Literal(new Int32(1)),
                /* body */ new Stmt.Block([])
            ),
        ];

        interpreter.exec(statements);
        expect(finalValueSpy).toHaveBeenCalledTimes(1);
    });

    it("evaluates step expression only once", () => {
        const stepValue = new Expr.Literal(new Int32(1));
        const stepValueSpy = jest.spyOn(stepValue, "accept");

        const statements = [
            new Stmt.For(
                {
                    for: token(Lexeme.For, "for"),
                    to: token(Lexeme.To, "to"),
                    endFor: token(Lexeme.EndFor, "end for"),
                },
                initializeCounter,
                new Expr.Literal(new Int32(5)),
                /* step */ stepValue,
                /* body */ new Stmt.Block([])
            ),
        ];

        interpreter.exec(statements);
        expect(stepValueSpy).toHaveBeenCalledTimes(1);
    });

    it("executes block one last time when `counter = finalValue`", () => {
        const body = new Stmt.Block([]); // no need for anything in it
        const bodySpy = jest.spyOn(body, "accept");

        const statements = [
            new Stmt.For(
                {
                    for: token(Lexeme.For, "for"),
                    to: token(Lexeme.To, "to"),
                    endFor: token(Lexeme.EndFor, "end for"),
                },
                initializeCounter,
                new Expr.Literal(new Int32(5)),
                new Expr.Literal(new Int32(1)),
                body
            ),
        ];

        interpreter.exec(statements);
        // i=0 through i=5, then when i=6 (final value)
        expect(bodySpy).toHaveBeenCalledTimes(6);
    });

    it("leaves counter in-scope after loop", () => {
        const statements = [
            new Stmt.For(
                {
                    for: token(Lexeme.For, "for"),
                    to: token(Lexeme.To, "to"),
                    endFor: token(Lexeme.EndFor, "end for"),
                },
                initializeCounter,
                /* finalValue */ new Expr.Literal(new Int32(5)),
                /* step */ new Expr.Literal(new Int32(1)),
                /* body */ new Stmt.Block([])
            ),
            new Stmt.Expression(new Expr.Variable(identifier("i"))),
        ];

        const [forLoop, i] = interpreter.exec(statements);
        // counter must get incremented after last body iteration
        expect(i).toEqual(new Int32(6));
    });

    it("can be exited", () => {
        const body = new Stmt.Block([new Stmt.ExitFor({ exitFor: token(Lexeme.ExitFor, "exit for") })]);
        const bodySpy = jest.spyOn(body, "accept");

        const statements = [
            new Stmt.For(
                {
                    for: token(Lexeme.For, "for"),
                    to: token(Lexeme.To, "to"),
                    endFor: token(Lexeme.EndFor, "end for"),
                },
                initializeCounter,
                /* finalValue */ new Expr.Literal(new Int32(5)),
                /* step */ new Expr.Literal(new Int32(1)),
                body
            ),
        ];

        interpreter.exec(statements);
        expect(bodySpy).toHaveBeenCalledTimes(1);
    });

    it("executes block skipping 'exit for' with 'continue for'", () => {
        const body = new Stmt.Block([
            new Stmt.ContinueFor({ continueFor: token(Lexeme.ContinueFor, "continue for") }),
            new Stmt.ExitFor({ exitFor: token(Lexeme.ExitFor, "exit for") }),
        ]);
        const bodySpy = jest.spyOn(body, "accept");

        const statements = [
            new Stmt.For(
                {
                    for: token(Lexeme.For, "for"),
                    to: token(Lexeme.To, "to"),
                    endFor: token(Lexeme.EndFor, "end for"),
                },
                initializeCounter,
                new Expr.Literal(new Int32(5)),
                new Expr.Literal(new Int32(1)),
                body
            ),
        ];

        interpreter.exec(statements);
        expect(bodySpy).toHaveBeenCalledTimes(6);
    });
});
