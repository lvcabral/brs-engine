const BrsError = require("../../../lib/Error");
const brs = require("brs");
const { Lexeme, BrsTypes } = brs;
const { Int32 } = BrsTypes;

const { EOF } = require("../ParserTests");

describe("parser call expressions", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    afterEach(() => BrsError.reset());

    it("parses named function calls", () => {
        const parsed = parser.parse([
            { kind: Lexeme.Identifier, text: "RebootSystem", line: 1 },
            { kind: Lexeme.LeftParen,  text: "(", line: 1 },
            { kind: Lexeme.RightParen, text: ")", line: 1 },
            EOF
        ]);

        expect(BrsError.found()).toBe(false);
        expect(parsed).toBeDefined();
        expect(parsed).not.toBeNull();
        expect(parsed).toMatchSnapshot();
    });

    it("allows closing parentheses on separate line", () => {
        const parsed = parser.parse([
            { kind: Lexeme.Identifier, text: "RebootSystem", line: 1 },
            { kind: Lexeme.LeftParen,  text: "(", line: 1 },
            { kind: Lexeme.Newline, text: "\\n", line: 1 },
            { kind: Lexeme.Newline, text: "\\n", line: 2 },
            { kind: Lexeme.RightParen, text: ")", line: 3 },
            EOF
        ]);

        expect(BrsError.found()).toBe(false);
        expect(parsed).toBeDefined();
        expect(parsed).not.toBeNull();
        expect(parsed).toMatchSnapshot();
    });

    it("accepts arguments", () => {
        const parsed = parser.parse([
            { kind: Lexeme.Identifier, text: "add", line: 1 },
            { kind: Lexeme.LeftParen,  text: "(", line: 1 },
            { kind: Lexeme.Integer, text: "1", literal: new Int32(1) },
            { kind: Lexeme.Comma,  text: ",", line: 1 },
            { kind: Lexeme.Integer, text: "2", literal: new Int32(2) },
            { kind: Lexeme.RightParen, text: ")", line: 1 },
            EOF
        ]);

        expect(BrsError.found()).toBe(false);
        expect(parsed).toBeDefined();
        expect(parsed).not.toBeNull();
        expect(parsed[0].expression.args).toBeTruthy();
        expect(parsed).toMatchSnapshot();
    });
});
