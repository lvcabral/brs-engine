const { Lexeme, Parser } = require("brs");
const BrsError = require("../../../lib/Error");

const { token, EOF } = require("../ParserTests");

describe("parser", () => {
    afterEach(() => BrsError.reset());

    describe("print statements", () => {
        it("parses singular print statements", () => {
            let parsed = Parser.parse([
                token(Lexeme.Print),
                token(Lexeme.String, "Hello, world"),
                EOF
            ]);

            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses print lists with no separator", () => {
            let parsed = Parser.parse([
                token(Lexeme.Print),
                token(Lexeme.String, "Foo"),
                token(Lexeme.String, "bar"),
                token(Lexeme.String, "baz"),
                EOF
            ]);

            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses print lists with separators", () => {
            let parsed = Parser.parse([
                token(Lexeme.Print),
                token(Lexeme.String, "Foo"),
                token(Lexeme.Semicolon),
                token(Lexeme.String, "bar"),
                token(Lexeme.Comma),
                token(Lexeme.String, "baz"),
                EOF
            ]);

            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });
    });
});
