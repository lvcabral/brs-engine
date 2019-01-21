const BrsError = require("../../../lib/Error");
const brs = require("brs");
const { Lexeme, BrsTypes } = brs;
const { BrsBoolean } = BrsTypes;

const { EOF } = require("../ParserTests");

describe("parser", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    afterEach(() => BrsError.reset());

    describe("boolean expressions", () => {
        it("parses boolean ANDs", () => {
            let parsed = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.True, text: "true", literal: BrsBoolean.True, line: 1 },
                { kind: Lexeme.And, text: "and", line: 1 },
                { kind: Lexeme.False, text: "false", literal: BrsBoolean.False, line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses boolean ORs", () => {
            let parsed = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.True, text: "true", literal: BrsBoolean.True, line: 1 },
                { kind: Lexeme.Or, text: "or", line: 1 },
                { kind: Lexeme.False, text: "false", literal: BrsBoolean.False, line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });
    });
});
