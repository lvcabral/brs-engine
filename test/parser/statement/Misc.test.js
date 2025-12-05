const brs = require("../../../packages/node/bin/brs.node");

describe("parser", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.Parser();
    });

    it("certain reserved words are allowed as local var identifiers", () => {
        let { tokens } = brs.Lexer.scan(`
            sub Main()
                endfor = true
                double = true
                exitfor = true
                float = true
                foreach = true
                integer = true
                longinteger = true
                string = true
            end sub
        `);
        let { statements, errors } = parser.parse(tokens);
        expect(errors.length).toEqual(0);
        expect(statements).toMatchSnapshot();
    });

    it("most reserved words are not allowed as local var identifiers", () => {
        let statementList = [];
        for (var i = 0; i < brs.Parser.disallowedIdentifiers; i++) {
            var identifier = brs.Parser.disallowedIdentifiers[i];
            //use the lexer to generate tokens because there are many different Lexeme types represented in this list
            let { tokens } = brs.Lexer.scan(`
                sub main()
                    ${identifier} = true
                end sub
            `);
            let { statements, errors } = parser.parse(tokens);
            expect(errors.length).toBeGreaterThan(0);
            statementList.push(statements);
        }
        //a few additional keywords that we don't have lexemes for
        let { tokens } = brs.Lexer.scan(`
            sub main()
                boolean = true
                integer = true
                longinteger = true
                float = true
                double = true
                string = true
                object = true
                interface = true
            end sub
        `);
        let { statements, errors } = parser.parse(tokens);
        expect(errors.length).toEqual(0);
        expect(statementList).toMatchSnapshot();
    });

    it("allows whitelisted reserved words as object properties", () => {
        //use the lexer to generate token list because...this list is huge.
        let { tokens } = brs.Lexer.scan(`
            sub Main()
                person = {}
                person.and = true
                person.box = true
                person.catch = true
                person.createobject = true
                person.dim = true
                person.double = true
                person.each = true
                person.else = true
                person.elseif = true
                person.end = true
                person.endfor = true
                person.endfunction = true
                person.endif = true
                person.endsub = true
                person.endwhile = true
                person.eval = true
                person.exit = true
                person.exitfor = true
                person.exitwhile = true
                person.false = true
                person.float = true
                person.for = true
                person.foreach = true
                person.function = true
                person.getglobalaa = true
                person.getlastruncompileerror = true
                person.getlastrunruntimeerror = true
                person.goto = true
                person.if = true
                person.integer = true
                person.invalid = true
                person.let = true
                person.line_num = true
                person.longinteger = true
                person.next = true
                person.not = true
                person.objfun = true
                person.or = true
                person.pos = true
                person.print = true
                person.rem = true
                person.return = true
                person.run = true
                person.step = true
                person.stop = true
                person.string = true
                person.sub = true
                person.tab = true
                person.then = true
                person.to = true
                person.true = true
                person.try = true
                person.type = true
                person.while = true
            end sub
        `);
        let { statements, errors } = parser.parse(tokens);
        expect(errors.length).toBe(0);
        expect(statements).toMatchSnapshot();
    });

    it("does not add extra quotes to AA keys", () => {
        let { tokens } = brs.Lexer.scan(`
            function main(arg as string)
                twoDimensional = {
                    "has-second-layer": true,
                    level: 1
                    secondLayer: {
                        level: 2
                    }
                }
            end function
        `);

        let { statements, errors } = brs.Parser.parse(tokens);
        expect(statements[0].func.body.statements[0].value.elements[0].name.value).toEqual("has-second-layer");
    });
});
