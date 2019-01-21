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

    describe("unary expressions", () => {
        it("parses unary 'not'", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Not, text: "not", line: 1 },
                { kind: Lexeme.True, text: "true", literal: BrsBoolean.True, line: 1 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses consecutive unary 'not'", () => {
            let { statements, errors } = parser.parse([
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

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses unary '-'", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Minus, text: "-", line: 1},
                { kind: Lexeme.Integer, text: "5", literal: new Int32(5), line: 1 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses consecutive unary '-'", () => {
            let { statements, errors } = parser.parse([
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

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });
    });
});
