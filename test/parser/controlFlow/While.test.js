const brs = require("brs");
const { Lexeme } = brs.lexer;
const { BrsBoolean, BrsString } = brs.types;
const { EOF } = require("../ParserTests");

describe("parser while statements", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    test("while without exit", () => {
        const { statements, errors } = parser.parse([
            { kind: Lexeme.While, text: "while" },
            { kind: Lexeme.True, literal: BrsBoolean.True, text: "true" },
            { kind: Lexeme.Newline, text: "\n" },
            { kind: Lexeme.Print, text: "print" },
            { kind: Lexeme.String, literal: new BrsString("looping"), text: "looping" },
            { kind: Lexeme.Newline, text: "\n" },
            { kind: Lexeme.EndWhile, text: "end while" },
            EOF
        ]);

        expect(errors).toEqual([])
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    test("while with exit", () => {
        const { statements, errors } = parser.parse([
            { kind: Lexeme.While, text: "while" },
            { kind: Lexeme.True, literal: BrsBoolean.True, text: "true" },
            { kind: Lexeme.Newline, text: "\n" },
            { kind: Lexeme.Print, text: "print" },
            { kind: Lexeme.String, literal: new BrsString("looping"), text: "looping" },
            { kind: Lexeme.Newline, text: "\n" },
            { kind: Lexeme.ExitWhile, text: "exit while" },
            { kind: Lexeme.Newline, text: "\n" },
            { kind: Lexeme.EndWhile, text: "end while" },
            EOF
        ]);

        expect(errors).toEqual([])
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });
});
