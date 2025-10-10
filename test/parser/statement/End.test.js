const brs = require("../../../packages/node/bin/brs.node");
const { Lexeme } = brs.lexer;

const { token, identifier, EOF } = require("../ParserTests");

describe("`end` statement", () => {
    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    it("does not produce errors", () => {
        let { tokens } = brs.lexer.Lexer.scan(`
                sub Main()
                    end
                end sub
            `);
        let { statements, errors } = parser.parse(tokens);
        expect(errors.length).toEqual(0);
        expect(statements).toMatchSnapshot();
    });

    it("is valid as a statement", () => {
        let { statements, errors } = brs.parser.Parser.parse([token(Lexeme.End, "end"), EOF]);
        expect(errors[0]).toBeUndefined();
        expect(statements).toMatchSnapshot();
    });

    it("can be used as a property name on objects", () => {
        let { tokens } = brs.lexer.Lexer.scan(`
                sub Main()
                    person = {
                        end: true
                    }
                end sub
            `);
        let { statements, errors } = parser.parse(tokens);
        expect(errors.length).toEqual(0);
        expect(statements).toMatchSnapshot();
    });

    it("is not allowed as a standalone variable", () => {
        //this test depends on token locations, so use the lexer to generate those locations.
        let { tokens } = brs.lexer.Lexer.scan(`
                sub Main()
                    end = true
                end sub
            `);
        let { statements, errors } = parser.parse(tokens);
        expect(errors.length).toEqual(1);
        //specifically check for the error location, because the identifier location was wrong in the past
        expect(errors[0].location).toEqual({
            file: "",
            start: { line: 3, column: 24 },
            end: { line: 3, column: 25 },
        });
        expect(statements).toMatchSnapshot();
    });
});
