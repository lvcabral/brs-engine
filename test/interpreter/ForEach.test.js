const BrsError = require("../../lib/Error");
const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { Lexeme } = require("../../lib/Lexeme");
const { Interpreter } = require("../../lib/interpreter");
const { BrsArray, BrsString } = require("../../lib/brsTypes");
const { identifier } = require("../parser/ParserTests");

let interpreter;
let decrementSpy;

describe("interpreter for-each loops", () => {
    const arrayMembers = [
            new BrsString("foo"),
            new BrsString("bar"),
            new BrsString("baz")
    ];

    beforeEach(() => {
        BrsError.reset();
        interpreter = new Interpreter();
    });

    afterEach(() => {
        jest.resetAllMocks();
        jest.restoreAllMocks();
    });

    it("iterates across all elements of an array", () => {
        const emptyBlock = new Stmt.Block([]);
        const receivedElements = [];
        const emptyBlockSpy = jest.spyOn(emptyBlock, "accept").mockImplementation(_interpreter =>
            receivedElements.push(
                _interpreter.environment.get(
                    { kind: Lexeme.Identifier, text: "element", line: -1 }
                )
            )
        );

        const statements = [
            new Stmt.Assignment(
                { kind: Lexeme.Identifier, text: "array", line: 1 },
                new Expr.ArrayLiteral(
                    arrayMembers.map(member => new Expr.Literal(member))
                )
            ),
            new Stmt.ForEach(
                { kind: Lexeme.Identifier, text: "element", line: 2 },
                new Expr.Variable({ kind: Lexeme.Identifier, text: "array", line: 2 }),
                emptyBlock
            )
        ];

        interpreter.exec(statements);
        expect(emptyBlockSpy).toHaveBeenCalledTimes(3);
        expect(receivedElements).toEqual(arrayMembers);
    });

    it("doesn't exceute the body for empty arrays", () => {
        const emptyBlock = new Stmt.Block([]);
        const emptyBlockSpy = jest.spyOn(emptyBlock, "accept");

        const statements = [
            new Stmt.Assignment(
                { kind: Lexeme.Identifier, text: "empty", line: 1 },
                new Expr.ArrayLiteral([])
            ),
            new Stmt.ForEach(
                { kind: Lexeme.Identifier, text: "element", line: 2 },
                new Expr.Variable({ kind: Lexeme.Identifier, text: "empty", line: 2 }),
                emptyBlock
            )
        ];

        interpreter.exec(statements);
        expect(emptyBlockSpy).not.toHaveBeenCalled();
    });
});