const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { token, identifier } = require("../parser/ParserTests");
const { Interpreter } = require("../../lib/interpreter");
const brs = require("brs");
const { Lexeme } = brs.lexer;
const { Int32, BrsString, BrsInvalid } = brs.types;

const { createMockStreams, allArgs } = require("../e2e/E2ETests");

describe("interperter print statements", () => {
    let stdout, stderr, interpreter;

    let tokens = {
        print: token(Lexeme.Print, "print")
    };

    beforeEach(() => {
        const outputStreams = createMockStreams();
        interpreter = new Interpreter(outputStreams);

        stdout = outputStreams.stdout;
        stderr = outputStreams.stderr;
    });

    it("prints single values on their own line", () => {
        const ast = new Stmt.Print(
            tokens,
            [ new Expr.Literal(new BrsString("foo")) ]
        );

        const [ result ] = interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
        expect(allArgs(stdout.write).join("")).toEqual(
            "foo\n"
        );
    });

    it("prints multiple values with no separators", () => {
        const ast = new Stmt.Print(
            tokens,
            [
                new Expr.Literal(new BrsString("foo")),
                new Expr.Literal(new BrsString("bar")),
                new Expr.Literal(new BrsString("baz")),
            ]
        );

        const [ result ] = interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
        expect(allArgs(stdout.write).join("")).toEqual(
            "foobarbaz\n"
        );
    });

    it("prints multiple values with space separators", () => {
        const ast = new Stmt.Print(
            tokens,
            [
                new Expr.Literal(new BrsString("foo")),
                token(Lexeme.Semicolon, ";"),
                new Expr.Literal(new BrsString("bar")),
                token(Lexeme.Semicolon, ";"),
                new Expr.Literal(new BrsString("baz")),
            ]
        );

        const [ result ] = interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
        expect(allArgs(stdout.write).join("")).toEqual(
            "foo bar baz\n"
        );
    });

    it("aligns values to 16-charcater tab stops", () => {
        const ast = new Stmt.Print(
            tokens,
            [
                new Expr.Literal(new BrsString("foo")),
                token(Lexeme.Comma, ","),
                new Expr.Literal(new BrsString("barbara")),
                token(Lexeme.Comma, ","),
                new Expr.Literal(new BrsString("baz")),
            ]
        );

        const [ result ] = interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
        expect(allArgs(stdout.write).join("")).toEqual(
        //   0   0   0   1   1   2   2   2   3
        //   0   4   8   2   6   0   4   8   2
            "foo             barbara         baz\n"
        );
    });

    it("skips cursor-return with a trailing semicolon", () => {
        const ast = new Stmt.Print(
            tokens,
            [
                new Expr.Literal(new BrsString("foo")),
                token(Lexeme.Semicolon, ";"),
                new Expr.Literal(new BrsString("bar")),
                token(Lexeme.Semicolon, ";"),
                new Expr.Literal(new BrsString("baz")),
                token(Lexeme.Semicolon, ";"),
            ]
        );

        const [ result ] = interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
        expect(allArgs(stdout.write).join("")).toEqual(
            "foo bar baz"
        );
    });

    it("inserts the current position via `pos`", () => {
        const ast = new Stmt.Print(
            tokens,
            [
                new Expr.Literal(new BrsString("foo")),
                token(Lexeme.Semicolon, ";"),
                new Expr.Call(
                    new Expr.Variable(identifier("Pos")),
                    token(Lexeme.RightParen, ")"),
                    [ new Expr.Literal(new Int32(0)) ]
                )
            ]
        );

        const [ result ] = interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
        expect(allArgs(stdout.write).join("")).toEqual(
            "foo 4\n"
        );
    });

    it("indents to an arbitrary position via `tab`", () => {
        const ast = new Stmt.Print(
            tokens,
            [
                new Expr.Literal(new BrsString("foo")),
                new Expr.Call(
                    new Expr.Variable(identifier("Tab")),
                    token(Lexeme.RightParen, ")"),
                    [ new Expr.Literal(new Int32(6)) ]
                ),
                new Expr.Literal(new BrsString("bar"))
            ]
        );

        const [ result ] = interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
        expect(allArgs(stdout.write).join("")).toEqual(
            "foo   bar\n"
        );
    });

    it("prints uninitialized values with placeholder text", () => {
        const ast = new Stmt.Print(
            tokens,
            [ new Expr.Variable(identifier("doesNotExist")) ]
        );

        const [ result ] = interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
        expect(allArgs(stdout.write).join("")).toEqual(
            "<UNINITIALIZED>\n"
        );
    });
});
