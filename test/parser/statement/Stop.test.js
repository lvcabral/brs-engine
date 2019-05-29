const brs = require("brs");
const { Lexeme } = brs.lexer;
const { Int32 } = brs.types;

const { token, identifier, EOF } = require("../ParserTests");

describe("stop statement", () => {
    it("cannot be used as a local variable", () => {
        let { statements, errors } = brs.parser.Parser.parse([
            token(Lexeme.Stop, "stop"),
            token(Lexeme.Equal, "="),
            token(Lexeme.True, "true"),
            EOF,
        ]);

        //should be an error
        expect(errors).toHaveLength(1);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("is valid as a statement", () => {
        let { statements, errors } = brs.parser.Parser.parse([token(Lexeme.Stop, "stop"), EOF]);
        expect(errors[0]).toBeUndefined();
        expect(statements).toMatchSnapshot();
    });

    it("can be used as an object property", () => {
        let { tokens } = brs.lexer.Lexer.scan(`
            sub Main()
                theObject = {
                    stop: false
                }
                theObject.stop = true
            end sub
        `);
        let { statements, errors } = brs.parser.Parser.parse(tokens);
        expect(errors.length).toEqual(0);
        expect(statements).toMatchSnapshot();
    });
});
