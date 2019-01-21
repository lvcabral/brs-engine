const brs = require("brs");
const { Lexeme } = brs;
const BrsError = require("../../../lib/Error");

const { token, identifier, EOF } = require("../ParserTests");

describe("parser", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    describe("variable declarations", () => {
        it("allows newlines after assignments", () => {
            let { statements, errors } = parser.parse([
                identifier("hasNewlines"),
                token(Lexeme.Equal),
                token(Lexeme.True),
                token(Lexeme.Newline),
                EOF
            ]);

            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
        });

        it("parses literal value assignments", () => {
            let { statements, errors } = parser.parse([
                identifier("foo"),
                token(Lexeme.Equal),
                token(Lexeme.Integer, 5),
                EOF
            ]);

            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses evaluated value assignments", () => {
            let { statements, errors } = parser.parse([
                identifier("bar"),
                token(Lexeme.Equal),
                token(Lexeme.Integer, 5),
                token(Lexeme.Caret),
                token(Lexeme.Integer, 3),
                EOF
            ]);

            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses variable aliasing", () => {
            let { statements, errors } = parser.parse([
                identifier("baz"),
                token(Lexeme.Equal),
                identifier("foo"),
                EOF
            ]);

            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });
    });
});
