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

    describe("additive expressions", () => {
        it("parses left-associative addition chains", () => {
            let parsed = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: "1", literal: new Int32(1), line: 1 },
                { kind: Lexeme.Plus, text: "+", line: 1 },
                { kind: Lexeme.Integer, text: "2", literal: new Int32(2), line: 1 },
                { kind: Lexeme.Plus, text: "+", line: 1 },
                { kind: Lexeme.Integer, text: "3", literal: new Int32(3), line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses left-associative subtraction chains", () => {
            let parsed = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: "1", literal: new Int32(1), line: 1 },
                { kind: Lexeme.Minus, text: "-", line: 1 },
                { kind: Lexeme.Integer, text: "2", literal: new Int32(2), line: 1 },
                { kind: Lexeme.Minus, text: "-", line: 1 },
                { kind: Lexeme.Integer, text: "3", literal: new Int32(3), line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });
    });
});
