const brs = require("brs");
const { Lexeme } = brs.lexer;
const { BrsString, Int32 } = brs.types;

const { token, identifier, EOF } = require("../ParserTests");

describe("block statements", () => {
    it("includes surrounding whitespace for function body", () => {
        const { tokens } = brs.lexer.Lexer.scan(`
            sub Main()
                age = 1
            end sub
        `);
        const { statements, errors } = brs.parser.Parser.parse(tokens);
        expect(errors.length).toEqual(0);

        let blockLocation = statements[0].func.body.location;
        //the block location should begin immediately following `sub Main()`, and end immediately preceeding the first character of `end sub`
        expect(blockLocation).toEqual({
            file: "",
            start: { line: 2, column: 22 },
            end: { line: 4, column: 12 },
        });

        expect(statements).toMatchSnapshot();
    });

    it("includes surrounding whitespace for if-elseif-else statements", () => {
        const { tokens } = brs.lexer.Lexer.scan(`
            sub Main()
                if true then
                    print "true"
                else if true then
                    print "true"
                else
                    print "true"
                end if
            end sub
        `);
        const { statements, errors } = brs.parser.Parser.parse(tokens);
        expect(errors.length).toEqual(0);

        const ifStatement = statements[0].func.body.statements[0];

        const thenBlock = ifStatement.thenBranch;
        expect(thenBlock.location).toEqual({
            file: "",
            start: { line: 3, column: 28 },
            end: { line: 5, column: 16 },
        });

        const elseIfBlock = ifStatement.elseIfs[0].thenBranch;
        expect(elseIfBlock.location).toEqual({
            file: "",
            start: { line: 5, column: 33 },
            end: { line: 7, column: 16 },
        });

        const elseBlock = ifStatement.elseBranch;
        expect(elseBlock.location).toEqual({
            file: "",
            start: { line: 7, column: 20 },
            end: { line: 9, column: 16 },
        });

        expect(statements).toMatchSnapshot();
    });

    it("includes surrounding whitespace for a for-loop body", () => {
        const { tokens } = brs.lexer.Lexer.scan(`
            sub Main()
                For i = 0 To 10 Step 1
                    print i
                End For
            end sub
        `);
        const { statements, errors } = brs.parser.Parser.parse(tokens);
        expect(errors.length).toEqual(0);

        let loopBlock = statements[0].func.body.statements[0].body;
        //the block location should begin immediately following `step 1`, and end immediately preceeding the first character of `end for`
        expect(loopBlock.location).toEqual({
            file: "",
            start: { line: 3, column: 38 },
            end: { line: 5, column: 16 },
        });

        expect(statements).toMatchSnapshot();
    });
});
