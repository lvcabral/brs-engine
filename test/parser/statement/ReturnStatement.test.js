const brs = require("brs");
const { Lexeme, BrsTypes } = brs;
const { BrsString } = BrsTypes;
const BrsError = require("../../../lib/Error");

const { EOF } = require("../ParserTests");

describe("parser return statements", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    afterEach(() => BrsError.reset());

    it("parses void returns", () => {
        let { statements, errors } = parser.parse([
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

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("parses literal returns", () => {
        let { statements, errors } = parser.parse([
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

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("parses expression returns", () => {
        let { statements, errors } = parser.parse([
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

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });
});
