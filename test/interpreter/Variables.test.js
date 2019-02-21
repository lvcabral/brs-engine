const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { token, identifier } = require("../parser/ParserTests");
const { Interpreter } = require("../../lib/interpreter");
const brs = require("brs");
const { Lexeme } = brs.lexer;
const { Int32, BrsString, BrsInvalid } = brs.types;

let interpreter;

describe("interpreter variables", () => {
    let tokens = { equals: token(Lexeme.Equals, "=") };

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    it("returns 'invalid' for assignments", () => {
        let ast = new Stmt.Assignment(
            tokens,
            identifier("foo"),
            new Expr.Literal(new Int32(5))
        );

        let [result] = interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
    });

    it("stores assigned values in variable scope", () => {
        let six = new Int32(6)
        let ast = new Stmt.Assignment(
            tokens,
            identifier("bar"),
            new Expr.Literal(six)
        );
        interpreter.exec([ast]);
        expect(
            interpreter.environment.get(
                identifier("bar")
            )
        ).toBe(six);
    });

    it("retrieves variables from variable scope", () => {
        let seven = new Int32(7);
        let assign = new Stmt.Assignment(
            tokens,
            identifier("baz"),
            new Expr.Literal(seven)
        );
        let retrieve = new Stmt.Expression(
            new Expr.Variable(
                identifier("baz")
            )
        );
        let results = interpreter.exec([ assign, retrieve ]);
        expect(results).toEqual([BrsInvalid.Instance, seven]);
    });

    it("disallows variables named after reserved words", () => {
        let ast = [
            new Stmt.Assignment(
                tokens,
                identifier("type"),
                new Expr.Literal(new BrsString("this will fail"))
            )
        ];

        expect(() => interpreter.exec(ast)).toThrow(/reserved name/);
    });
});
