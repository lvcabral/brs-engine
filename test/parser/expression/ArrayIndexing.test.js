const Parser = require("../../../lib/parser");
const BrsError = require("../../../lib/Error");
const { Lexeme, BrsTypes } = require("brs");
const { Int32 } = BrsTypes;

const { EOF } = require("../ParserTests");

describe("parser array indexing", () => {
    afterEach(() => BrsError.reset());

    test("one-dimensional indexing", () => {
        let parsed = Parser.parse([
            { kind: Lexeme.Identifier, text: "_", line: 1 },
            { kind: Lexeme.Equal, text: "=", line: 1 },
            { kind: Lexeme.Identifier, text: "foo", line: 1 },
            { kind: Lexeme.LeftSquare, text: "[", line: 1 },
            { kind: Lexeme.Integer, text: "2", literal: new Int32(2), line: 1 },
            { kind: Lexeme.RightSquare, text: "]", line: 1 },
            EOF
        ]);

        expect(BrsError.found()).toBeFalsy();
        expect(parsed).toBeDefined();
        expect(parsed).not.toBeNull();
        expect(parsed).toMatchSnapshot();
    });

    test("multi-dimensional indexing", () => {
        let parsed = Parser.parse([
            { kind: Lexeme.Identifier, text: "_", line: 1 },
            { kind: Lexeme.Equal, text: "=", line: 1 },
            { kind: Lexeme.Identifier, text: "foo", line: 1 },
            { kind: Lexeme.LeftSquare, text: "[", line: 1 },
            { kind: Lexeme.Integer, text: "2", literal: new Int32(2), line: 1 },
            { kind: Lexeme.RightSquare, text: "]", line: 1 },
            { kind: Lexeme.LeftSquare, text: "[", line: 1 },
            { kind: Lexeme.Integer, text: "0", literal: new Int32(0), line: 1 },
            { kind: Lexeme.RightSquare, text: "]", line: 1 },
            { kind: Lexeme.LeftSquare, text: "[", line: 1 },
            { kind: Lexeme.Integer, text: "6", literal: new Int32(6), line: 1 },
            { kind: Lexeme.RightSquare, text: "]", line: 1 },
            EOF
        ]);

        expect(BrsError.found()).toBeFalsy();
        expect(parsed).toBeDefined();
        expect(parsed).not.toBeNull();
        expect(parsed).toMatchSnapshot();
    });
});