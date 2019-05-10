const brs = require("brs");
const { Lexeme } = brs.lexer;
const { BrsString, Int32 } = brs.types;

const { token, identifier, EOF } = require("../ParserTests");

describe("parser library statements", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    it('supports library statements at top of file', () => {
        const { tokens } = brs.lexer.Lexer.scan(`
            Library "v30/bslCore.brs"
            sub main()
            end sub
        `);
        const { statements, errors } = parser.parse(tokens);
        expect(errors.length).toEqual(0);
        expect({ errors, statements }).toMatchSnapshot();
    });

    it('supports multiple library statements separated by colon', () => {
        const { tokens } = brs.lexer.Lexer.scan(`
            Library "v30/bslCore.brs" : Library "v30/bslCore.brs"
            sub main()
            end sub
        `);
        const { statements, errors } = parser.parse(tokens);
        expect(errors.length).toEqual(0);
        expect({ errors, statements }).toMatchSnapshot();
    });

    it('adds error for library statements NOT at top of file', () => {
        const { tokens } = brs.lexer.Lexer.scan(`
            sub main()
            end sub
            Library "v30/bslCore.brs"
        `);
        const { statements, errors } = parser.parse(tokens);
        expect(errors.length).toBeGreaterThan(0);
        expect({ errors, statements }).toMatchSnapshot();
    });

    it('adds error for library statements inside of function body', () => {
        const { tokens } = brs.lexer.Lexer.scan(`
            sub main()
                Library "v30/bslCore.brs"
            end sub
        `);
        const { statements, errors } = parser.parse(tokens);
        expect(errors.length).toEqual(1);
        expect({ errors, statements }).toMatchSnapshot();
    });

    it('still parses entire file after invalid library statement', () => {
        const { tokens } = brs.lexer.Lexer.scan(`
            library cat dog mouse
            sub main()
            end sub
        `);
        const { statements, errors } = parser.parse(tokens);
        expect(errors.length).toBeGreaterThan(0);
        expect({ errors, statements }).toMatchSnapshot();
    });

    it('does not prevent usage of `library` as varible name', () => {
        const { tokens } = brs.lexer.Lexer.scan(`
            sub main()
                library = "Gotham City Library"
            end sub
        `);
        const { statements, errors } = parser.parse(tokens);
        //make sure the assignment is present in the function body
        let assignment = statements[0].func.body.statements[0];
        expect(assignment).toBeInstanceOf(brs.parser.Stmt.Assignment)
        expect(assignment.name.text).toEqual('library');
        expect({ errors, statements }).toMatchSnapshot();
    });

    it('does not prevent usage of `library` as object property name', () => {
        const { tokens } = brs.lexer.Lexer.scan(`
            sub main()
                buildings = {
                    library: "Gotham City Library"
                }
            end sub
        `);
        const { statements, errors } = parser.parse(tokens);
        //make sure the assignment is present in the function body
        expect(statements[0].func.body.statements[0].value.elements[0].name.value).toEqual('library');
        expect({ errors, statements }).toMatchSnapshot();
    });

    it('parses rest of file with ONLY the library keyword present at root level', () => {
        const { tokens } = brs.lexer.Lexer.scan(`
            library
            sub main()
                library = "Your Library"
            end sub
        `);
        const { statements, errors } = parser.parse(tokens);
        expect(errors.length).toEqual(1);
        //function statement should still exist
        expect(statements[statements.length - 1]).toBeInstanceOf(brs.parser.Stmt.Function);
        expect({ errors, statements }).toMatchSnapshot();
    });
});
