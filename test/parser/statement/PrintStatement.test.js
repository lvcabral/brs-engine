const brs = require("brs");
const { Lexeme } = brs;
const BrsError = require("../../../lib/Error");

const { token, EOF } = require("../ParserTests");

describe("parser", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    afterEach(() => BrsError.reset());

    describe("print statements", () => {
        it("parses singular print statements", () => {
            let parsed = parser.parse([
                token(Lexeme.Print),
                token(Lexeme.String, "Hello, world"),
                EOF
            ]);

            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses print lists with no separator", () => {
            let parsed = parser.parse([
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
            let parsed = parser.parse([
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
