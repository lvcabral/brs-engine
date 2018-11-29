const Parser = require("../../../lib/parser");
const BrsError = require("../../../lib/Error");
const { Lexeme, BrsTypes } = require("brs");
const { Float } = BrsTypes;

const { EOF } = require("../ParserTests");

describe("parser", () => {
    afterEach(() => BrsError.reset());

    describe("multiplicative expressions", () => {
        it("parses left-associative multiplication chains", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Float, text: "3.0", literal: new Float(3.0), line: 1 },
                { kind: Lexeme.Star, text: "*", line: 1 },
                { kind: Lexeme.Float, text: "5.0", literal: new Float(5.0), line: 1 },
                { kind: Lexeme.Star, text: "*", line: 1 },
                { kind: Lexeme.Float, text: "7.0", literal: new Float(7.0), line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses left-associative division chains", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Float, text: "7.0", literal: new Float(7.0), line: 1 },
                { kind: Lexeme.Slash, text: "/", line: 1 },
                { kind: Lexeme.Float, text: "5.0", literal: new Float(5.0), line: 1 },
                { kind: Lexeme.Slash, text: "/", line: 1 },
                { kind: Lexeme.Float, text: "3.0", literal: new Float(3.0), line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses left-associative modulo chains", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Float, text: "7.0", literal: new Float(7.0), line: 1 },
                { kind: Lexeme.Mod, text: "MOD", line: 1 },
                { kind: Lexeme.Float, text: "5.0", literal: new Float(5.0), line: 1 },
                { kind: Lexeme.Mod, text: "MOD", line: 1 },
                { kind: Lexeme.Float, text: "3.0", literal: new Float(3.0), line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses left-associative integer-division chains", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Float, text: "32.5", literal: new Float(32.5), line: 1 },
                { kind: Lexeme.Backslash, text: "\\", line: 1 },
                { kind: Lexeme.Float, text: "5.0", literal: new Float(5.0), line: 1 },
                { kind: Lexeme.Backslash, text: "\\", line: 1 },
                { kind: Lexeme.Float, text: "3.0", literal: new Float(3.0), line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });
    });
});