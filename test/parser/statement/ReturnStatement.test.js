const { Lexeme, BrsTypes, Parser } = require("brs");
const { BrsString } = BrsTypes;
const BrsError = require("../../../lib/Error");

const { EOF } = require("../ParserTests");

describe("parser return statements", () => {
    afterEach(() => BrsError.reset());

    it("parses void returns", () => {
        let parsed = Parser.parse([
            { kind: Lexeme.Function, text: "function", line: 1 },
            { kind: Lexeme.Identifier, text: "foo", line: 1 },
            { kind: Lexeme.LeftParen, text: "(", line: 1 },
            { kind: Lexeme.RightParen, text: ")", line: 1 },
            { kind: Lexeme.Newline, text: "\\n", line: 1 },
            { kind: Lexeme.Return, text: "return", line: 2 },
            { kind: Lexeme.Newline, text: "\\n", line: 2 },
            { kind: Lexeme.EndFunction, text: "end function", line: 3 },
            EOF
        ]);

        expect(BrsError.found()).toBeFalsy();
        expect(parsed).toBeDefined();
        expect(parsed).not.toBeNull();
        expect(parsed).toMatchSnapshot();
    });

    it("parses literal returns", () => {
        let parsed = Parser.parse([
            { kind: Lexeme.Function, text: "function", line: 1 },
            { kind: Lexeme.Identifier, text: "foo", line: 1 },
            { kind: Lexeme.LeftParen, text: "(", line: 1 },
            { kind: Lexeme.RightParen, text: ")", line: 1 },
            { kind: Lexeme.Newline, text: "\\n", line: 1 },
            { kind: Lexeme.Return, text: "return", line: 2 },
            { kind: Lexeme.String, literal: new BrsString("test"), text: '"test"', line: 2 },
            { kind: Lexeme.Newline, text: "\\n", line: 2 },
            { kind: Lexeme.EndFunction, text: "end function", line: 3 },
            EOF
        ]);

        expect(BrsError.found()).toBeFalsy();
        expect(parsed).toBeDefined();
        expect(parsed).not.toBeNull();
        expect(parsed).toMatchSnapshot();
    });

    it("parses expression returns", () => {
        let parsed = Parser.parse([
            { kind: Lexeme.Function, text: "function", line: 1 },
            { kind: Lexeme.Identifier, text: "foo", line: 1 },
            { kind: Lexeme.LeftParen, text: "(", line: 1 },
            { kind: Lexeme.RightParen, text: ")", line: 1 },
            { kind: Lexeme.Newline, text: "\\n", line: 1 },
            { kind: Lexeme.Return, text: "return", line: 2 },
            { kind: Lexeme.Identifier, text: "RebootSystem", line: 2 },
            { kind: Lexeme.LeftParen,  text: "(", line: 2 },
            { kind: Lexeme.RightParen, text: ")", line: 2 },
            { kind: Lexeme.Newline, text: "\\n", line: 2 },
            { kind: Lexeme.EndFunction, text: "end function", line: 3 },
            EOF
        ]);

        expect(BrsError.found()).toBeFalsy();
        expect(parsed).toBeDefined();
        expect(parsed).not.toBeNull();
        expect(parsed).toMatchSnapshot();
    });
});
