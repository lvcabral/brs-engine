const brs = require("brs");
const { Lexeme } = brs;
const BrsError = require("../../../lib/Error");

const { token, identifier, EOF } = require("../ParserTests");

describe("parser", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    afterEach(() => BrsError.reset());

    describe("variable declarations", () => {
        it("allows newlines after assignments", () => {
            let parsed = parser.parse([
                identifier("hasNewlines"),
                token(Lexeme.Equal),
                token(Lexeme.True),
                token(Lexeme.Newline),
                EOF
            ]);

            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
        });

        it("parses literal value assignments", () => {
            let parsed = parser.parse([
                identifier("foo"),
                token(Lexeme.Equal),
                token(Lexeme.Integer, 5),
                EOF
            ]);

            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses evaluated value assignments", () => {
            let parsed = parser.parse([
                identifier("bar"),
                token(Lexeme.Equal),
                token(Lexeme.Integer, 5),
                token(Lexeme.Caret),
                token(Lexeme.Integer, 3),
                EOF
            ]);

            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses variable aliasing", () => {
            let parsed = parser.parse([
                identifier("baz"),
                token(Lexeme.Equal),
                identifier("foo"),
                EOF
            ]);

            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });
    });
});
