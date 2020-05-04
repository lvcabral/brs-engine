const { lexer, types } = require("brs");
const { Lexer, Lexeme } = lexer;
const { BrsString, Int32, Int64, Float, Double } = types;

describe("lexer", () => {
    it("includes an end-of-file marker", () => {
        let { tokens } = Lexer.scan("");
        expect(tokens.map(t => t.kind)).toEqual([Lexeme.Eof]);
    });

    it("ignores tabs and spaces", () => {
        let { tokens } = Lexer.scan("\t\t  \t     \t");
        expect(tokens.map(t => t.kind)).toEqual([Lexeme.Eof]);
    });

    it("retains one newline from consecutive newlines", () => {
        let { tokens } = Lexer.scan("\n\n'foo\n\n\nprint 2\n\n");
        expect(tokens.map(t => t.kind)).toEqual([
            Lexeme.Print,
            Lexeme.Integer,
            Lexeme.Newline,
            Lexeme.Eof,
        ]);
    });

    it("gives the `stop` keyword its own Lexeme", () => {
        let { tokens } = Lexer.scan("stop");
        expect(tokens.map(t => t.kind)).toEqual([Lexeme.Stop, Lexeme.Eof]);
    });

    it("aliases '?' to 'print'", () => {
        let { tokens } = Lexer.scan("?2");
        expect(tokens.map(t => t.kind)).toEqual([Lexeme.Print, Lexeme.Integer, Lexeme.Eof]);
    });

    describe("comments", () => {
        it("ignores everything after `'`", () => {
            let { tokens } = Lexer.scan("= ' (");
            expect(tokens.map(t => t.kind)).toEqual([Lexeme.Equal, Lexeme.Eof]);
        });

        it("ignores everything after `REM`", () => {
            let { tokens } = Lexer.scan("= REM (");
            expect(tokens.map(t => t.kind)).toEqual([Lexeme.Equal, Lexeme.Eof]);
        });

        it("ignores everything after `rem`", () => {
            let { tokens } = Lexer.scan("= rem (");
            expect(tokens.map(t => t.kind)).toEqual([Lexeme.Equal, Lexeme.Eof]);
        });
    }); // comments

    describe("non-literals", () => {
        it("reads parens & braces", () => {
            let { tokens } = Lexer.scan("(){}");
            expect(tokens.map(t => t.kind)).toEqual([
                Lexeme.LeftParen,
                Lexeme.RightParen,
                Lexeme.LeftBrace,
                Lexeme.RightBrace,
                Lexeme.Eof,
            ]);
            expect(tokens.filter(t => !!t.literal).length).toBe(0);
        });

        it("reads operators", () => {
            let { tokens } = Lexer.scan("^ - + * MOD / \\ -- ++");

            expect(tokens.map(t => t.kind)).toEqual([
                Lexeme.Caret,
                Lexeme.Minus,
                Lexeme.Plus,
                Lexeme.Star,
                Lexeme.Mod,
                Lexeme.Slash,
                Lexeme.Backslash,
                Lexeme.MinusMinus,
                Lexeme.PlusPlus,
                Lexeme.Eof,
            ]);
            expect(tokens.filter(t => !!t.literal).length).toBe(0);
        });

        it("reads bitshift operators", () => {
            let { tokens } = Lexer.scan("<< >> <<");
            expect(tokens.map(t => t.kind)).toEqual([
                Lexeme.LeftShift,
                Lexeme.RightShift,
                Lexeme.LeftShift,
                Lexeme.Eof,
            ]);
            expect(tokens.filter(t => !!t.literal).length).toBe(0);
        });

        it("reads bitshift assignment operators", () => {
            let { tokens } = Lexer.scan("<<= >>=");
            expect(tokens.map(t => t.kind)).toEqual([
                Lexeme.LeftShiftEqual,
                Lexeme.RightShiftEqual,
                Lexeme.Eof,
            ]);
            expect(tokens.filter(t => !!t.literal).length).toBe(0);
        });

        it("reads comparators", () => {
            let { tokens } = Lexer.scan("< <= > >= = <>");
            expect(tokens.map(t => t.kind)).toEqual([
                Lexeme.Less,
                Lexeme.LessEqual,
                Lexeme.Greater,
                Lexeme.GreaterEqual,
                Lexeme.Equal,
                Lexeme.LessGreater,
                Lexeme.Eof,
            ]);
            expect(tokens.filter(t => !!t.literal).length).toBe(0);
        });
    }); // non-literals

    describe("string literals", () => {
        it("produces string literal tokens", () => {
            let { tokens } = Lexer.scan(`"hello world"`);
            expect(tokens.map(t => t.kind)).toEqual([Lexeme.String, Lexeme.Eof]);
            expect(tokens[0].literal).toEqual(new BrsString("hello world"));
        });

        it(`safely escapes " literals`, () => {
            let { tokens } = Lexer.scan(`"the cat says ""meow"""`);
            expect(tokens[0].kind).toBe(Lexeme.String);
            expect(tokens[0].literal).toEqual(new BrsString(`the cat says "meow"`));
        });

        it("produces an error for unterminated strings", () => {
            let { errors } = Lexer.scan(`"unterminated!`);
            expect(errors.map(err => err.message)).toEqual([
                expect.stringMatching("Unterminated string"),
            ]);
        });

        it("disallows multiline strings", () => {
            let { errors } = Lexer.scan(`"multi-line\n\n`);
            expect(errors.map(err => err.message)).toEqual([
                expect.stringMatching("Unterminated string"),
            ]);
        });
    }); // string literals

    describe("double literals", () => {
        it("respects '#' suffix", () => {
            let d = Lexer.scan("123#").tokens[0];
            expect(d.kind).toBe(Lexeme.Double);
            expect(d.literal).toEqual(new Double(123));
        });

        it("forces literals >= 10 digits into doubles", () => {
            let d = Lexer.scan("0000000005").tokens[0];
            expect(d.kind).toBe(Lexeme.Double);
            expect(d.literal).toEqual(new Double(5));
        });

        it("forces literals with 'D' in exponent into doubles", () => {
            let d = Lexer.scan("2.5d3").tokens[0];
            expect(d.kind).toBe(Lexeme.Double);
            expect(d.literal).toEqual(new Double(2500));
        });

        it("allows digits before `.` to be elided", () => {
            let f = Lexer.scan(".123#").tokens[0];
            expect(f.kind).toBe(Lexeme.Double);
            expect(f.literal).toEqual(new Double(0.123));
        });

        it("allows digits after `.` to be elided", () => {
            let f = Lexer.scan("12.#").tokens[0];
            expect(f.kind).toBe(Lexeme.Double);
            expect(f.literal).toEqual(new Double(12));
        });
    });

    describe("float literals", () => {
        it("respects '!' suffix", () => {
            let f = Lexer.scan("0.00000008!").tokens[0];
            expect(f.kind).toBe(Lexeme.Float);
            // Floating precision will make this *not* equal
            expect(f.literal).not.toBe(8e-8);
            expect(f.literal).toEqual(new Float(0.00000008));
        });

        it("forces literals with a decimal into floats", () => {
            let f = Lexer.scan("1.0").tokens[0];
            expect(f.kind).toBe(Lexeme.Float);
            expect(f.literal).toEqual(new Float(1000000000000e-12));
        });

        it("forces literals with 'E' in exponent into floats", () => {
            let f = Lexer.scan("2.5e3").tokens[0];
            expect(f.kind).toBe(Lexeme.Float);
            expect(f.literal).toEqual(new Float(2500));
        });

        it("allows digits before `.` to be elided", () => {
            let f = Lexer.scan(".123").tokens[0];
            expect(f.kind).toBe(Lexeme.Float);
            expect(f.literal).toEqual(new Float(0.123));
        });

        it("allows digits after `.` to be elided", () => {
            let f = Lexer.scan("12.").tokens[0];
            expect(f.kind).toBe(Lexeme.Float);
            expect(f.literal).toEqual(new Float(12));
        });
    });

    describe("long integer literals", () => {
        it("supports hexadecimal literals", () => {
            let i = Lexer.scan("&hf00d&").tokens[0];
            expect(i.kind).toBe(Lexeme.LongInteger);
            expect(i.literal).toEqual(new Int64(61453));
        });

        it("allows very long Int64 literals", () => {
            let li = Lexer.scan("9876543210&").tokens[0];
            expect(li.kind).toBe(Lexeme.LongInteger);
            expect(li.literal).toEqual(Int64.fromString("9876543210"));
        });

        it("forces literals with '&' suffix into Int64s", () => {
            let li = Lexer.scan("123&").tokens[0];
            expect(li.kind).toBe(Lexeme.LongInteger);
            expect(li.literal).toEqual(new Int64(123));
        });
    });

    describe("integer literals", () => {
        it("supports hexadecimal literals", () => {
            let i = Lexer.scan("&hFf").tokens[0];
            expect(i.kind).toBe(Lexeme.Integer);
            expect(i.literal).toEqual(new Int32(255));
        });

        it("falls back to a regular integer", () => {
            let i = Lexer.scan("123").tokens[0];
            expect(i.kind).toBe(Lexeme.Integer);
            expect(i.literal).toEqual(new Int32(123));
        });
    });

    describe("identifiers", () => {
        it("matches single-word keywords", () => {
            // test just a sample of single-word reserved words for now.
            // if we find any that we've missed
            let { tokens } = Lexer.scan("and or if else endif return true false line_num");
            expect(tokens.map(w => w.kind)).toEqual([
                Lexeme.And,
                Lexeme.Or,
                Lexeme.If,
                Lexeme.Else,
                Lexeme.EndIf,
                Lexeme.Return,
                Lexeme.True,
                Lexeme.False,
                Lexeme.Identifier,
                Lexeme.Eof,
            ]);
            expect(tokens.filter(w => !!w.literal).length).toBe(0);
        });

        it("matches multi-word keywords", () => {
            let { tokens } = Lexer.scan("else if end if end while End Sub end Function Exit wHILe");
            expect(tokens.map(w => w.kind)).toEqual([
                Lexeme.ElseIf,
                Lexeme.EndIf,
                Lexeme.EndWhile,
                Lexeme.EndSub,
                Lexeme.EndFunction,
                Lexeme.ExitWhile,
                Lexeme.Eof,
            ]);
            expect(tokens.filter(w => !!w.literal).length).toBe(0);
        });

        it("accepts 'exit for' but not 'exitfor'", () => {
            let { tokens } = Lexer.scan("exit for exitfor");
            expect(tokens.map(w => w.kind)).toEqual([
                Lexeme.ExitFor,
                Lexeme.Identifier,
                Lexeme.Eof,
            ]);
        });

        it("matches keywords with silly capitalization", () => {
            let { tokens } = Lexer.scan("iF ELSE eNDIf FUncTioN");
            expect(tokens.map(w => w.kind)).toEqual([
                Lexeme.If,
                Lexeme.Else,
                Lexeme.EndIf,
                Lexeme.Function,
                Lexeme.Eof,
            ]);
        });

        it("allows alpha-numeric (plus '_') identifiers", () => {
            let identifier = Lexer.scan("_abc_123_").tokens[0];
            expect(identifier.kind).toBe(Lexeme.Identifier);
            expect(identifier.text).toBe("_abc_123_");
        });

        it("allows identifiers with trailing type designators", () => {
            let { tokens } = Lexer.scan("lorem$ ipsum% dolor! sit# amet&");
            let identifiers = tokens.filter(t => t.kind !== Lexeme.Eof);
            expect(identifiers.every(t => t.kind === Lexeme.Identifier));
            expect(identifiers.map(t => t.text)).toEqual([
                "lorem$",
                "ipsum%",
                "dolor!",
                "sit#",
                "amet&",
            ]);
        });
    });

    describe("conditional compilation", () => {
        it("reads constant declarations", () => {
            let { tokens } = Lexer.scan("#const foo true");
            expect(tokens.map(t => t.kind)).toEqual([
                Lexeme.HashConst,
                Lexeme.Identifier,
                Lexeme.True,
                Lexeme.Eof,
            ]);
        });

        it("reads constant aliases", () => {
            let { tokens } = Lexer.scan("#const bar foo");
            expect(tokens.map(t => t.kind)).toEqual([
                Lexeme.HashConst,
                Lexeme.Identifier,
                Lexeme.Identifier,
                Lexeme.Eof,
            ]);
        });

        it("reads conditional directives", () => {
            let { tokens } = Lexer.scan(
                "#if #else if #elseif #else #end if #endif #IF #ELSE IF #ELSEIF #ELSE #END IF #ENDIF"
            );
            expect(tokens.map(t => t.kind)).toEqual([
                Lexeme.HashIf,
                Lexeme.HashElseIf,
                Lexeme.HashElseIf,
                Lexeme.HashElse,
                Lexeme.HashEndIf,
                Lexeme.HashEndIf,
                Lexeme.HashIf,
                Lexeme.HashElseIf,
                Lexeme.HashElseIf,
                Lexeme.HashElse,
                Lexeme.HashEndIf,
                Lexeme.HashEndIf,
                Lexeme.Eof,
            ]);
        });

        it("reads forced compilation errors with messages", () => {
            let { tokens } = Lexer.scan("#error a message goes here\n");
            expect(tokens.map(t => t.kind)).toEqual([
                Lexeme.HashError,
                Lexeme.HashErrorMessage,
                Lexeme.Eof,
            ]);

            expect(tokens[1].text).toBe("a message goes here");
        });
    });

    describe("location tracking", () => {
        it("tracks starting and ending lines", () => {
            let { tokens } = Lexer.scan(`sub foo()\n\n    print "bar"\nend sub`);
            expect(tokens.map(t => t.location.start.line)).toEqual([1, 1, 1, 1, 1, 3, 3, 3, 4, 4]);

            expect(tokens.map(t => t.location.end.line)).toEqual([1, 1, 1, 1, 1, 3, 3, 3, 4, 4]);
        });

        it("tracks starting and ending columns", () => {
            let { tokens } = Lexer.scan(`sub foo()\n    print "bar"\nend sub`);
            expect(tokens.map(t => [t.location.start.column, t.location.end.column])).toEqual([
                [0, 3], // sub
                [4, 7], // foo
                [7, 8], // (
                [8, 9], // )
                [9, 10], // \n
                [4, 9], // print
                [10, 15], // "bar"
                [15, 16], // \n
                [0, 7], // end sub
                [7, 8], // EOF
            ]);
        });
    });

    describe("two word keywords", () => {
        it("supports various spacing between for each", () => {
            let { tokens } = Lexer.scan(
                "for each for  each for    each for\teach for\t each for \teach for \t each"
            );
            expect(tokens.map(t => t.kind)).toEqual([
                Lexeme.ForEach,
                Lexeme.ForEach,
                Lexeme.ForEach,
                Lexeme.ForEach,
                Lexeme.ForEach,
                Lexeme.ForEach,
                Lexeme.ForEach,
                Lexeme.Eof,
            ]);
        });
        it("supports various spacing between else if", () => {
            let { tokens } = Lexer.scan(
                "else if else  if else    if else\tif else\t if else \tif else \t if"
            );
            expect(tokens.map(t => t.kind)).toEqual([
                Lexeme.ElseIf,
                Lexeme.ElseIf,
                Lexeme.ElseIf,
                Lexeme.ElseIf,
                Lexeme.ElseIf,
                Lexeme.ElseIf,
                Lexeme.ElseIf,
                Lexeme.Eof,
            ]);
        });
    });

    it("detects rem when used as keyword", () => {
        let { tokens } = Lexer.scan("person.rem=true");
        expect(tokens.map(t => t.kind)).toEqual([
            Lexeme.Identifier,
            Lexeme.Dot,
            Lexeme.Identifier,
            Lexeme.Equal,
            Lexeme.True,
            Lexeme.Eof,
        ]);

        //verify the location of `rem`
        expect(tokens.map(t => [t.location.start.column, t.location.end.column])).toEqual([
            [0, 6], // person
            [6, 7], // .
            [7, 10], // rem
            [10, 11], // =
            [11, 15], // true
            [15, 16], // EOF
        ]);
    });

    describe("isToken", () => {
        it("returns booleans", () => {
            let location = {
                start: {
                    line: 1,
                    column: 1,
                },
                end: {
                    line: 1,
                    column: 2,
                },
                file: "SomeFile.brs",
            };

            expect(lexer.isToken({ kind: Lexeme.And, text: "and", location: location })).toBe(true);
            expect(lexer.isToken({ text: "and", location: location })).toBe(false);
        });
    });
}); // lexer
