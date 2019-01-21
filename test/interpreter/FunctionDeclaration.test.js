const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { Interpreter } = require("../../lib/interpreter");
const { Lexeme, BrsTypes } = require("brs");
const { Int32, BrsString, BrsInvalid, Callable, ValueKind } = BrsTypes;

let interpreter;

describe("interpreter function declarations", () => {
    beforeEach(() => {
        interpreter = new Interpreter();
    });

    it("creates function callables", () => {
        let statements = [
            new Stmt.Function(
                { kind: Lexeme.Identifier, text: "foo", line: 1 },
                new Expr.Function(
                    [],
                    ValueKind.Void,
                    new Stmt.Block([])
                )
            )
        ];

        interpreter.exec(statements);

        let storedValue = interpreter.environment.get(
            { kind: Lexeme.Identifier, text: "foo", line: 3 }
        );
        expect(storedValue).not.toBe(BrsInvalid.Instance);
        expect(storedValue).toBeInstanceOf(Callable);
    });

    it("can call functions after definition", () => {
        let emptyBlock = new Stmt.Block([]);
        jest.spyOn(emptyBlock, "accept");

        let statements = [
            new Stmt.Function(
                { kind: Lexeme.Identifier, text: "foo", line: 1 },
                new Expr.Function(
                    [],
                    ValueKind.Void,
                    emptyBlock
                )
            ),
            new Stmt.Expression(
                new Expr.Call(
                    new Expr.Variable(
                        { kind: Lexeme.Identifier, text: "foo", line: 3 }
                    ),
                    { kind: Lexeme.RightParen, text: ")", line: 3 },
                    []
                )
            )
        ];

        interpreter.exec(statements);

        expect(emptyBlock.accept).toHaveBeenCalledTimes(1);
    });

    it("returns values", () => {
        let statements = [
            new Stmt.Function(
                { kind: Lexeme.Identifier, text: "foo", line: 1 },
                new Expr.Function(
                    [],
                    ValueKind.String,
                    new Stmt.Block([
                        new Stmt.Return(
                            { kind: Lexeme.Return, text: "return", line: 2 },
                            new Expr.Literal(
                                new BrsString("hello, world")
                            )
                        )
                    ])
                )
            ),
            new Stmt.Assignment(
                { kind: Lexeme.Identifier, text: "result", line: 4},
                new Expr.Call(
                    new Expr.Variable(
                        { kind: Lexeme.Identifier, text: "foo", line: 4 }
                    ),
                    { kind: Lexeme.RightParen, text: ")", line: 4 },
                    []
                )
            )
        ];

        interpreter.exec(statements);

        let storedResult = interpreter.environment.get(
            { kind: Lexeme.Identifier, text: "result", line: 5 }
        );
        expect(storedResult).toEqual(new BrsString("hello, world"));
    });

    it("evaluates default arguments", () => {
        let statements = [
            new Stmt.Function(
                { kind: Lexeme.Identifier, text: "ident", line: 1 },
                new Expr.Function(
                    [{
                        name: "input",
                        type: ValueKind.Int32,
                        defaultValue: new Expr.Literal(new Int32(-32))
                    }],
                    ValueKind.Int32,
                    new Stmt.Block([
                        new Stmt.Return(
                            { kind: Lexeme.Return, text: "return", line: 2 },
                            new Expr.Variable(
                                { kind: Lexeme.Identifier, text: "input", line: 2 }
                            )
                        )
                    ])
                )
            ),
            new Stmt.Assignment(
                { kind: Lexeme.Identifier, text: "result", line: 4 },
                new Expr.Call(
                    new Expr.Variable(
                        { kind: Lexeme.Identifier, text: "ident", line: 4 }
                    ),
                    { kind: Lexeme.RightParen, text: ")", line: 4 },
                    []
                )
            )
        ];

        interpreter.exec(statements);

        let storedResult = interpreter.environment.get(
            { kind: Lexeme.Identifier, text: "result", line: 5 }
        );
        expect(storedResult).toEqual(new Int32(-32));

        expect(interpreter.environment.has(
            { kind: Lexeme.Identifier, text: "input", line: 6 }
        )).toBe(false);
    });

    it("enforces return value type checking", () => {
        let statements = [
            new Stmt.Function(
                { kind: Lexeme.Identifier, text: "foo", line: 1 },
                new Expr.Function(
                    [],
                    ValueKind.Int32,
                    new Stmt.Block([
                        new Stmt.Return(
                            { kind: Lexeme.Return, text: "return", line: 2 },
                            new Expr.Literal(
                                new BrsString("not a number")
                            )
                        )
                    ])
                )
            ),
            new Stmt.Assignment(
                { kind: Lexeme.Identifier, text: "result", line: 4},
                new Expr.Call(
                    new Expr.Variable(
                        { kind: Lexeme.Identifier, text: "foo", line: 4 }
                    ),
                    { kind: Lexeme.RightParen, text: ")", line: 4 },
                    []
                )
            )
        ];

        expect(() => interpreter.exec(statements)).toThrow("Attempting to return value of type");
    });

    it("evaluates default arguments", () => {
        let statements = [
            new Stmt.Function(
                { kind: Lexeme.Identifier, text: "ident", line: 1 },
                new Expr.Function(
                    [{
                        name: "input",
                        type: ValueKind.Int32,
                        defaultValue: new Expr.Literal(new Int32(-32))
                    }],
                    ValueKind.Int32,
                    new Stmt.Block([
                        new Stmt.Return(
                            { kind: Lexeme.Return, text: "return", line: 2 },
                            new Expr.Variable(
                                { kind: Lexeme.Identifier, text: "input", line: 2 }
                            )
                        )
                    ])
                )
            ),
            new Stmt.Assignment(
                { kind: Lexeme.Identifier, text: "result", line: 4 },
                new Expr.Call(
                    new Expr.Variable(
                        { kind: Lexeme.Identifier, text: "ident", line: 4 }
                    ),
                    { kind: Lexeme.RightParen, text: ")", line: 4 },
                    []
                )
            )
        ];

        interpreter.exec(statements);

        let storedResult = interpreter.environment.get(
            { kind: Lexeme.Identifier, text: "result", line: 5 }
        );
        expect(storedResult).toEqual(new Int32(-32));

        expect(interpreter.environment.has(
            { kind: Lexeme.Identifier, text: "input", line: 6 }
        )).toBe(false);
    });

    it("disallows functions named after reserved words", () => {
        let statements = [
            new Stmt.Function(
                { kind: Lexeme.Identifier, text: "type", isReserved: true, line: 1 },
                new Expr.Function(
                    [],
                    ValueKind.Void,
                    new Stmt.Block([])
                )
            ),
        ];

        expect(() => interpreter.exec(statements)).toThrow(/reserved name/);
    });

    it("allows functions to override global stdlib functions", () => {
        let statements = [
            new Stmt.Function(
                { kind: Lexeme.Identifier, text: "UCase", isReserved: false, line: 1 },
                new Expr.Function(
                    [], // accepts no arguments
                    ValueKind.Void, // returns nothing
                    new Stmt.Block([]) // does nothing. It's a really silly function, but the implementation doesn't matter
                )
            )
        ];

        expect(() => interpreter.exec(statements)).not.toThrow();
    });

    it("automatically calls main()", () => {
        let mainBody = new Stmt.Block([]);
        jest.spyOn(mainBody, "accept");

        let statements = [
            new Stmt.Function(
                { kind: Lexeme.Identifier, text: "Main", isReserved: false, line: 1 },
                new Expr.Function(
                    [], // accepts no arguments
                    ValueKind.Void, // returns nothing
                    mainBody
                )
            )
        ];

        expect(() => interpreter.exec(statements)).not.toThrow();
        expect(mainBody.accept).toHaveBeenCalledTimes(1);
    });
});
