const Parser = require("../../../lib/parser");
const BrsError = require("../../../lib/Error");
const { Lexeme, BrsTypes } = require("brs");
const { Int32 } = BrsTypes;

const { EOF } = require("../ParserTests");

describe("parser", () => {
    afterEach(() => BrsError.reset());

    describe("relational expressions", () => {
        it("parses less-than expressions", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: "5", literal: new Int32(5), line: 1 },
                { kind: Lexeme.Less, text: "<", line: 1 },
                { kind: Lexeme.Integer, text: "2", literal: new Int32(2), line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses less-than-or-equal-to expressions", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: "5", literal: new Int32(5), line: 1 },
                { kind: Lexeme.LessEqual, text: "<=", line: 1 },
                { kind: Lexeme.Integer, text: "2", literal: new Int32(2), line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses greater-than expressions", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: "5", literal: new Int32(5), line: 1 },
                { kind: Lexeme.Greater, text: ">", line: 1 },
                { kind: Lexeme.Integer, text: "2", literal: new Int32(2), line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses greater-than-or-equal-to expressions", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: "5", literal: new Int32(5), line: 1 },
                { kind: Lexeme.GreaterEqual, text: ">=", line: 1 },
                { kind: Lexeme.Integer, text: "2", literal: new Int32(2), line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses equality expressions", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: "5", literal: new Int32(5), line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: "2", literal: new Int32(2), line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses inequality expressions", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: "5", literal: new Int32(5), line: 1 },
                { kind: Lexeme.LessGreater, text: "<>", line: 1 },
                { kind: Lexeme.Integer, text: "2", literal: new Int32(2), line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });
    });
});