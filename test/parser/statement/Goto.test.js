const brs = require("brs");
const { token, identifier, EOF } = require("../ParserTests");
const { Lexeme } = brs.lexer;

describe("parser goto statements", () => {
    it("parses standalone statement properly", () => {
        let { statements, errors } = brs.parser.Parser.parse([
            token(Lexeme.Goto, "goto"),
            identifier("SomeLabel"),
            EOF,
        ]);
        expect(errors.length).toEqual(0);
        expect({ errors, statements }).toMatchSnapshot();
    });

    it("detects labels", () => {
        let { statements, errors } = brs.parser.Parser.parse([
            identifier("SomeLabel"),
            token(Lexeme.Colon, ":"),
            EOF,
        ]);
        expect(errors.length).toEqual(0);
        expect(statements).toMatchSnapshot();
    });

    it("allows multiple goto statements on one line", () => {
        let { tokens } = brs.lexer.Lexer.scan(`
            sub Main()
                'multiple goto statements on one line
                goto myLabel : goto myLabel 
                myLabel:
            end sub
        `);
        let { statements, errors } = brs.parser.Parser.parse(tokens);
        expect(errors.length).toEqual(0);
        expect(statements).toMatchSnapshot();
    });
});
