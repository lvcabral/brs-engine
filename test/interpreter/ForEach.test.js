const brs = require("../../packages/node/bin/brs.node");
const { Interpreter, Lexeme, Expr, Stmt } = brs;
const { BrsString } = brs.types;

const { token, identifier, fakeLocation } = require("../parser/ParserTests");

const LEFT_SQUARE = token(Lexeme.LeftSquare, "[");
const RIGHT_SQUARE = token(Lexeme.RightSquare, "]");

let interpreter;

describe("interpreter for-each loops", () => {
    const arrayMembers = [new BrsString("foo"), new BrsString("bar"), new BrsString("baz")];
    const filledArray = new Expr.ArrayLiteral(
        arrayMembers.map((member) => new Expr.Literal(member, fakeLocation)),
        LEFT_SQUARE,
        RIGHT_SQUARE
    );

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        jest.resetAllMocks();
        jest.restoreAllMocks();
    });

    it("iterates across all elements of an array", () => {
        const emptyBlock = new Stmt.Block([]);
        const receivedElements = [];
        const emptyBlockSpy = jest
            .spyOn(emptyBlock, "accept")
            .mockImplementation((_interpreter) =>
                receivedElements.push(_interpreter.environment.get(identifier("element")))
            );

        const statements = [
            new Stmt.Assignment({ equals: token(Lexeme.Equals, "=") }, identifier("array"), filledArray),
            new Stmt.ForEach(
                {
                    forEach: token(Lexeme.ForEach, "for each"),
                    in: identifier("in"),
                    endFor: token(Lexeme.EndFor, "end for"),
                },
                identifier("element"),
                new Expr.Variable(identifier("array")),
                emptyBlock
            ),
        ];

        interpreter.exec(statements);

        expect(emptyBlockSpy).toHaveBeenCalledTimes(3);
        expect(receivedElements).toEqual(arrayMembers);
    });

    it("doesn't execute the body for empty arrays", () => {
        const emptyBlock = new Stmt.Block([]);
        const emptyBlockSpy = jest.spyOn(emptyBlock, "accept");

        const statements = [
            new Stmt.Assignment(
                { equals: token(Lexeme.Equals, "=") },
                identifier("empty"),
                new Expr.ArrayLiteral([], LEFT_SQUARE, RIGHT_SQUARE)
            ),
            new Stmt.ForEach(
                {
                    forEach: token(Lexeme.ForEach, "for each"),
                    in: identifier("in"),
                    endFor: token(Lexeme.EndFor, "end for"),
                },
                identifier("element"),
                new Expr.Variable(identifier("empty")),
                emptyBlock
            ),
        ];

        interpreter.exec(statements);

        expect(emptyBlockSpy).not.toHaveBeenCalled();
    });

    it("leaves the loop variable in-scope after loop", () => {
        const emptyBlock = new Stmt.Block([]);

        const statements = [
            new Stmt.Assignment({ equals: token(Lexeme.Equals, "=") }, identifier("array"), filledArray),
            new Stmt.ForEach(
                {
                    forEach: token(Lexeme.ForEach, "for each"),
                    in: identifier("in"),
                    endFor: token(Lexeme.EndFor, "end for"),
                },
                identifier("element"),
                new Expr.Variable(identifier("array")),
                emptyBlock
            ),
        ];

        interpreter.exec(statements);

        expect(interpreter.environment.get(identifier("element"))).toEqual(arrayMembers[arrayMembers.length - 1]);
    });

    it("exits early when it encounters 'exit for'", () => {
        const block = new Stmt.Block([new Stmt.ExitFor({ exitFor: token(Lexeme.ExitFor, "exit for") })]);
        const blockSpy = jest.spyOn(block, "accept");

        const statements = [
            new Stmt.Assignment({ equals: token(Lexeme.Equals, "=") }, identifier("array"), filledArray),
            new Stmt.ForEach(
                {
                    forEach: token(Lexeme.ForEach, "for each"),
                    in: identifier("in"),
                    endFor: token(Lexeme.EndFor, "end for"),
                },
                identifier("element"),
                new Expr.Variable(identifier("array")),
                block
            ),
        ];

        interpreter.exec(statements);

        expect(blockSpy).toHaveBeenCalledTimes(1);
    });

    it("iterates across all elements of an array skipping `exit for` with `continue for`", () => {
        const block = new Stmt.Block([
            new Stmt.ContinueFor({ continueFor: token(Lexeme.ContinueFor, "continue for") }),
            new Stmt.ExitFor({ exitFor: token(Lexeme.ExitFor, "exit for") }),
        ]);
        const blockSpy = jest.spyOn(block, "accept");

        const statements = [
            new Stmt.Assignment({ equals: token(Lexeme.Equals, "=") }, identifier("array"), filledArray),
            new Stmt.ForEach(
                {
                    forEach: token(Lexeme.ForEach, "for each"),
                    in: identifier("in"),
                    endFor: token(Lexeme.EndFor, "end for"),
                },
                identifier("element"),
                new Expr.Variable(identifier("array")),
                block
            ),
        ];
        interpreter.exec(statements);

        expect(blockSpy).toHaveBeenCalledTimes(3);
    });
});
