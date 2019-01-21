const brs = require("brs");
const { Lexeme, BrsTypes } = brs;
const { Int32, BrsBoolean } = BrsTypes;
const BrsError = require("../../../lib/Error");

const { EOF } = require("../ParserTests");

describe("parser", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    afterEach(() => BrsError.reset());

    describe("unary expressions", () => {
        it("parses unary 'not'", () => {
            let parsed = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Not, text: "not", line: 1 },
                { kind: Lexeme.True, text: "true", literal: BrsBoolean.True, line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses consecutive unary 'not'", () => {
            let parsed = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Not, text: "not", line: 1 },
                { kind: Lexeme.Not, text: "not", line: 1 },
                { kind: Lexeme.Not, text: "not", line: 1 },
                { kind: Lexeme.Not, text: "not", line: 1 },
                { kind: Lexeme.Not, text: "not", line: 1 },
                { kind: Lexeme.True, text: "true", literal: BrsBoolean.True, line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses unary '-'", () => {
            let parsed = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Minus, text: "-", line: 1},
                { kind: Lexeme.Integer, text: "5", literal: new Int32(5), line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses consecutive unary '-'", () => {
            let parsed = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Minus, text: "-", line: 1},
                { kind: Lexeme.Minus, text: "-", line: 1},
                { kind: Lexeme.Minus, text: "-", line: 1},
                { kind: Lexeme.Minus, text: "-", line: 1},
                { kind: Lexeme.Minus, text: "-", line: 1},
                { kind: Lexeme.Integer, text: "5", literal: new Int32(5), line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });
    });
});
