const BrsError = require("../../lib/Error");
const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { identifier } = require("../parser/ParserTests");
const { Interpreter } = require("../../lib/interpreter");
const { BrsTypes } = require("brs");
const { Int32, BrsInvalid } = BrsTypes;

let interpreter;

describe("interpreter variables", () => {
    beforeEach(() => {
        BrsError.reset();
        interpreter = new Interpreter();
    });

    it("returns 'invalid' for assignments", () => {
        let ast = new Stmt.Assignment(
            identifier("foo"),
            new Expr.Literal(new Int32(5))
        );

        let [result] = interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
    });

    it("stores assigned values in variable scope", () => {
        let six = new Int32(6)
        let ast = new Stmt.Assignment(
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
});