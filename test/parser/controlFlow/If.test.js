const brs = require("brs");
const { Lexeme } = brs.lexer;
const { BrsBoolean, Int32 } = brs.types;

const { token, identifier, EOF } = require("../ParserTests");

describe("parser if statements", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    describe("single-line if", () => {
        it("parses if only", () => {
            let { statements, errors } = parser.parse([
                token(Lexeme.If, "if"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Less, "<"),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.Then, "then"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.True),
                token(Lexeme.Newline, "\n"),
                EOF
            ]);


            expect(errors).toEqual([])
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses if-else", () => {
            let { statements, errors } = parser.parse([
                token(Lexeme.If, "if"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Less, "<"),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.Then, "then"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.True),
                token(Lexeme.Else, "else"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.False, "true", BrsBoolean.False),
                token(Lexeme.Newline, "\n"),
                EOF
            ]);

            expect(errors).toEqual([])
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses if-elseif-else", () => {
            let { statements, errors } = parser.parse([
                token(Lexeme.If, "if"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Less, "<"),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.Then, "then"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.True),
                token(Lexeme.ElseIf, "else if"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Equal, "="),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.Then, "then"),
                identifier("same"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.True),
                token(Lexeme.Else, "else"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.False),
                token(Lexeme.Newline, "\n"),
                EOF
            ]);

            expect(errors).toEqual([])
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("allows 'then' to be skipped", () => {
            let { statements, errors } = parser.parse([
                token(Lexeme.If, "if"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Less, "<"),
                token(Lexeme.Integer, "2", new Int32(2)),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.True),
                token(Lexeme.ElseIf, "else if"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Equal, "="),
                token(Lexeme.Integer, "2", new Int32(2)),
                identifier("same"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.True),
                token(Lexeme.Else, "else"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.False, "false", BrsBoolean.False),
                token(Lexeme.Newline, "\n"),
                EOF
            ]);

            expect(errors).toEqual([])
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });
    });

    describe("block if", () => {
        it("parses if only", () => {
            let { statements, errors } = parser.parse([
                token(Lexeme.If, "if"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Less, "<"),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.Then, "then"),
                token(Lexeme.Newline, "\n"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.True),
                token(Lexeme.Newline, "\n"),
                identifier("bar"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.True),
                token(Lexeme.Newline, "\n"),
                token(Lexeme.EndIf, "end if"),
                EOF
            ]);

            expect(errors).toEqual([])
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses if-else", () => {
            let { statements, errors } = parser.parse([
                token(Lexeme.If, "if"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Less, "<"),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.Then, "then"),
                token(Lexeme.Newline, "\n"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.True),
                token(Lexeme.Newline, "\n"),
                token(Lexeme.Else, "else"),
                token(Lexeme.Newline, "\n"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.False, "false", BrsBoolean.False),
                token(Lexeme.Newline, "\n"),
                identifier("bar"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "false", BrsBoolean.False),
                token(Lexeme.Newline, "\n"),
                token(Lexeme.EndIf, "end if"),
                EOF
            ]);

            expect(errors).toEqual([])
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses if-elseif-else", () => {
            let { statements, errors } = parser.parse([
                token(Lexeme.If, "if"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Less, "<"),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.Then, "then"),
                token(Lexeme.Newline, "\n"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.True),
                token(Lexeme.Newline, "\n"),
                token(Lexeme.ElseIf, "else if"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Greater, ">"),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.Then, "then"),
                token(Lexeme.Newline, "\n"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.Integer, "3", new Int32(3)),
                token(Lexeme.Newline, "\n"),
                identifier("bar"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.True),
                token(Lexeme.Newline, "\n"),
                token(Lexeme.Else, "else"),
                token(Lexeme.Newline, "\n"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.False, "false", BrsBoolean.False),
                token(Lexeme.Newline, "\n"),
                token(Lexeme.EndIf, "end if"),
                token(Lexeme.Newline, "\n"),
                EOF
            ]);

            expect(errors).toEqual([])
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("allows 'then' to be skipped", () => {
            let { statements, errors } = parser.parse([
                token(Lexeme.If, "if"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Less, "<"),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.Newline, "\n"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.True),
                token(Lexeme.Newline, "\n"),
                token(Lexeme.ElseIf, "else if"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Greater, ">"),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.Newline, "\n"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.Integer, "3", new Int32(3)),
                token(Lexeme.Newline, "\n"),
                identifier("bar"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.True),
                token(Lexeme.Newline, "\n"),
                token(Lexeme.Else, "else"),
                token(Lexeme.Newline, "\n"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.False, "false", BrsBoolean.False),
                token(Lexeme.Newline, "\n"),
                token(Lexeme.EndIf, "end if"),
                token(Lexeme.Newline, "\n"),
                EOF
            ]);

            expect(errors).toEqual([])
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });
    });

    // TODO: Improve `if` statement structure to allow a linter to require a `uthenu` keyword for
    // all `if` statements, then test location tracking
    test.todo("location tracking");
});
