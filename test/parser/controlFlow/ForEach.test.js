const BrsError = require("../../../lib/Error");
const brs = require("brs");
const { Lexeme } = brs;
const { Expr, Stmt } = brs.parser;

const { EOF } = require("../ParserTests");

describe("parser foreach loops", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    afterEach(() => BrsError.reset());

    it("requires a name and target", () => {
        let parsed = parser.parse([
            { kind: Lexeme.ForEach, text: "for each", line: 2 },
            { kind: Lexeme.Identifier, text: "word", line: 2 },
            { kind: Lexeme.Identifier, text: "in", line: 2 },
            { kind: Lexeme.Identifier, text: "lipsum", line: 2 },
            { kind: Lexeme.Newline, text: "\n", line: 2 },

            // body would go here, but it's not necessary for this test
            { kind: Lexeme.EndFor, text: "end for", line: 3 },
            { kind: Lexeme.Newline, text: "\n", line: 3 },
            EOF
        ]);

        expect(BrsError.found()).toBe(false);
        expect(parsed).toBeDefined();

        let forEach = parsed[0];
        expect(forEach).toBeInstanceOf(Stmt.ForEach);

        expect(forEach.item).toEqual(
            { kind: Lexeme.Identifier, text: "word", line: 2 }
        );
        expect(forEach.target).toBeInstanceOf(Expr.Variable);
        expect(forEach.target.name).toEqual(
            { kind: Lexeme.Identifier, text: "lipsum", line: 2 }
        );

        expect(parsed).toMatchSnapshot();
    });
});
