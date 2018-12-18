const BrsError = require("../../../lib/Error");

const { Lexeme, BrsTypes, Parser } = require("brs");
const { Int32, BrsString } = BrsTypes;

const { EOF } = require("../ParserTests");
describe("parser indexed assignment", () => {
    it("assigns to dotted index", () => {
        let parsed = Parser.parse([
            { kind: Lexeme.Identifier, text: "foo", line: 1 },
            { kind: Lexeme.Dot, text: ".", line: 1 },
            { kind: Lexeme.Identifier, text: "bar", line: 1 },
            { kind: Lexeme.Equal, text: "=", line: 1 },
            { kind: Lexeme.String, text: "baz", line: 1, literal: new BrsString("baz") },
            EOF
        ]);

        expect(BrsError.found()).toBe(false);
        expect(parsed).toBeDefined();
        expect(parsed).not.toBeNull();
        expect(parsed).toMatchSnapshot();
    });

    it("assigns to bracketed index", () => {
        let parsed = Parser.parse([
            { kind: Lexeme.Identifier, text: "someArray", line: 1 },
            { kind: Lexeme.LeftSquare, text: "[", line: 1 },
            { kind: Lexeme.Integer, text: "0", line: 1, literal: new Int32(0) },
            { kind: Lexeme.RightSquare, text: "]", line: 1 },
            { kind: Lexeme.Equal, text: "=", line: 1 },
            { kind: Lexeme.String, text: "baz", line: 1, literal: new BrsString("baz") },
            EOF
        ]);

        expect(BrsError.found()).toBe(false);
        expect(parsed).toBeDefined();
        expect(parsed).not.toBeNull();
        expect(parsed).toMatchSnapshot();
    });
});
