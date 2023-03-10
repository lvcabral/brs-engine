const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { token, identifier } = require("../parser/ParserTests");
const { Interpreter } = require("../../lib/interpreter");
const brs = require("brs");
const { Lexeme } = brs.lexer;
const { Int32, Int64, Float, Double, BrsString, BrsInvalid, ValueKind } = brs.types;

let interpreter;

describe("interpreter variables", () => {
    let tokens = { equals: token(Lexeme.Equals, "=") };

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    it("returns 'invalid' for assignments", () => {
        let ast = new Stmt.Assignment(tokens, identifier("foo"), new Expr.Literal(new Int32(5)));

        let [result] = interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
    });

    it("stores assigned values in variable scope", () => {
        let six = new Int32(6);
        let ast = new Stmt.Assignment(tokens, identifier("bar"), new Expr.Literal(six));
        interpreter.exec([ast]);
        expect(interpreter.environment.get(identifier("bar"))).toBe(six);
    });

    it("retrieves variables from variable scope", () => {
        let seven = new Int32(7);
        let assign = new Stmt.Assignment(tokens, identifier("baz"), new Expr.Literal(seven));
        let retrieve = new Stmt.Expression(new Expr.Variable(identifier("baz")));
        let results = interpreter.exec([assign, retrieve]);
        expect(results).toEqual([BrsInvalid.Instance, seven]);
    });

    it("disallows variables named after reserved words", () => {
        let ast = [
            new Stmt.Assignment(
                tokens,
                identifier("type"),
                new Expr.Literal(new BrsString("this will fail"))
            ),
        ];

        expect(() => interpreter.exec(ast)).toThrow(/reserved name/);
    });

    it("allows values of matching declared types", () => {
        let assign = [
            new Stmt.Assignment(
                tokens,
                identifier("str$"),
                new Expr.Literal(new BrsString("$ suffix for strings"))
            ),
            new Stmt.Assignment(tokens, identifier("int32%"), new Expr.Literal(new Int32(1))),
            new Stmt.Assignment(tokens, identifier("float!"), new Expr.Literal(new Float(2))),
            new Stmt.Assignment(tokens, identifier("double#"), new Expr.Literal(new Double(3))),
            new Stmt.Assignment(tokens, identifier("double#"), new Expr.Literal(new Float(3))),
            new Stmt.Assignment(tokens, identifier("int64&"), new Expr.Literal(new Int64(4))),
            new Stmt.Assignment(tokens, identifier("int64&"), new Expr.Literal(new Int32(4))),
        ];

        expect(() => interpreter.exec(assign)).not.toThrow();

        let retrieve = ["str$", "int32%", "float!", "double#", "int64&"].map(
            (name) => new Stmt.Expression(new Expr.Variable(identifier(name)))
        );

        let stored = interpreter.exec(retrieve);
        expect(stored).toEqual([
            new BrsString("$ suffix for strings"),
            new Int32(1),
            new Float(2),
            new Double(3),
            new Int64(4),
        ]);
    });

    describe("type mismatch errors", () => {
        let str = new BrsString("foo");
        let int32 = new Int32(1);
        let float = new Float(2);
        let double = new Double(3);
        let int64 = new Int64(4);

        [
            {
                lhs: "string$",
                values: [int32, int64, float, double],
            },
            {
                lhs: "int32%",
                values: [str, float, double, int64],
            },
            {
                lhs: "float!",
                values: [str, int32, double, int64],
            },
            {
                lhs: "double#",
                values: [str, int32, int64],
            },
            {
                lhs: "int64&",
                values: [str, float, double],
            },
        ].forEach(({ lhs, values }) => {
            test(lhs, () => {
                values.forEach((value) => {
                    let assign = new Stmt.Assignment(
                        tokens,
                        identifier(lhs),
                        new Expr.Literal(value)
                    );
                    expect(() => interpreter.exec([assign])).toThrowError(
                        /statically-typed variable/
                    );
                });
            });
        });
    });
});
