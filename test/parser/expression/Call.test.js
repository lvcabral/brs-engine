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
        const { statements, errors } = parser.parse([
            { kind: Lexeme.Identifier, text: "RebootSystem", line: 1 },
            { kind: Lexeme.LeftParen,  text: "(", line: 1 },
            { kind: Lexeme.RightParen, text: ")", line: 1 },
            EOF
        ]);

        expect(errors).toEqual([])
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("allows closing parentheses on separate line", () => {
        const { statements, errors } = parser.parse([
            { kind: Lexeme.Identifier, text: "RebootSystem", line: 1 },
            { kind: Lexeme.LeftParen,  text: "(", line: 1 },
            { kind: Lexeme.Newline, text: "\\n", line: 1 },
            { kind: Lexeme.Newline, text: "\\n", line: 2 },
            { kind: Lexeme.RightParen, text: ")", line: 3 },
            EOF
        ]);

        expect(errors).toEqual([])
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("accepts arguments", () => {
        const { statements, errors } = parser.parse([
            { kind: Lexeme.Identifier, text: "add", line: 1 },
            { kind: Lexeme.LeftParen,  text: "(", line: 1 },
            { kind: Lexeme.Integer, text: "1", literal: new Int32(1) },
            { kind: Lexeme.Comma,  text: ",", line: 1 },
            { kind: Lexeme.Integer, text: "2", literal: new Int32(2) },
            { kind: Lexeme.RightParen, text: ")", line: 1 },
            EOF
        ]);

        expect(errors).toEqual([])
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements[0].expression.args).toBeTruthy();
        expect(statements).toMatchSnapshot();
    });
});
