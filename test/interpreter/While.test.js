const BrsError = require("../../lib/Error");
const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { Interpreter } = require("../../lib/interpreter");
const { Lexeme, BrsTypes } = require("brs");
const { Int32 } = BrsTypes;
const { identifier } = require("../parser/ParserTests");

let interpreter;
let decrementSpy;

describe("interpreter while loops", () => {
    const initializeFoo = new Stmt.Assignment(
        identifier("foo"),
        new Expr.Literal(new Int32(5))
    );

    const decrementFoo = new Stmt.Assignment(
        identifier("foo"),
        new Expr.Binary(
            new  Expr.Variable(identifier("foo")),
            { kind: Lexeme.Minus, text: "-" },
            new Expr.Literal(new Int32(1))
        )
    );

    beforeEach(() => {
        BrsError.reset();
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
                new Expr.Binary(
                    new Expr.Variable(identifier("foo")),
                    { kind: Lexeme.Greater, text: ">" },
                    new Expr.Literal(new Int32(0))
                ),
                new Stmt.Block([
                    decrementFoo
                ])
            )
        ];

        let results = interpreter.exec(statements);
        expect(results.map(r => r.reason)).toEqual([Stmt.StopReason.End, Stmt.StopReason.End]);
        expect(decrementSpy).toHaveBeenCalledTimes(5);
    });

    it("evaluates 'condition' before every loop", () => {
        const greaterThanZero = new Expr.Binary(
            new Expr.Variable(identifier("foo")),
            { kind: Lexeme.Greater, text: ">" },
            new Expr.Literal(new Int32(0))
        );
        jest.spyOn(greaterThanZero, "accept");

        const statements = [
            initializeFoo,
            new Stmt.While(
                greaterThanZero,
                new Stmt.Block([
                    decrementFoo
                ])
            )
        ];

        let results = interpreter.exec(statements);
        // body executes five times, but the condition is evaluated once more to know it should exit
        expect(greaterThanZero.accept).toHaveBeenCalledTimes(6);
    });

    it("exits early when it encounters 'exit while'", () => {
        const statements = [
            initializeFoo,
            new Stmt.While(
                new Expr.Binary(
                    new Expr.Variable(identifier("foo")),
                    { kind: Lexeme.Greater, text: ">" },
                    new Expr.Literal(new Int32(0))
                ),
                new Stmt.Block([
                    decrementFoo,
                    new Stmt.ExitWhile()
                ])
            )
        ];

        let results = interpreter.exec(statements);
        expect(results.map(r => r.reason)).toEqual([Stmt.StopReason.End, Stmt.StopReason.End]);
        expect(decrementSpy).toHaveBeenCalledTimes(1);
    });

});