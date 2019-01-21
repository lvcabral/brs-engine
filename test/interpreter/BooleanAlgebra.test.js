const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { token } = require("../parser/ParserTests");
const { Lexeme, BrsTypes } = require("brs");
const { Interpreter } = require("../../lib/interpreter");

let interpreter;

describe("interpreter boolean algebra", () => {
    beforeEach(() => {
        interpreter = new Interpreter();
    });

    it("ANDs booleans", () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(BrsTypes.BrsBoolean.True),
                token(Lexeme.And),
                new Expr.Literal(BrsTypes.BrsBoolean.False)
            )
        );

        let [result] = interpreter.exec([ast]);
        expect(result).toEqual(BrsTypes.BrsBoolean.False);
    });

    it("ORs booleans", () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(BrsTypes.BrsBoolean.True),
                token(Lexeme.Or),
                new Expr.Literal(BrsTypes.BrsBoolean.False)
            )
        );

        let [result] = interpreter.exec([ast]);
        expect(result).toEqual(BrsTypes.BrsBoolean.True);
    });

    it("doesn't allow mixed-type ANDs", () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(BrsTypes.BrsBoolean.True),
                token(Lexeme.And),
                new Expr.Literal(new BrsTypes.Int32(5))
            )
        );

        expect(() => interpreter.exec([ast])).toThrow(/Attempting to 'and' boolean/);
    });

    it("doesn't allow mixed-type ORs", () => {
        let ast = new Stmt.Expression(
            new Expr.Binary(
                new Expr.Literal(BrsTypes.BrsBoolean.False),
                token(Lexeme.Or),
                new Expr.Literal(new BrsTypes.Int32(5))
            )
        );

        expect(() => interpreter.exec([ast])).toThrow(/Attempting to 'or' boolean/);
    });
});
