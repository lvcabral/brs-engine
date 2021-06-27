const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { Interpreter } = require("../../lib/interpreter");
const brs = require("brs");
const { Lexeme } = brs.lexer;
const { Int32, BrsString } = brs.types;

const { token, identifier, fakeLocation } = require("../parser/ParserTests");

let interpreter;

const LEFT_SQUARE = token(Lexeme.LeftSquare, "[");
const RIGHT_SQUARE = token(Lexeme.RightSquare, "]");
const LEFT_BRACE = token(Lexeme.LeftBrace, "{");
const RIGHT_BRACE = token(Lexeme.RightBrace, "}");

describe("creating arrays using dim", () => {
    beforeEach(() => {
        interpreter = new Interpreter();
    });

    test("one-dimensional creation", () => {
        let maxIndex = 5;
        let statements = [
            new Stmt.Dim(
                {
                    dim: token(Lexeme.Dim, "dim"),
                    closingBrace: token(Lexeme.RightSquare, "closingSquare"),
                },
                identifier("array"),
                [new Expr.Literal(new Int32(maxIndex))]
            ),
            new Stmt.IndexedSet(
                new Expr.Variable(identifier("array")),
                new Expr.Literal(new Int32(4), fakeLocation),
                new Expr.Literal(new BrsString("new index4"), fakeLocation),
                RIGHT_SQUARE
            ),
            new Stmt.Assignment(
                { equals: token(Lexeme.Equals, "=") },
                identifier("result"),
                new Expr.IndexedGet(
                    new Expr.Variable(identifier("array")),
                    new Expr.Literal(new Int32(4), fakeLocation),
                    RIGHT_SQUARE
                )
            ),
        ];

        interpreter.exec(statements);
        expect(interpreter.environment.get(identifier("result"))).toEqual(
            new BrsString("new index4")
        );

        // NOTE: Roku's dim implementation creates a resizeable, empty array for the
        //   bottom children. Resizeable arrays aren't implemented yet (issue #530),
        //   so when that's added this code should be updated so the final array size
        //   matches the index of what it expanded to after assignment
        let arr = interpreter.environment.get(identifier("array"));
        let count = arr.getMethod("count");
        expect(count.call(interpreter)).toEqual(new Int32(maxIndex + 1));
    });

    test("multi-dimensional creation", () => {
        let maxIndex1 = 6;
        let maxIndex2 = 3;
        let statements = [
            new Stmt.Dim(
                {
                    dim: token(Lexeme.Dim, "dim"),
                    closingBrace: token(Lexeme.RightSquare, "closingSquare"),
                },
                identifier("baseArray"),
                [new Expr.Literal(new Int32(maxIndex1)), new Expr.Literal(new Int32(maxIndex2))]
            ),
            new Stmt.IndexedSet(
                new Expr.IndexedGet(
                    new Expr.Variable(identifier("baseArray")),
                    new Expr.Literal(new Int32(2), fakeLocation),
                    RIGHT_SQUARE
                ),
                new Expr.Literal(new Int32(1), fakeLocation),
                new Expr.Literal(new BrsString("new (2,1)"), fakeLocation),
                RIGHT_SQUARE
            ),
            new Stmt.Assignment(
                { equals: token(Lexeme.Equals, "=") },
                identifier("result"),
                new Expr.IndexedGet(
                    new Expr.IndexedGet(
                        new Expr.Variable(identifier("baseArray")),
                        new Expr.Literal(new Int32(2), fakeLocation),
                        RIGHT_SQUARE
                    ),
                    new Expr.Literal(new Int32(1), fakeLocation),
                    RIGHT_SQUARE
                )
            ),
        ];

        interpreter.exec(statements);
        expect(interpreter.environment.has(identifier("baseArray"))).toBe(true);
        expect(interpreter.environment.get(identifier("result"))).toEqual(
            new BrsString("new (2,1)")
        );

        // NOTE: Roku's dim implementation creates a resizeable, empty array for the
        //   bottom children. Resizeable arrays aren't implemented yet (issue #530),
        //   so when that's added this code should be updated so the final array size
        //   matches the index of what it expanded to after assignment
        let arr = interpreter.environment.get(identifier("baseArray"));
        let count = arr.getMethod("count");
        expect(count.call(interpreter)).toEqual(new Int32(maxIndex1 + 1));
    });
});
