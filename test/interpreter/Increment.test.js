const brs = require("brs");
const { Expr, Stmt } = brs.parser;
const { Lexeme } = brs.lexer;
const { Int32, BrsString } = brs.types;
const { Interpreter } = require("../../lib/interpreter");

const { token, identifier } = require("../parser/ParserTests");

let interpreter;

describe("interpreter increment/decrement operators", () => {
    beforeEach(() => {
        interpreter = new Interpreter();
    });

    it("increments variables", () => {
        let ast = [
            new Stmt.Assignment(
                { equals: token(Lexeme.Equals, "=") },
                identifier("foo"),
                new Expr.Literal(new Int32(4))
            ),
            new Stmt.Increment(new Expr.Variable(identifier("foo")), token(Lexeme.PlusPlus, "++")),
        ];

        interpreter.exec(ast);

        expect(interpreter.environment.get(identifier("foo"))).toEqual(new Int32(5));
    });

    it("decrements variables", () => {
        let ast = [
            new Stmt.Assignment(
                { equals: token(Lexeme.Equals, "=") },
                identifier("foo"),
                new Expr.Literal(new Int32(4))
            ),
            new Stmt.Increment(
                new Expr.Variable(identifier("foo")),
                token(Lexeme.MinusMinus, "--")
            ),
        ];

        interpreter.exec(ast);

        expect(interpreter.environment.get(identifier("foo"))).toEqual(new Int32(3));
    });

    it("increments with dotted gets", () => {
        let ast = [
            new Stmt.Assignment(
                { equals: token(Lexeme.Equals, "=") },
                identifier("aa"),
                new Expr.AALiteral(
                    [{ name: new BrsString("foo"), value: new Expr.Literal(new Int32(7)) }],
                    token(Lexeme.LeftBrace, "{"),
                    token(Lexeme.RightBrace, "}")
                )
            ),
            new Stmt.Increment(
                new Expr.DottedGet(new Expr.Variable(identifier("aa")), identifier("foo")),
                token(Lexeme.PlusPlus, "++")
            ),
            new Stmt.Assignment(
                { equals: token(Lexeme.Equals, "=") },
                identifier("result"),
                new Expr.DottedGet(new Expr.Variable(identifier("aa")), identifier("foo"))
            ),
        ];

        interpreter.exec(ast);

        expect(interpreter.environment.get(identifier("result"))).toEqual(new Int32(8));
    });

    it("decrements with indexed gets", () => {
        let ast = [
            new Stmt.Assignment(
                { equals: token(Lexeme.Equals, "=") },
                identifier("arr"),
                new Expr.ArrayLiteral(
                    [new Expr.Literal(new Int32("11"))],
                    token(Lexeme.LeftSquare, "["),
                    token(Lexeme.RightSquare, "]")
                )
            ),
            new Stmt.Increment(
                new Expr.IndexedGet(
                    new Expr.Variable(identifier("arr")),
                    new Expr.Literal(new Int32(0)),
                    token(Lexeme.RightSquare, "]")
                ),
                token(Lexeme.MinusMinus, "--")
            ),
            new Stmt.Assignment(
                { equals: token(Lexeme.Equals, "=") },
                identifier("result"),
                new Expr.IndexedGet(
                    new Expr.Variable(identifier("arr")),
                    new Expr.Literal(new Int32(0)),
                    token(Lexeme.RightSquare, "]")
                )
            ),
        ];

        interpreter.exec(ast);

        expect(interpreter.environment.get(identifier("result"))).toEqual(new Int32(10));
    });
});
