const brs = require("../../bin/brs.node");
const { Lexeme } = brs.lexer;
const { Expr, Stmt } = brs.parser;
const { Interpreter } = brs;
const { Int32, BrsString } = brs.types;

const { createMockStreams, allArgs } = require("../e2e/E2ETests");
const { token, identifier } = require("../parser/ParserTests");

let interpreter, stdout;

describe("interpreter try-catch blocks", () => {
    const printError = new Stmt.Print({ print: token(Lexeme.Print, "print") }, [new Expr.Variable(identifier("e"))]);

    beforeEach(() => {
        const outputStreams = createMockStreams();
        interpreter = new Interpreter(outputStreams);
        stdout = outputStreams.stdout;
    });

    afterEach(() => {
        jest.resetAllMocks();
        jest.restoreAllMocks();
    });

    it("executes the try block when no errors are thrown", () => {
        const varAssignment = new Stmt.Assignment(
            { equals: token(Lexeme.Equals, "=") },
            identifier("a"),
            new Expr.Literal(new Int32(0))
        );
        const trySpy = jest.spyOn(varAssignment, "accept");
        const catchSpy = jest.spyOn(printError, "accept");

        const statements = [
            new Stmt.TryCatch(
                /* try block */ new Stmt.Block([varAssignment]),
                /* catch block */ new Stmt.Block([printError]),
                /* error binding */ new Expr.Variable(identifier("e")),
                {
                    try: token(Lexeme.Try, "try"),
                    catch: token(Lexeme.Catch, "catch"),
                    endtry: token(Lexeme.EndTry, "end try"),
                }
            ),
        ];

        interpreter.exec(statements);
        expect(trySpy).toHaveBeenCalledTimes(1);
        expect(catchSpy).not.toHaveBeenCalled();
    });

    it("executes the catch block when an error is thrown", () => {
        const badComparison = new Expr.Binary(
            new Expr.Literal(new Int32(2)),
            token(Lexeme.Less),
            new Expr.Literal(new BrsString("1"))
        );
        const trySpy = jest.spyOn(badComparison, "accept");
        const catchSpy = jest.spyOn(printError, "accept");

        const statements = [
            new Stmt.TryCatch(
                /* try block */ new Stmt.Block([badComparison]),
                /* catch block */ new Stmt.Block([printError]),
                /* error binding */ new Expr.Variable(identifier("e")),
                {
                    try: token(Lexeme.Try, "try"),
                    catch: token(Lexeme.Catch, "catch"),
                    endtry: token(Lexeme.EndTry, "end try"),
                }
            ),
        ];

        interpreter.exec(statements);
        expect(trySpy).toHaveBeenCalledTimes(1);
        expect(catchSpy).toHaveBeenCalledTimes(1);
        const output = allArgs(stdout.write).filter((arg) => arg !== "\n");
        expect(output[0]).toMatch(/Type Mismatch./);
    });
});
