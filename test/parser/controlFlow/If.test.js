const brs = require("brs");
const { Lexeme } = brs.lexer;
const { BrsBoolean, Int32 } = brs.types;

const { token, identifier, EOF } = require("../ParserTests");

describe("parser if statements", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    it("single-line if next to else or endif", () => {
        let { tokens } = brs.lexer.Lexer.scan(`
            if type(component.TextAttrs.font) = "roString"
                font = m.fonts.Lookup(component.TextAttrs.font)
                if font = invalid then font = m.fonts.medium
            else if type(component.TextAttrs.font) = "roFont"
                font = component.TextAttrs.font
            else
                font = m.fonts.reg.GetDefaultFont()
            end if
        `);
        let { statements, errors } = parser.parse(tokens);

        expect(errors).toEqual([]);
        expect(statements.length).toBeGreaterThan(0);
        expect(statements).toMatchSnapshot();
    });

    it("single-line if inside multi-line if", () => {
        let { tokens } = brs.lexer.Lexer.scan(`
            if true
                if true then t = 1
            else
                ' empty line or line with just a comment causes crash
            end if
        `);
        let { statements, errors } = parser.parse(tokens);

        expect(errors).toEqual([]);
        expect(statements.length).toBeGreaterThan(0);
        expect(statements).toMatchSnapshot();
    });

    it("dotted set in else block", () => {
        let { tokens } = brs.lexer.Lexer.scan(`
            if true then m.top.visible = true else m.top.visible = false
        `);
        let { statements, errors } = parser.parse(tokens);

        if (errors.length > 0) {
            console.log(errors);
        }

        expect(errors).toEqual([]);
        expect(statements.length).toBeGreaterThan(0);
        expect(statements).toMatchSnapshot();
    });

    describe("single-line if", () => {
        it("parses if only", () => {
            let { statements, errors } = parser.parse([
                token(Lexeme.If, "if"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Less, "<"),
                token(Lexeme.Integer, "2", new Int32(2)),
                identifier("then"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.True),
                token(Lexeme.Newline, "\n"),
                EOF,
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses if-else", () => {
            let { statements, errors } = parser.parse([
                token(Lexeme.If, "if"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Less, "<"),
                token(Lexeme.Integer, "2", new Int32(2)),
                identifier("Then"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.True),
                token(Lexeme.Else, "else"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.False, "true", BrsBoolean.False),
                token(Lexeme.Newline, "\n"),
                EOF,
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses if-elseif-else", () => {
            let { statements, errors } = parser.parse([
                token(Lexeme.If, "if"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Less, "<"),
                token(Lexeme.Integer, "2", new Int32(2)),
                identifier("then"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.True),
                token(Lexeme.ElseIf, "else if"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Equal, "="),
                token(Lexeme.Integer, "2", new Int32(2)),
                identifier("then"),
                identifier("same"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.True),
                token(Lexeme.Else, "else"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.False),
                token(Lexeme.Newline, "\n"),
                EOF,
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("allows 'then' to be skipped", () => {
            let { statements, errors } = parser.parse([
                token(Lexeme.If, "if"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Less, "<"),
                token(Lexeme.Integer, "2", new Int32(2)),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.True),
                token(Lexeme.ElseIf, "else if"),
                token(Lexeme.Integer, "1", new Int32(1)),
                token(Lexeme.Equal, "="),
                token(Lexeme.Integer, "2", new Int32(2)),
                identifier("same"),
                token(Lexeme.Equal, "="),
                token(Lexeme.True, "true", BrsBoolean.True),
                token(Lexeme.Else, "else"),
                identifier("foo"),
                token(Lexeme.Equal, "="),
                token(Lexeme.False, "false", BrsBoolean.False),
                token(Lexeme.Newline, "\n"),
                EOF,
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("allows multiple statements in 'then' block (#481)", () => {
            let { tokens } = brs.lexer.Lexer.scan(`
                if false then nop(): print "#481 still repro's": return
                print "#481 fixed"
            `);

            let { statements, errors } = parser.parse(tokens);
            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            let ifStatement = statements[0];
            expect(ifStatement.thenBranch.statements.length).toBe(3);
        });
    });

    describe("block if", () => {
        it("parses if only", () => {
            //because the parser depends on line numbers for certain if statements, this needs to be location-aware
            let { tokens } = brs.lexer.Lexer.scan(`
                if 1 < 2 THEN
                    foo = true
                    bar = true
                end if
            `);
            let { statements, errors } = parser.parse(tokens);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses if-else", () => {
            //this test requires token locations, so use the lexer
            let { tokens } = brs.lexer.Lexer.scan(`
                if 1 < 2 then
                    foo = true
                else
                    foo = false
                    bar = false
                end if
            `);
            let { statements, errors } = parser.parse(tokens);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses if-elseif-else", () => {
            //this test requires token locations, so use the lexer
            let { tokens } = brs.lexer.Lexer.scan(`
                if 1 < 2 then
                    foo = true
                else if 1 > 2 then
                    foo = 3
                    bar = true
                else
                    foo = false
                end if
            `);
            let { statements, errors } = parser.parse(tokens);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("allows 'then' to be skipped", () => {
            //this test requires token locations, so use the lexer
            let { tokens } = brs.lexer.Lexer.scan(`
                if 1 < 2
                    foo = true
                else if 1 > 2
                    foo = 3
                    bar = true
                else
                    foo = false
                end if
            `);
            let { statements, errors } = parser.parse(tokens);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("sets endif token properly", () => {
            //this test requires token locations, so use the lexer
            let { tokens } = brs.lexer.Lexer.scan(`
                sub a()
                    if true then
                        print false
                    else if true then
                        print "true"
                    else
                        print "else"
                    end if 'comment
                end sub
            `);
            let { statements, errors } = parser.parse(tokens);
            expect(errors.length).toEqual(0);
            expect(statements.length).toBeGreaterThan(0);

            //the endif token should be set
            expect(statements[0].func.body.statements[0].tokens.endIf).toBeTruthy();
            expect(statements).toMatchSnapshot();
        });
    });

    it("supports trailing colons after conditional statements", () => {
        let { tokens } = brs.lexer.Lexer.scan(`
            sub main()
                if 1 > 0:
                    print "positive!"
                else if 1 < 0:
                    print "negative!"
                else:
                    print "tHaT NuMbEr iS ZeRo"
                end if
            end sub
        `);
        let { statements, errors } = brs.parser.Parser.parse(tokens);
        expect(errors.length).toEqual(0);
        expect(statements).toMatchSnapshot();
    });

    it("supports trailing colons for one-line if statements", () => {
        let { tokens } = brs.lexer.Lexer.scan(`
            if 1 < 2: return true: end if
        `);
        let { statements, errors } = brs.parser.Parser.parse(tokens);
        expect(errors).toHaveLength(0);
        expect(statements).toMatchSnapshot();
    });

    it("catches one-line if statement missing first colon", () => {
        //missing colon after 2
        let { tokens } = brs.lexer.Lexer.scan(`
            if 1 < 2 return true : end if
        `);
        let { statements, errors } = brs.parser.Parser.parse(tokens);
        expect(errors.length).toBeGreaterThan(0);
        expect(statements).toMatchSnapshot();
    });

    it("catches one-line if statement missing second colon", () => {
        //missing colon after `2`
        let { tokens } = brs.lexer.Lexer.scan(`
            if 1 < 2 : return true end if
        `);
        let { statements, errors } = brs.parser.Parser.parse(tokens);
        expect(errors.length).toBeGreaterThan(0);
        expect(statements).toMatchSnapshot();
    });

    it("catches one-line if statement with else missing colons", () => {
        //missing colon after `2`
        let { tokens } = brs.lexer.Lexer.scan(`
            if 1 < 2 : return true: else return false end if
        `);
        let { statements, errors } = brs.parser.Parser.parse(tokens);
        expect(errors.length).toBeGreaterThan(0);
        expect(statements).toMatchSnapshot();
    });

    it("catches one-line if statement with colon and missing end if", () => {
        //missing colon after `2`
        let { tokens } = brs.lexer.Lexer.scan(`
            if 1 < 2: return true
        `);
        let { statements, errors } = brs.parser.Parser.parse(tokens);
        expect(errors.length).toBeGreaterThan(0);
        expect(statements).toMatchSnapshot();
    });

    it("catches one-line if statement with colon and missing end if", () => {
        //missing 'end if'
        let { tokens } = brs.lexer.Lexer.scan(`
            function missingendif()
                if true : return true
            end function
        `);
        let { statements, errors } = brs.parser.Parser.parse(tokens);
        expect(errors.length).toEqual(1);
        expect(statements).toMatchSnapshot();
    });

    it("supports if statement with condition and action on one line, but end if on separate line", () => {
        let { tokens } = brs.lexer.Lexer.scan(`
            if 1 < 2: return true
            end if
        `);
        let { statements, errors } = brs.parser.Parser.parse(tokens);
        expect(errors.length).toEqual(0);
        expect(statements).toMatchSnapshot();
    });

    it("supports colon after return in single-line if statement", () => {
        let { tokens } = brs.lexer.Lexer.scan(`
            if false : print "true" : end if
        `);
        let { statements, errors } = brs.parser.Parser.parse(tokens);
        expect(errors.length).toEqual(0);
        expect(statements).toMatchSnapshot();
    });

    it("supports if elseif endif single line", () => {
        let { tokens } = brs.lexer.Lexer.scan(`
            if true: print "8 worked": else if true: print "not run": else: print "not run": end if
        `);
        let { statements, errors } = brs.parser.Parser.parse(tokens);
        expect(errors.length).toEqual(0);
        expect(statements).toMatchSnapshot();
    });

    it("supports one-line functions inside of one-line if statement", () => {
        let { tokens } = brs.lexer.Lexer.scan(`
            if true then : test = sub() : print "yes" : end sub : end if
        `);
        let { statements, errors } = brs.parser.Parser.parse(tokens);
        expect(errors.length).toEqual(0);
        expect(statements).toMatchSnapshot();
    });
});
