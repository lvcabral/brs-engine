const brs = require("../../bin/brs.node");
const { Expr, Stmt } = brs.parser;

const { token } = require("../parser/ParserTests");
const { binary } = require("./InterpreterTests");
const { Lexeme } = brs.lexer;
const { Interpreter } = brs;

let interpreter;

describe("interpreter arithmetic", () => {
    beforeEach(() => {
        interpreter = new Interpreter();
    });

    it("adds numbers", async () => {
        let ast = binary(new brs.types.Int32(2), Lexeme.Plus, new brs.types.Float(1.5));
        let [result] = await interpreter.exec([ast]);
        expect(result.getValue()).toBe(3.5);
    });

    it("concatenates strings", async () => {
        let ast = binary(
            new brs.types.BrsString("judge "),
            Lexeme.Plus,
            new brs.types.BrsString("judy")
        );
        let [result] = await interpreter.exec([ast]);
        expect(result.toString()).toBe("judge judy");
    });

    it("subtracts numbers", async () => {
        let ast = binary(new brs.types.Int32(2), Lexeme.Minus, new brs.types.Float(1.5));
        let [result] = await interpreter.exec([ast]);
        expect(result.getValue()).toBe(0.5);
    });

    it("multiplies numbers", async () => {
        let ast = binary(new brs.types.Int32(2), Lexeme.Star, new brs.types.Float(1.5));
        let [result] = await interpreter.exec([ast]);
        expect(result.getValue()).toBe(3);
    });

    it("divides numbers", async () => {
        let ast = binary(new brs.types.Int32(2), Lexeme.Slash, new brs.types.Float(1.5));
        let [result] = await interpreter.exec([ast]);
        expect(result.getValue()).toBeCloseTo(1.33333, 5);
    });

    it("integer-divides numbers", async () => {
        let ast = binary(new brs.types.Int32(2), Lexeme.Backslash, new brs.types.Float(1.5));
        let [result] = await interpreter.exec([ast]);
        expect(result.getValue()).toBe(1);
    });

    it("modulos numbers", async () => {
        let ast = binary(new brs.types.Int32(2), Lexeme.Mod, new brs.types.Float(1.5));
        let [result] = await interpreter.exec([ast]);
        expect(result.getValue()).toBe(0);
    });

    it("exponentiates numbers", async () => {
        let ast = binary(new brs.types.Int32(2), Lexeme.Caret, new brs.types.Float(3));
        let [result] = await interpreter.exec([ast]);
        expect(result.getValue()).toBe(8);
    });

    it("follows arithmetic order-of-operations (PEMDAS)", async () => {
        // (6 + 5) * 4 - 3 ^ 2
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Binary(
                    new Expr.Grouping(
                        {
                            left: token(Lexeme.LeftParen),
                            right: token(Lexeme.RightParen),
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

        let [result] = await interpreter.exec([ast]);
        expect(result.getValue()).toBe(35);
    });

    it("supports positive and negative unary prefix operators", async () => {
        let ast = [
            new Stmt.Expression(
                new Expr.Unary(token(Lexeme.Minus), new Expr.Literal(new brs.types.Int32(4)))
            ),
            new Stmt.Expression(
                new Expr.Unary(token(Lexeme.Plus), new Expr.Literal(new brs.types.Float(3.14159)))
            ),
        ];

        let [minusFour, pi] = await interpreter.exec(ast);
        expect(minusFour.getValue()).toBe(-4);
        expect(pi.getValue()).toBe(3.14159);
    });

    it("supports silly amounts of mixed unary prefix operators", async () => {
        let ast = [
            new Stmt.Expression(
                new Expr.Unary(
                    token(Lexeme.Plus),
                    new Expr.Unary(
                        token(Lexeme.Minus),
                        new Expr.Unary(
                            token(Lexeme.Plus),
                            new Expr.Unary(
                                token(Lexeme.Minus),
                                new Expr.Unary(
                                    token(Lexeme.Plus),
                                    new Expr.Unary(
                                        token(Lexeme.Minus),
                                        new Expr.Literal(new brs.types.Int32(3))
                                    )
                                )
                            )
                        )
                    )
                )
            ),
        ];

        let [minusThree] = await interpreter.exec(ast);
        expect(minusThree.getValue()).toBe(-3);
    });

    it("doesn't allow non-numeric negation", async () => {
        let ast = new Stmt.Expression(
            new Expr.Unary(token(Lexeme.Minus), new Expr.Literal(new brs.types.BrsString("four")))
        );

        await expect(() => interpreter.exec([ast])).rejects.toThrow("Type Mismatch.");
    });

    it("doesn't allow mixed-type arithmetic", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new brs.types.Int32(3)),
                token(Lexeme.Plus),
                new Expr.Literal(new brs.types.BrsString("four"))
            )
        );

        await expect(() => interpreter.exec([ast])).rejects.toThrow("Type Mismatch.");
    });

    it("bitwise ANDs integers", async () => {
        // 110 AND 101 = 100
        // (6)     (5) = (4)
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new brs.types.Int32(6)),
                token(Lexeme.And),
                new Expr.Literal(new brs.types.Int32(5))
            )
        );

        let [result] = await interpreter.exec([ast]);
        expect(result.getValue()).toBe(4);
    });

    it("bitwise ORs integers", async () => {
        // 110 OR 011 = 111
        // (6)    (3) = (7)
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new brs.types.Int32(6)),
                token(Lexeme.Or),
                new Expr.Literal(new brs.types.Float(3))
            )
        );

        let [result] = await interpreter.exec([ast]);
        expect(result.getValue()).toBe(7);
    });

    it("bitwise NOTs integer", async () => {
        let ast = new Stmt.Expression(
            new Expr.Unary(token(Lexeme.Not), new Expr.Literal(new brs.types.Int32(6)))
        );

        let [result] = await interpreter.exec([ast]);
        expect(result.getValue()).toBe(-7);
    });

    it("bitwise left shift with integers", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new brs.types.Int32(10)),
                token(Lexeme.LeftShift),
                new Expr.Literal(new brs.types.Int32(2))
            )
        );

        let [result] = await interpreter.exec([ast]);
        expect(result.getValue()).toBe(40);
    });

    it("bitwise left shift with floats (truncate)", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new brs.types.Float(10.7)),
                token(Lexeme.LeftShift),
                new Expr.Literal(new brs.types.Float(2.9))
            )
        );

        let [result] = await interpreter.exec([ast]);
        expect(result.getValue()).toBe(40);
    });

    it("bitwise left shift with left negative", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new brs.types.Int32(-100)),
                token(Lexeme.LeftShift),
                new Expr.Literal(new brs.types.Int32(2))
            )
        );

        let [result] = await interpreter.exec([ast]);
        expect(result.getValue()).toBe(-400);
    });

    it("bitwise left shift with right negative", async () => {
        //
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new brs.types.Int32(1)),
                token(Lexeme.LeftShift),
                new Expr.Literal(new brs.types.Int32(-1))
            )
        );

        await expect(() => interpreter.exec([ast])).rejects.toThrow(/Invalid Bitwise Shift./);
    });

    it("bitwise left shift with right == 32", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new brs.types.Int32(1)),
                token(Lexeme.LeftShift),
                new Expr.Literal(new brs.types.Int32(32))
            )
        );

        await expect(() => interpreter.exec([ast])).rejects.toThrow(/Invalid Bitwise Shift./);
    });

    it("bitwise left shift with right > 32", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new brs.types.Int32(1)),
                token(Lexeme.LeftShift),
                new Expr.Literal(new brs.types.Int32(77))
            )
        );

        await expect(() => interpreter.exec([ast])).rejects.toThrow(/Invalid Bitwise Shift./);
    });

    it("bitwise right shift with integers", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new brs.types.Int32(2147483647)),
                token(Lexeme.RightShift),
                new Expr.Literal(new brs.types.Int32(1))
            )
        );

        let [result] = await interpreter.exec([ast]);
        expect(result.getValue()).toBe(1073741823);
    });

    it("bitwise right shift with floats (truncate)", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new brs.types.Float(10.7)),
                token(Lexeme.RightShift),
                new Expr.Literal(new brs.types.Float(2.9))
            )
        );

        let [result] = await interpreter.exec([ast]);
        expect(result.getValue()).toBe(2);
    });

    it("bitwise right shift with left negative", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new brs.types.Int32(-1)),
                token(Lexeme.RightShift),
                new Expr.Literal(new brs.types.Int32(1))
            )
        );

        let [result] = await interpreter.exec([ast]);
        expect(result.getValue()).toBe(2147483647);
    });

    it("bitwise right shift with right negative", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new brs.types.Int32(1)),
                token(Lexeme.RightShift),
                new Expr.Literal(new brs.types.Int32(-1))
            )
        );

        await expect(() => interpreter.exec([ast])).rejects.toThrow(/Invalid Bitwise Shift./);
    });

    it("bitwise right shift with right == 32", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new brs.types.Int32(1)),
                token(Lexeme.RightShift),
                new Expr.Literal(new brs.types.Int32(32))
            )
        );

        await expect(() => interpreter.exec([ast])).rejects.toThrow(/Invalid Bitwise Shift./);
    });

    it("bitwise right shift with right > 32", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(new brs.types.Int32(1)),
                token(Lexeme.LeftShift),
                new Expr.Literal(new brs.types.Int32(77))
            )
        );

        await expect(() => interpreter.exec([ast])).rejects.toThrow(/Invalid Bitwise Shift./);
    });
});
