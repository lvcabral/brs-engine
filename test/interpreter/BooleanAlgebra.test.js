const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { token } = require("../parser/ParserTests");
const brs = require("brs");
const { Lexeme } = brs.lexer;
const { Interpreter } = require("../../lib/interpreter");

let interpreter;

describe("interpreter boolean algebra", () => {
    beforeEach(() => {
        interpreter = new Interpreter();
    });

    it("ANDs booleans", () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(brs.types.BrsBoolean.True),
                token(Lexeme.And),
                new Expr.Literal(brs.types.BrsBoolean.False)
            )
        );

        let [result] = interpreter.exec([ast]);
        expect(result).toEqual(brs.types.BrsBoolean.False);
    });

    it("ORs booleans", () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(brs.types.BrsBoolean.True),
                token(Lexeme.Or),
                new Expr.Literal(brs.types.BrsBoolean.False)
            )
        );

        let [result] = interpreter.exec([ast]);
        expect(result).toEqual(brs.types.BrsBoolean.True);
    });

    it("doesn't allow mixed-type ANDs", () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(brs.types.BrsBoolean.True),
                token(Lexeme.And),
                new Expr.Literal(new brs.types.Int32(5))
            )
        );

        expect(() => interpreter.exec([ast])).toThrow(/Attempting to 'and' boolean/);
    });

    it("doesn't allow mixed-type ORs", () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(brs.types.BrsBoolean.False),
                token(Lexeme.Or),
                new Expr.Literal(new brs.types.Int32(5))
            )
        );

        expect(() => interpreter.exec([ast])).toThrow(/Attempting to 'or' boolean/);
    });
});
