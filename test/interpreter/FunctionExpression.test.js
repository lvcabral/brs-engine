const brs = require("../../packages/node/bin/brs.node");
const { Interpreter, Lexeme, Expr, Stmt } = brs;
const { ValueKind, BrsString } = brs.types;

const { createMockStreams, allArgs } = require("../e2e/E2ETests");
const { token } = require("../parser/ParserTests");

let interpreter;

describe("interpreter function expressions", () => {
    let tokens = {
        print: token(Lexeme.Print, "print"),
    };

    beforeEach(() => {
        const outputStreams = createMockStreams();
        interpreter = new Interpreter(outputStreams);
        stdout = outputStreams.stdout;
    });

    it("creates callable functions", () => {
        let mainBody = new Stmt.Block([new Stmt.Print(tokens, [new Expr.Literal(new BrsString("foo"))])]);

        let statements = [
            new Expr.Call(
                new Expr.Grouping(
                    {
                        left: token(Lexeme.LeftParen),
                        right: token(Lexeme.RightParen),
                    },
                    new Expr.Function(
                        [],
                        ValueKind.Void,
                        mainBody,
                        token(Lexeme.Sub, "sub"),
                        token(Lexeme.EndSub, "end sub")
                    )
                ),
                token(Lexeme.RightParen, ")"),
                []
            ),
        ];

        interpreter.exec(statements);

        expect(allArgs(stdout.write).join("")).toEqual("foo\r\n");
    });
});
