const BrsError = require("../../lib/Error");
const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { token } = require("../parser/ParserTests");
const { binary } = require("./InterpreterTests");
const { Lexeme } = require("../../lib/Lexeme");
const { Interpreter } = require("../../lib/interpreter");
const { Int32, BrsString } = require("../../lib/brsTypes");

let interpreter;

describe("array indexing", () => {
    beforeEach(() => {
        BrsError.reset();
        interpreter = new Interpreter();
    });

    it("retrieves one-dimensional array elements by index", () => {
        let ast = [
            new Stmt.Assignment(
                { kind: Lexeme.Identifier, text: "array", line: 1 },
                new Expr.ArrayLiteral([
                    new Expr.Literal(new BrsString("index0")),
                    new Expr.Literal(new BrsString("index1")),
                    new Expr.Literal(new BrsString("index2")),
                ])
            ),
            new Stmt.Assignment(
                { kind: Lexeme.Identifier, text: "result", line: 2 },
                new Expr.IndexedGet(
                    new Expr.Variable({ kind: Lexeme.Identifier, text: "array", line: 2 }),
                    new Expr.Literal(new Int32(1)),
                    { kind: Lexeme.RightSquare, text: "]", line: 2 }
                )
            )
        ];

        interpreter.exec(ast);

        expect(BrsError.found()).toBeFalsy();
        expect(
            interpreter.environment.get(
                { kind: Lexeme.Identifier, text: "result", line: -1 }
            )
        ).toEqual(new BrsString("index1"));
    });

    it("retrieves multi-dimensional array elements by indexes", () => {
        let ast = [
            new Stmt.Assignment(
                { kind: Lexeme.Identifier, text: "array", line: 1 },
                new Expr.ArrayLiteral([
                    new Expr.ArrayLiteral([
                        new Expr.Literal(new BrsString("(0,0)")),
                        new Expr.Literal(new BrsString("(0,1)")),
                        new Expr.Literal(new BrsString("(0,2)"))
                    ]),
                    new Expr.ArrayLiteral([
                        new Expr.Literal(new BrsString("(1,0)")),
                        new Expr.Literal(new BrsString("(1,1)")),
                        new Expr.Literal(new BrsString("(1,2)"))
                    ]),
                    new Expr.ArrayLiteral([
                        new Expr.Literal(new BrsString("(2,0)")),
                        new Expr.Literal(new BrsString("(2,1)")),
                        new Expr.Literal(new BrsString("(2,2)"))
                    ])
                ])
            ),
            new Stmt.Assignment(
                { kind: Lexeme.Identifier, text: "result", line: 2 },
                new Expr.IndexedGet(
                    new Expr.IndexedGet(
                        new Expr.Variable({ kind: Lexeme.Identifier, text: "array", line: 2 }),
                        new Expr.Literal(new Int32(2)),
                        { kind: Lexeme.RightSquare, text: "]", line: 2 }
                    ),
                    new Expr.Literal(new Int32(1)),
                    { kind: Lexeme.RightSquare, text: "]", line: 2 }
                )
            )
        ];

        interpreter.exec(ast);

        expect(BrsError.found()).toBeFalsy();
        expect(
            interpreter.environment.get(
                { kind: Lexeme.Identifier, text: "result", line: -1 }
            )
        ).toEqual(new BrsString("(2,1)"));
    });
});