const brs = require("brs");

const { deindent } = require("../ParserTests");

function scan(str) {
    return brs.lexer.Lexer.scan(str).tokens;
}

describe("parser try/catch statements", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    it("requires catch to end try block", () => {
        const { errors } = parser.parse(
            scan(
                deindent(`
                    try
                        print "in try"
                    end try
                `)
            )
        );

        expect(errors).toEqual(
            expect.arrayContaining([new Error("Found unexpected token 'end try'")])
        );
    });

    it("requires variable binding for caught error", () => {
        const { errors } = parser.parse(
            scan(
                deindent(`
                    try
                        print "in try"
                    catch
                        print "in catch"
                    end try
                `)
            )
        );

        expect(errors).toEqual(
            expect.arrayContaining([
                new Error("Expected variable name for caught error after 'catch'"),
            ])
        );
    });

    it("requires end try or endtry to end catch block", () => {
        const { errors } = parser.parse(
            scan(
                deindent(`
                    try
                        print "in try"
                    catch e
                        print "in catch"
                    end if
                `)
            )
        );

        expect(errors).toEqual(
            expect.arrayContaining([
                new Error(
                    "(At end of file) Expected 'end try' or 'endtry' to terminate catch block"
                ),
            ])
        );
    });

    it("accepts try/catch/end try", () => {
        const { statements, errors } = parser.parse(
            scan(
                deindent(`
                    try
                        print "in try"
                    catch e
                        print "in catch"
                    end try
                `)
            )
        );

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("accepts try/catch/endtry", () => {
        const { statements, errors } = parser.parse(
            scan(
                deindent(`
                sub main()
                    try
                        print "in try"
                    catch e
                        print "in catch"
                    endtry
                end sub
                `)
            )
        );

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("allows try/catch to nest in try", () => {
        const { statements, errors } = parser.parse(
            scan(
                deindent(`
                    try
                        print "outer try"
                        try
                            print "inner try
                        catch e
                            print "in upper catch"
                        end try
                    catch e
                        print "in catch"
                    endtry
                `)
            )
        );

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });

    it("allows try and catch as variable names", () => {
        const { statements, errors } = parser.parse(
            scan(
                deindent(`
                    try = "attempt"
                    catch = "whoops, dropped it"
                `)
            )
        );

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });
});
