const brs = require("../../../packages/node/bin/brs.node");
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
        let { statements, errors } = brs.parser.Parser.parse([identifier("SomeLabel"), token(Lexeme.Colon, ":"), EOF]);
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

    it("do not allow label inside try catch", () => {
        let { tokens } = brs.lexer.Lexer.scan(`
            sub main()
                goto inside
                try
                    inside:
                    throw "something"
                catch ex
                    print ex
                end try
            end sub
        `);
        let { statements, errors } = brs.parser.Parser.parse(tokens);
        expect(errors.length).toEqual(1);
        expect(errors[0].message).toEqual("Syntax Error. (compile error &h2) Labels are illegal inside a TRY clause.");
    });
});
