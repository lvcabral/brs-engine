const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { token } = require("../parser/ParserTests");
const { binary } = require("./InterpreterTests");
const brs = require("brs");
const { Lexeme } = brs.lexer;
const { Interpreter } = require("../../lib/interpreter");

let interpreter;

describe("interpreter arithmetic", () => {
    beforeEach(() => {
        interpreter = new Interpreter();
    });

    it("adds numbers", () => {
        let ast = binary(new brs.types.Int32(2), Lexeme.Plus, new brs.types.Float(1.5));
        let [result] = interpreter.exec([ast]);
        expect(result.getValue()).toBe(3.5);
    });

    it("concatenates strings", () => {
        let ast = binary(new brs.types.BrsString("judge "), Lexeme.Plus, new brs.types.BrsString("judy"));
        let [result] = interpreter.exec([ast]);
        expect(result.toString()).toBe("judge judy");
    });

    it("subtracts numbers", () => {
        let ast = binary(new brs.types.Int32(2), Lexeme.Minus, new brs.types.Float(1.5));
        let [result] = interpreter.exec([ast]);
        expect(result.getValue()).toBe(0.5);
    });

    it("multiplies numbers", () => {
        let ast = binary(new brs.types.Int32(2), Lexeme.Star, new brs.types.Float(1.5));
        let [result] = interpreter.exec([ast]);
        expect(result.getValue()).toBe(3);
    });

    it("divides numbers", () => {
        let ast = binary(new brs.types.Int32(2), Lexeme.Slash, new brs.types.Float(1.5));
        let [result] = interpreter.exec([ast]);
        expect(result.getValue()).toBeCloseTo(1.33333, 5);
    });

    it("integer-divides numbers", () => {
        let ast = binary(new brs.types.Int32(2), Lexeme.Backslash, new brs.types.Float(1.5));
        let [result] = interpreter.exec([ast]);
        expect(result.getValue()).toBe(1);
    });

    it("modulos numbers", () => {
        let ast = binary(new brs.types.Int32(2), Lexeme.Mod, new brs.types.Float(1.5));
        let [result] = interpreter.exec([ast]);
        expect(result.getValue()).toBe(0.5);
    });

    it("exponentiates numbers", () => {
        let ast = binary(new brs.types.Int32(2), Lexeme.Caret, new brs.types.Float(3));
        let [result] = interpreter.exec([ast]);
        expect(result.getValue()).toBe(8);
    });

    it("follows arithmetic order-of-operations (PEMDAS)", () => {
        // (6 + 5) * 4 - 3 ^ 2
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Binary(
                    new Expr.Grouping(
                        {
                            left: token(Lexeme.LeftParen),
                            right: token(Lexeme.RightParen)
                        },
                        new Expr.Binary(
                            new Expr.Literal(new brs.types.Int32(6)),
                            token(Lexeme.Plus),
                            new Expr.Literal(new brs.types.Int32(5))
                        )
                    ),
                    token(Lexeme.Star),
                    new Expr.Literal(new brs.types.Int32(4))
                ),
                token(Lexeme.Minus),
                new Expr.Binary(
                    new Expr.Literal(new brs.types.Int32(3)),
                    token(Lexeme.Caret),
                    new Expr.Literal(new brs.types.Int32(2))
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
                new Expr.Literal(new brs.types.BrsString("four"))
            )
        );

        expect(() => interpreter.exec([ast])).toThrow(/Attempting to negate non-numeric value/);
    });

    it("doesn't allow mixed-type arithmetic", () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new brs.types.Int32(3)),
                token(Lexeme.Plus),
                new Expr.Literal(new brs.types.BrsString("four"))
            )
        );

        expect(() => interpreter.exec([ast])).toThrow(/Attempting to add non-homogeneous values/);
    });

    it("bitwise ANDs integers", () => {
        // 110 AND 101 = 100
        // (6)     (5) = (4)
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new brs.types.Int32(6)),
                token(Lexeme.And),
                new Expr.Literal(new brs.types.Int32(5))
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
                new Expr.Literal(new brs.types.Int32(6)),
                token(Lexeme.Or),
                new Expr.Literal(new brs.types.Float(3))
            )
        );

        let [result] = interpreter.exec([ast]);
        expect(result.getValue()).toBe(7);
    });
});
