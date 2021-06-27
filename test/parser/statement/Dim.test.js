const brs = require("brs");
const { token, identifier, EOF } = require("../ParserTests");
const { Lexeme } = brs.lexer;
const { Expr, Stmt } = brs.parser;

describe("parser dim statements", () => {
    it("parses one-dimension", () => {
        let { statements, errors } = brs.parser.Parser.parse([
            token(Lexeme.Dim, "dim"),
            identifier("foo"),
            token(Lexeme.LeftSquare, "["),
            identifier("bar"), // any valid expression
            token(Lexeme.RightSquare, "]"),
            EOF,
        ]);
        expect(errors.length).toEqual(0);
    });

    it("errors when no dimensions provided", () => {
        let { statements, errors } = brs.parser.Parser.parse([
            token(Lexeme.Dim, "dim"),
            identifier("foo"),
            token(Lexeme.LeftSquare, "["),
            // missing dimension, throw error
            token(Lexeme.RightSquare, "]"),
            EOF,
        ]);
        expect(errors.length).toEqual(1);
    });
});
