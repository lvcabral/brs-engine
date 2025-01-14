const brs = require("../../bin/brs.node");
const { Lexeme } = brs.lexer;
const { Expr, Stmt } = brs.parser;
const { token } = require("../parser/ParserTests");
const { Interpreter } = brs;

let interpreter;

describe("interpreter boolean algebra", () => {
    beforeEach(() => {
        interpreter = new Interpreter();
    });

    it("ANDs booleans", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(brs.types.BrsBoolean.True),
                token(Lexeme.And),
                new Expr.Literal(brs.types.BrsBoolean.False)
            )
        );

        let [result] = await interpreter.exec([ast]);
        expect(result).toEqual(brs.types.BrsBoolean.False);
    });

    it("ORs booleans", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(brs.types.BrsBoolean.True),
                token(Lexeme.Or),
                new Expr.Literal(brs.types.BrsBoolean.False)
            )
        );

        let [result] = await interpreter.exec([ast]);
        expect(result).toEqual(brs.types.BrsBoolean.True);
    });

    it("mixed-type ANDs with Number non-zero", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(brs.types.BrsBoolean.True),
                token(Lexeme.And),
                new Expr.Literal(new brs.types.Int32(5))
            )
        );

        let result = await interpreter.exec([ast]);
        expect(result).toEqual([brs.types.BrsBoolean.True]);
    });

    it("mixed-type ANDs with Number zero", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(brs.types.BrsBoolean.True),
                token(Lexeme.And),
                new Expr.Literal(new brs.types.Int32(0))
            )
        );
        let result = await interpreter.exec([ast]);
        expect(result).toEqual([brs.types.BrsBoolean.False]);
    });

    it("doesn't allow mixed-type ANDs", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(brs.types.BrsBoolean.True),
                token(Lexeme.And),
                new Expr.Literal(new brs.types.BrsString("true"))
            )
        );

        await expect(() => interpreter.exec([ast])).rejects.toThrow("Type Mismatch.");
    });

    it("mixed-type ORs with Number non-zero", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(brs.types.BrsBoolean.False),
                token(Lexeme.Or),
                new Expr.Literal(new brs.types.Float(-1))
            )
        );

        let result = await interpreter.exec([ast]);
        expect(result).toEqual([brs.types.BrsBoolean.True]);
    });

    it("mixed-type ORs with Number zero", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(brs.types.BrsBoolean.False),
                token(Lexeme.Or),
                new Expr.Literal(new brs.types.Float(0))
            )
        );

        let result = await interpreter.exec([ast]);
        expect(result).toEqual([brs.types.BrsBoolean.False]);
    });

    it("doesn't allow mixed-type ORs", async () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(brs.types.BrsBoolean.False),
                token(Lexeme.Or),
                new Expr.Literal(new brs.types.BrsString("false"))
            )
        );

        await expect(() => interpreter.exec([ast])).rejects.toThrow("Type Mismatch.");
    });
});
