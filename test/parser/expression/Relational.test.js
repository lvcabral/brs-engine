const brs = require("brs");
const { Lexeme } = brs.lexer;
const { Int32 } = brs.types;

const { token, identifier, EOF } = require("../ParserTests");

describe("parser", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    describe("relational expressions", () => {
        it("parses less-than expressions", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                token(Lexeme.Integer, "5", new Int32(5)),
                token(Lexeme.Less, "<"),
                token(Lexeme.Integer, "2", new Int32(2)),
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses less-than-or-equal-to expressions", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                token(Lexeme.Integer, "5", new Int32(5)),
                token(Lexeme.LessEqual, "<="),
                token(Lexeme.Integer, "2", new Int32(2)),
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses greater-than expressions", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                token(Lexeme.Integer, "5", new Int32(5)),
                token(Lexeme.Greater, ">"),
                token(Lexeme.Integer, "2", new Int32(2)),
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses greater-than-or-equal-to expressions", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                token(Lexeme.Integer, "5", new Int32(5)),
                token(Lexeme.GreaterEqual, ">="),
                token(Lexeme.Integer, "2", new Int32(2)),
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses equality expressions", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                token(Lexeme.Integer, "5", new Int32(5)),
                token(Lexeme.Equal, "="),
                token(Lexeme.Integer, "2", new Int32(2)),
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses inequality expressions", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                token(Lexeme.Integer, "5", new Int32(5)),
                token(Lexeme.LessGreater, "<>"),
                token(Lexeme.Integer, "2", new Int32(2)),
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });
    });
});
