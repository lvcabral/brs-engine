const Parser = require("../../../lib/parser");
const BrsError = require("../../../lib/Error");
const { Lexeme, BrsTypes } = require("brs");
const { BrsBoolean, Int32 } = BrsTypes;

const { token, identifier, EOF } = require("../ParserTests");

describe("parser if statements", () => {
    afterEach(() => BrsError.reset());

    describe("single-line if", () => {
        it("parses if only", () => {
            let parsed = Parser.parse([
                token(Lexeme.If),
                token(Lexeme.Integer, new Int32(1)),
                token(Lexeme.Less),
                token(Lexeme.Integer, new Int32(2)),
                token(Lexeme.Then),
                identifier("foo"),
                token(Lexeme.Equal),
                token(Lexeme.True, BrsBoolean.True),
                token(Lexeme.Newline),
                EOF
            ]);


            expect(BrsError.found()).toBe(false);
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses if-else", () => {
            let parsed = Parser.parse([
                token(Lexeme.If),
                token(Lexeme.Integer, new Int32(1)),
                token(Lexeme.Less),
                token(Lexeme.Integer, new Int32(2)),
                token(Lexeme.Then),
                identifier("foo"),
                token(Lexeme.Equal),
                token(Lexeme.True, BrsBoolean.True),
                token(Lexeme.Else),
                identifier("foo"),
                token(Lexeme.Equal),
                token(Lexeme.True, BrsBoolean.False),
                token(Lexeme.Newline),
                EOF
            ]);

            expect(BrsError.found()).toBe(false);
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses if-elseif-else", () => {
            let parsed = Parser.parse([
                token(Lexeme.If),
                token(Lexeme.Integer, new Int32(1)),
                token(Lexeme.Less),
                token(Lexeme.Integer, new Int32(2)),
                token(Lexeme.Then),
                identifier("foo"),
                token(Lexeme.Equal),
                token(Lexeme.True, BrsBoolean.True),
                token(Lexeme.ElseIf),
                token(Lexeme.Integer, new Int32(1)),
                token(Lexeme.Equal),
                token(Lexeme.Integer, new Int32(2)),
                token(Lexeme.Then),
                identifier("same"),
                token(Lexeme.Equal),
                token(Lexeme.True, BrsBoolean.True),
                token(Lexeme.Else),
                identifier("foo"),
                token(Lexeme.Equal),
                token(Lexeme.True, BrsBoolean.False),
                token(Lexeme.Newline),
                EOF
            ]);

            expect(BrsError.found()).toBe(false);
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });
    });

    describe("block if", () => {
        it("parses if only", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.If, text: "if" },
                { kind: Lexeme.Integer, literal: new Int32(1) },
                { kind: Lexeme.Less, text: "<" },
                { kind: Lexeme.Integer, literal: new Int32(2) },
                { kind: Lexeme.Then, text: "then" },
                { kind: Lexeme.Newline, text: "\n" },
                { kind: Lexeme.Identifier, text: "foo" },
                { kind: Lexeme.Equal, text: "=" },
                { kind: Lexeme.True, literal: BrsBoolean.True },
                { kind: Lexeme.Newline, text: "\n" },
                { kind: Lexeme.Identifier, text: "bar" },
                { kind: Lexeme.Equal, text: "=" },
                { kind: Lexeme.True, literal: BrsBoolean.True },
                { kind: Lexeme.Newline, text: "\n" },
                { kind: Lexeme.EndIf, text: "end if" },
                EOF
            ]);

            expect(BrsError.found()).toBe(false);
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses if-else", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.If, text: "if" },
                { kind: Lexeme.Integer, literal: new Int32(1) },
                { kind: Lexeme.Less, text: "<" },
                { kind: Lexeme.Integer, literal: new Int32(2) },
                { kind: Lexeme.Then, text: "then" },
                { kind: Lexeme.Newline, text: "\n" },
                { kind: Lexeme.Identifier, text: "foo" },
                { kind: Lexeme.Equal, text: "=" },
                { kind: Lexeme.True, literal: BrsBoolean.True },
                { kind: Lexeme.Newline, text: "\n" },
                { kind: Lexeme.Else, text: "else" },
                { kind: Lexeme.Newline, text: "\n" },
                { kind: Lexeme.Identifier, text: "foo" },
                { kind: Lexeme.Equal, text: "=" },
                { kind: Lexeme.False, literal: BrsBoolean.False },
                { kind: Lexeme.Newline, text: "\n" },
                { kind: Lexeme.Identifier, text: "bar" },
                { kind: Lexeme.Equal, text: "=" },
                { kind: Lexeme.True, literal: BrsBoolean.False },
                { kind: Lexeme.Newline, text: "\n" },
                { kind: Lexeme.EndIf, text: "end if" },
                EOF
            ]);

            expect(BrsError.found()).toBe(false);
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses if-elseif-else", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.If, text: "if" },
                { kind: Lexeme.Integer, literal: new Int32(1) },
                { kind: Lexeme.Less, text: "<" },
                { kind: Lexeme.Integer, literal: new Int32(2) },
                { kind: Lexeme.Then, text: "then" },
                { kind: Lexeme.Newline, text: "\n" },
                { kind: Lexeme.Identifier, text: "foo" },
                { kind: Lexeme.Equal, text: "=" },
                { kind: Lexeme.True, literal: BrsBoolean.True },
                { kind: Lexeme.Newline, text: "\n" },
                { kind: Lexeme.ElseIf, text: "else if" },
                { kind: Lexeme.Integer, literal: new Int32(1) },
                { kind: Lexeme.Greater, text: ">" },
                { kind: Lexeme.Integer, literal: new Int32(2) },
                { kind: Lexeme.Then, text: "then" },
                { kind: Lexeme.Newline, text: "\n" },
                { kind: Lexeme.Identifier, text: "foo" },
                { kind: Lexeme.Equal, text: "=" },
                { kind: Lexeme.Integer, literal: new Int32(3) },
                { kind: Lexeme.Newline, text: "\n" },
                { kind: Lexeme.Identifier, text: "bar" },
                { kind: Lexeme.Equal, text: "=" },
                { kind: Lexeme.True, literal: BrsBoolean.False },
                { kind: Lexeme.Newline, text: "\n" },
                { kind: Lexeme.Else, text: "else" },
                { kind: Lexeme.Newline, text: "\n" },
                { kind: Lexeme.Identifier, text: "foo" },
                { kind: Lexeme.Equal, text: "=" },
                { kind: Lexeme.False, literal: BrsBoolean.False },
                { kind: Lexeme.Newline, text: "\n" },
                { kind: Lexeme.EndIf, text: "end if" },
                { kind: Lexeme.Newline, text: "\n" },
                EOF
            ]);

            expect(BrsError.found()).toBe(false);
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });
    });
});