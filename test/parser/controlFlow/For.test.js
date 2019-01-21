const BrsError = require("../../../lib/Error");
const brs = require("brs");
const { Lexeme, BrsTypes } = brs;
const { Int32 } = BrsTypes;

const { EOF } = require("../ParserTests");

describe("parser for loops", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    afterEach(() => BrsError.reset());

    it("accepts a 'step' clause", () => {
        let { statements, errors } = parser.parse([
            { kind: Lexeme.For, text: "for", line: 1 },
            { kind: Lexeme.Identifier, text: "i", line: 1 },
            { kind: Lexeme.Equal, text: "=", line: 1 },
            { kind: Lexeme.Integer, text: "0", literal: new Int32(0), line: 1 },
            { kind: Lexeme.To, text: "to", line: 1 },
            { kind: Lexeme.Integer, text: "5", literal: new Int32(5), line: 1 },
            { kind: Lexeme.Step, text: "step", line: 1 },
            { kind: Lexeme.Integer, text: "2", literal: new Int32(2), line: 1 },
            { kind: Lexeme.Newline, text: "\n", line: 1 },
            // body would go here, but it's not necessary for this test
            { kind: Lexeme.EndFor, text: "end for", line: 2 },
            { kind: Lexeme.Newline, text: "\n", line: 2 },
            EOF
        ]);

        expect(errors).toEqual([])
        expect(statements).toBeDefined();
        expect(statements[0]).toBeDefined();
        expect(statements[0].increment).toBeDefined();
        expect(statements[0].increment.value).toEqual(new Int32(2));

        expect(statements).toMatchSnapshot();
    });

    it("defaults a missing 'step' clause to '1'", () => {
        let { statements, errors } = parser.parse([
            { kind: Lexeme.For, text: "for", line: 1 },
            { kind: Lexeme.Identifier, text: "i", line: 1 },
            { kind: Lexeme.Equal, text: "=", line: 1 },
            { kind: Lexeme.Integer, text: "0", literal: new Int32(0), line: 1 },
            { kind: Lexeme.To, text: "to", line: 1 },
            { kind: Lexeme.Integer, text: "5", literal: new Int32(5), line: 1 },
            { kind: Lexeme.Newline, text: "\n", line: 1 },
            // body would go here, but it's not necessary for this test
            { kind: Lexeme.EndFor, text: "end for", line: 2 },
            { kind: Lexeme.Newline, text: "\n", line: 2 },
            EOF
        ]);

        expect(errors).toEqual([])
        expect(statements).toBeDefined();
        expect(statements[0]).toBeDefined();
        expect(statements[0].increment).toBeDefined();
        expect(statements[0].increment.value).toEqual(new Int32(1));

        expect(statements).toMatchSnapshot();
    });
});
