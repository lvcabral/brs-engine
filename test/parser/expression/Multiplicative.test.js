const BrsError = require("../../../lib/Error");
const brs = require("brs");
const { Lexeme, BrsTypes } = brs;
const { Float } = BrsTypes;

const { EOF } = require("../ParserTests");

describe("parser", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    afterEach(() => BrsError.reset());

    describe("multiplicative expressions", () => {
        it("parses left-associative multiplication chains", () => {
            let parsed = parser.parse([
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
            let parsed = parser.parse([
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
            let parsed = parser.parse([
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
            let parsed = parser.parse([
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
