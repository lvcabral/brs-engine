const Parser = require("../../../lib/parser");
const Expr = require("../../../lib/parser/Expression");
const BrsError = require("../../../lib/Error");
const { Lexeme, BrsTypes } = require("brs");
const { Int32 } = BrsTypes;

const { EOF } = require("../ParserTests");

describe("parser for loops", () => {
    afterEach(() => BrsError.reset());

    it("accepts a 'step' clause", () => {
        let parsed = Parser.parse([
            { kind: Lexeme.For, text: "for", line: 1 },
            { kind: Lexeme.Identifier, text: "i", line: 1 },
            { kind: Lexeme.Equal, text: "=", line: 1 },
            { kind: Lexeme.Integer, text: "0", literal: new Int32(0), line: 1 },
            { kind: Lexeme.To, text: "to", line: 1 },
            { kind: Lexeme.Integer, text: "5", literal: new Int32(5), line: 1 },
            { kind: Lexeme.Step, text: "step", line: 1 },
            { kind: Lexeme.Integer, text: "2", literal: new Int32(2), line: 1 },
            { kind: Lexeme.Newline, text: "\n", line: 1 },
            // body would go here, but it's not necessary for this test
            { kind: Lexeme.EndFor, text: "end for", line: 2 },
            { kind: Lexeme.Newline, text: "\n", line: 2 },
            EOF
        ]);

        expect(BrsError.found()).toBe(false);
        expect(parsed).toBeDefined();
        expect(parsed[0]).toBeDefined();
        expect(parsed[0].increment).toBeDefined();
        expect(parsed[0].increment.value).toEqual(new Int32(2));

        expect(parsed).toMatchSnapshot();
    });

    it("defaults a missing 'step' clause to '1'", () => {
        let parsed = Parser.parse([
            { kind: Lexeme.For, text: "for", line: 1 },
            { kind: Lexeme.Identifier, text: "i", line: 1 },
            { kind: Lexeme.Equal, text: "=", line: 1 },
            { kind: Lexeme.Integer, text: "0", literal: new Int32(0), line: 1 },
            { kind: Lexeme.To, text: "to", line: 1 },
            { kind: Lexeme.Integer, text: "5", literal: new Int32(5), line: 1 },
            { kind: Lexeme.Newline, text: "\n", line: 1 },
            // body would go here, but it's not necessary for this test
            { kind: Lexeme.EndFor, text: "end for", line: 2 },
            { kind: Lexeme.Newline, text: "\n", line: 2 },
            EOF
        ]);

        expect(BrsError.found()).toBe(false);
        expect(parsed).toBeDefined();
        expect(parsed[0]).toBeDefined();
        expect(parsed[0].increment).toBeDefined();
        expect(parsed[0].increment.value).toEqual(new Int32(1));

        expect(parsed).toMatchSnapshot();
    });
});