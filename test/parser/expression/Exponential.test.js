const BrsError = require("../../../lib/Error");
const brs = require("brs");
const { Lexeme, BrsTypes } = brs;
const { Int32 } = BrsTypes;

const { EOF } = require("../ParserTests");

describe("parser", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    afterEach(() => BrsError.reset());

    describe("exponential expressions", () => {
        it("parses exponential operators", () => {
            let parsed = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: "2", literal: new Int32(2), line: 1 },
                { kind: Lexeme.Caret, text: "^", line: 1 },
                { kind: Lexeme.Integer, text: "3", literal: new Int32(3), line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses repeated exponential operators as left-associative", () => {
            let parsed = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: "2", literal: new Int32(2), line: 1 },
                { kind: Lexeme.Caret, text: "^", line: 1 },
                { kind: Lexeme.Integer, text: "3", literal: new Int32(3), line: 1 },
                { kind: Lexeme.Caret, text: "^", line: 1 },
                { kind: Lexeme.Integer, text: "4", literal: new Int32(4), line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });
    });
});
