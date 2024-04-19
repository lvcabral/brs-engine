const brs = require("../../bin/brs.node");
const { Lexeme } = brs.lexer;
const { Expr, Stmt } = brs.parser;
const { Interpreter } = brs;
const { identifier, token } = require("../parser/ParserTests");
const { Int32, BrsString, BrsInvalid } = brs.types;

const { createMockStreams, allArgs } = require("../e2e/E2ETests");

describe("interpreter print statements", () => {
    let stdout, stderr, interpreter;

    let tokens = {
        print: token(Lexeme.Print, "print"),
    };

    beforeEach(() => {
        const outputStreams = createMockStreams();
        interpreter = new Interpreter(outputStreams);

        stdout = outputStreams.stdout;
        stderr = outputStreams.stderr;
    });

    it("prints single values on their own line", () => {
        const ast = new Stmt.Print(tokens, [new Expr.Literal(new BrsString("foo"))]);

        const [result] = interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
        expect(allArgs(stdout.write).join("")).toEqual("foo\r\n");
    });

    it("prints multiple values with no separators", () => {
        const ast = new Stmt.Print(tokens, [
            new Expr.Literal(new BrsString("foo")),
            new Expr.Literal(new BrsString("bar")),
            new Expr.Literal(new BrsString("baz")),
        ]);

        const [result] = interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
        expect(allArgs(stdout.write).join("")).toEqual("foobarbaz\r\n");
    });

    it("prints multiple values with semi-colon separators", () => {
        const ast = new Stmt.Print(tokens, [
            new Expr.Literal(new BrsString("foo")),
            token(Lexeme.Semicolon, ";"),
            new Expr.Literal(new BrsString("bar")),
            token(Lexeme.Semicolon, ";"),
            new Expr.Literal(new BrsString("baz")),
        ]);

        const [result] = interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
        expect(allArgs(stdout.write).join("")).toEqual("foobarbaz\r\n");
    });

    it("aligns values to 16-character tab stops", () => {
        const ast = new Stmt.Print(tokens, [
            new Expr.Literal(new BrsString("foo")),
            token(Lexeme.Comma, ","),
            new Expr.Literal(new BrsString("barbara")),
            token(Lexeme.Comma, ","),
            new Expr.Literal(new BrsString("baz")),
        ]);

        const [result] = interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
        expect(allArgs(stdout.write).join("")).toEqual(
            //   0   0   0   1   1   2   2   2   3
            //   0   4   8   2   6   0   4   8   2
            "foo             barbara         baz\r\n"
        );
    });

    it("skips cursor-return with a trailing semicolon", () => {
        const ast = new Stmt.Print(tokens, [
            new Expr.Literal(new BrsString("foo")),
            token(Lexeme.Semicolon, ";"),
            new Expr.Literal(new BrsString("bar")),
            token(Lexeme.Semicolon, ";"),
            new Expr.Literal(new BrsString("baz")),
            token(Lexeme.Semicolon, ";"),
        ]);

        const [result] = interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
        expect(allArgs(stdout.write).join("")).toEqual("foobarbaz");
    });

    it("inserts the current position via `pos`", () => {
        const ast = new Stmt.Print(tokens, [
            new Expr.Literal(new BrsString("foo")),
            token(Lexeme.Semicolon, ";"),
            new Expr.Call(new Expr.Variable(identifier("Pos")), token(Lexeme.RightParen, ")"), [
                new Expr.Literal(new Int32(0)),
            ]),
        ]);

        const [result] = interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
        expect(allArgs(stdout.write).join("")).toEqual("foo 3\r\n");
    });

    it("indents to an arbitrary position via `tab`", () => {
        const ast = new Stmt.Print(tokens, [
            new Expr.Literal(new BrsString("foo")),
            new Expr.Call(new Expr.Variable(identifier("Tab")), token(Lexeme.RightParen, ")"), [
                new Expr.Literal(new Int32(6)),
            ]),
            new Expr.Literal(new BrsString("bar")),
        ]);

        const [result] = interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
        expect(allArgs(stdout.write).join("")).toEqual("foo   bar\r\n");
    });

    it("prints uninitialized values with placeholder text", () => {
        const ast = new Stmt.Print(tokens, [new Expr.Variable(identifier("doesNotExist"))]);

        const [result] = interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
        expect(allArgs(stdout.write).join("")).toEqual("<UNINITIALIZED>\r\n");
    });
});
