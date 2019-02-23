const brs = require("brs");
const { Expr, Stmt } = brs.parser;
const { Lexeme } = brs.lexer;
const { BrsString, Int32, Float } = brs.types;
const { Interpreter } = require("../../lib/interpreter");

const { token, identifier } = require("../parser/ParserTests");

describe("interpreter assignment operators", () => {
    beforeEach(() => {
        interpreter = new Interpreter();
    });

    function initializeFoo(literal) {
        return new Stmt.Assignment(
            { equals: token(Lexeme.Equal, "=") },
            identifier("foo"),
            new Expr.Literal(literal)
        );
    }

    function fooAssignmentOperator(token, literal) {
        return new Stmt.Assignment(
            { equals: token },
            identifier("foo"),
            new Expr.Binary(
                new Expr.Variable(identifier("foo")),
                token,
                new Expr.Literal(literal)
            )
        );
    }

    it("adds numbers", () => {
        interpreter.exec([
            initializeFoo(new Int32(3)),
            fooAssignmentOperator(
                token(Lexeme.PlusEqual, "+="),
                new Int32(2)
            )
        ]);

        expect(interpreter.environment.get(identifier("foo"))).toEqual(
            new Int32(5)
        );
    });

    it("concatenates strings", () => {
        interpreter.exec([
            initializeFoo(new BrsString("lorem")),
            fooAssignmentOperator(
                token(Lexeme.PlusEqual, "+="),
                new BrsString(" ipsum")
            )
        ]);

        expect(interpreter.environment.get(identifier("foo"))).toEqual(
            new BrsString("lorem ipsum")
        );
    });

    it("subtracts numbers", () => {
        interpreter.exec([
            initializeFoo(new Int32(3)),
            fooAssignmentOperator(
                token(Lexeme.MinusEqual, "-="),
                new Int32(2)
            )
        ]);

        expect(interpreter.environment.get(identifier("foo"))).toEqual(
            new Int32(1)
        );
    });

    it("multiplies numbers", () => {
        interpreter.exec([
            initializeFoo(new Int32(3)),
            fooAssignmentOperator(
                token(Lexeme.StarEqual, "*="),
                new Int32(2)
            )
        ]);

        expect(interpreter.environment.get(identifier("foo"))).toEqual(
            new Int32(6)
        );
    });

    it("divides numbers", () => {
        interpreter.exec([
            initializeFoo(new Int32(6)),
            fooAssignmentOperator(
                token(Lexeme.SlashEqual, "/="),
                new Int32(2)
            )
        ]);

        expect(interpreter.environment.get(identifier("foo"))).toEqual(
            new Float(3)
        );
    });

    it("integer-divides numbers", () => {
        interpreter.exec([
            initializeFoo(new Int32(3)),
            fooAssignmentOperator(
                token(Lexeme.BackslashEqual, "\\="),
                new Int32(2)
            )
        ]);

        expect(interpreter.environment.get(identifier("foo"))).toEqual(
            new Int32(1)
        );
    });

    it("exponentiates numbers", () => {
        interpreter.exec([
            initializeFoo(new Int32(3)),
            fooAssignmentOperator(
                token(Lexeme.CaretEqual, "^="),
                new Int32(2)
            )
        ]);

        expect(interpreter.environment.get(identifier("foo"))).toEqual(
            new Float(9)
        );
    });

    // TODO: unskip once bitshift operators are supported
    it.skip("left-shifts numbers", () => {
        interpreter.exec([
            initializeFoo(new Int32(4)),
            fooAssignmentOperator(
                token(Lexeme.LeftShiftEqual, "<<="),
                new Int32(2)
            )
        ]);

        expect(interpreter.environment.get(identifier("foo"))).toEqual(
            new Int32(8)
        );
    });

    // TODO: unskip once bitshift operators are supported
    it.skip("right-shifts numbers", () => {
        interpreter.exec([
            initializeFoo(new Int32(8)),
            fooAssignmentOperator(
                token(Lexeme.RightShiftEqual, ">>="),
                new Int32(2)
            )
        ]);

        expect(interpreter.environment.get(identifier("foo"))).toEqual(
            new Int32(4)
        );
    });
});