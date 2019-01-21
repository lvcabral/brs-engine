const brs = require("brs");
const { Lexeme } = brs.lexer;
const { BrsBoolean } = brs.types;

const { EOF } = require("../ParserTests");

describe("parser", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    describe("boolean expressions", () => {
        it("parses boolean ANDs", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.True, text: "true", literal: BrsBoolean.True, line: 1 },
                { kind: Lexeme.And, text: "and", line: 1 },
                { kind: Lexeme.False, text: "false", literal: BrsBoolean.False, line: 1 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses boolean ORs", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.True, text: "true", literal: BrsBoolean.True, line: 1 },
                { kind: Lexeme.Or, text: "or", line: 1 },
                { kind: Lexeme.False, text: "false", literal: BrsBoolean.False, line: 1 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });
    });
});
