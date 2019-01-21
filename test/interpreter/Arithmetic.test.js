const BrsError = require("../../lib/Error");
const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { token } = require("../parser/ParserTests");
const { binary } = require("./InterpreterTests");
const { Lexeme, BrsTypes } = require("brs");
const { Interpreter } = require("../../lib/interpreter");

let interpreter;

describe("interpreter arithmetic", () => {
    beforeEach(() => {
        interpreter = new Interpreter();
    });

    it("adds numbers", () => {
        let ast = binary(new BrsTypes.Int32(2), Lexeme.Plus, new BrsTypes.Float(1.5));
        let [result] = interpreter.exec([ast]);
        expect(result.getValue()).toBe(3.5);
    });

    it("concatenates strings", () => {
        let ast = binary(new BrsTypes.BrsString("judge "), Lexeme.Plus, new BrsTypes.BrsString("judy"));
        let [result] = interpreter.exec([ast]);
        expect(result.toString()).toBe("judge judy");
    });

    it("subtracts numbers", () => {
        let ast = binary(new BrsTypes.Int32(2), Lexeme.Minus, new BrsTypes.Float(1.5));
        let [result] = interpreter.exec([ast]);
        expect(result.getValue()).toBe(0.5);
    });

    it("multiplies numbers", () => {
        let ast = binary(new BrsTypes.Int32(2), Lexeme.Star, new BrsTypes.Float(1.5));
        let [result] = interpreter.exec([ast]);
        expect(result.getValue()).toBe(3);
    });

    it("divides numbers", () => {
        let ast = binary(new BrsTypes.Int32(2), Lexeme.Slash, new BrsTypes.Float(1.5));
        let [result] = interpreter.exec([ast]);
        expect(result.getValue()).toBeCloseTo(1.33333, 5);
    });

    it("integer-divides numbers", () => {
        let ast = binary(new BrsTypes.Int32(2), Lexeme.Backslash, new BrsTypes.Float(1.5));
        let [result] = interpreter.exec([ast]);
        expect(result.getValue()).toBe(1);
    });

    it("modulos numbers", () => {
        let ast = binary(new BrsTypes.Int32(2), Lexeme.Mod, new BrsTypes.Float(1.5));
        let [result] = interpreter.exec([ast]);
        expect(result.getValue()).toBe(0.5);
    });

    it("exponentiates numbers", () => {
        let ast = binary(new BrsTypes.Int32(2), Lexeme.Caret, new BrsTypes.Float(3));
        let [result] = interpreter.exec([ast]);
        expect(result.getValue()).toBe(8);
    });

    it("follows arithmetic order-of-operations (PEMDAS)", () => {
        // (6 + 5) * 4 - 3 ^ 2
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Binary(
                    new Expr.Grouping(
                        new Expr.Binary(
                            new Expr.Literal(new BrsTypes.Int32(6)),
                            token(Lexeme.Plus),
                            new Expr.Literal(new BrsTypes.Int32(5))
                        )
                    ),
                    token(Lexeme.Star),
                    new Expr.Literal(new BrsTypes.Int32(4))
                ),
                token(Lexeme.Minus),
                new Expr.Binary(
                    new Expr.Literal(new BrsTypes.Int32(3)),
                    token(Lexeme.Caret),
                    new Expr.Literal(new BrsTypes.Int32(2))
                )
            )
        );

        let [result] = interpreter.exec([ast]);
        expect(result.getValue()).toBe(35);
    });

    it("doesn't allow non-numeric negation", () => {
        let ast = new Stmt.Expression(
            new Expr.Unary(
                token(Lexeme.Minus),
                new Expr.Literal(new BrsTypes.BrsString("four"))
            )
        );

        expect(() => interpreter.exec([ast])).toThrow(/Attempting to negate non-numeric value/);
    });

    it("doesn't allow mixed-type arithmetic", () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new BrsTypes.Int32(3)),
                token(Lexeme.Plus),
                new Expr.Literal(new BrsTypes.BrsString("four"))
            )
        );

        expect(() => interpreter.exec([ast])).toThrow(/Attempting to add non-homogeneous values/);
        expect(BrsError.found()).toBe(true);
    });

    it("bitwise ANDs integers", () => {
        // 110 AND 101 = 100
        // (6)     (5) = (4)
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new BrsTypes.Int32(6)),
                token(Lexeme.And),
                new Expr.Literal(new BrsTypes.Int32(5))
            )
        );

        let [result] = interpreter.exec([ast]);
        expect(result.getValue()).toBe(4);
    });

    it("bitwise ORs integers", () => {
        // 110 OR 011 = 111
        // (6)    (3) = (7)
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new BrsTypes.Int32(6)),
                token(Lexeme.Or),
                new Expr.Literal(new BrsTypes.Float(3))
            )
        );

        let [result] = interpreter.exec([ast]);
        expect(result.getValue()).toBe(7);
    });
});
