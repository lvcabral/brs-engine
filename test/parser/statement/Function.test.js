const brs = require("brs");
const { Lexeme, BrsTypes } = brs;
const { BrsString, Int32 } = BrsTypes;
const BrsError = require("../../../lib/Error");

const { EOF } = require("../ParserTests");

describe("parser", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    describe("function declarations", () => {
        it("parses minimal empty function declarations", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Function, text: "function", line: 1 },
                { kind: Lexeme.Identifier, text: "foo", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.EndFunction, text: "end function", line: 2 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses non-empty function declarations", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Function, text: "function", line: 1 },
                { kind: Lexeme.Identifier, text: "foo", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.Print, text: "print", line: 2 },
                { kind: Lexeme.String, text: "Lorem ipsum", line: 2, literal: new BrsString("Lorem ipsum") },
                { kind: Lexeme.Newline, text: "\\n", line: 2 },
                { kind: Lexeme.EndFunction, text: "end function", line: 3 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses functions with implicit-dynamic arguments", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Function, text: "function", line: 1 },
                { kind: Lexeme.Identifier, text: "add2", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },
                { kind: Lexeme.Identifier, text: "a", line: 1 },
                { kind: Lexeme.Comma, text: ",", line: 1 },
                { kind: Lexeme.Identifier, text: "b", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.EndFunction, text: "end function", line: 2 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses functions with typed arguments", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Function, text: "function", line: 1 },
                { kind: Lexeme.Identifier, text: "repeat", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },
                { kind: Lexeme.Identifier, text: "str", line: 1 },
                { kind: Lexeme.Identifier, text: "as", line: 1 },
                { kind: Lexeme.Identifier, text: "string", line: 1 },
                { kind: Lexeme.Comma, text: ",", line: 1 },
                { kind: Lexeme.Identifier, text: "count", line: 1 },
                { kind: Lexeme.Identifier, text: "as", line: 1 },
                { kind: Lexeme.Identifier, text: "integer", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.EndFunction, text: "end function", line: 2 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses functions with default argument expressions", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Function, text: "function", line: 1 },
                { kind: Lexeme.Identifier, text: "add", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },

                { kind: Lexeme.Identifier, text: "a", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: "3", line: 1, literal: new Int32(3) },
                { kind: Lexeme.Comma, text: ",", line: 1 },

                { kind: Lexeme.Identifier, text: "b", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: "4", line: 1, literal: new Int32(4) },
                { kind: Lexeme.Comma, text: ",", line: 1 },

                { kind: Lexeme.Identifier, text: "c", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Identifier, text: "a", line: 1 },
                { kind: Lexeme.Plus, text: "+", line: 1 },
                { kind: Lexeme.Integer, text: "5", line: 1, literal: new Int32(5) },
                { kind: Lexeme.RightParen, text: ")", line: 1 },

                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.EndFunction, text: "end function", line: 2 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses functions with typed arguments and default expressions", () => {
             let { statements, errors } = parser.parse([
                { kind: Lexeme.Function, text: "function", line: 1 },
                { kind: Lexeme.Identifier, text: "add", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },

                { kind: Lexeme.Identifier, text: "a", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: "3", line: 1, literal: new Int32(3) },
                { kind: Lexeme.Identifier, text: "as", line: 1 },
                { kind: Lexeme.Identifier, text: "integer", line: 1 },
                { kind: Lexeme.Comma, text: ",", line: 1 },

                { kind: Lexeme.Identifier, text: "b", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Identifier, text: "a", line: 1 },
                { kind: Lexeme.Plus, text: "+", line: 1 },
                { kind: Lexeme.Integer, text: "5", line: 1, literal: new Int32(5) },
                { kind: Lexeme.Identifier, text: "as", line: 1 },
                { kind: Lexeme.Identifier, text: "integer", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },

                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.EndFunction, text: "end function", line: 2 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses return types", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Function, text: "function", line: 1 },
                { kind: Lexeme.Identifier, text: "foo", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                { kind: Lexeme.Identifier, text: "as", line: 1 },
                { kind: Lexeme.Identifier, text: "void", line: 1 },
                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.EndFunction, text: "end function", line: 2 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });
    });

    describe("sub declarations", () => {
        it("parses minimal sub declarations", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Sub, text: "sub", line: 1 },
                { kind: Lexeme.Identifier, text: "bar", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.EndSub, text: "end sub", line: 2 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses non-empty sub declarations", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Sub, text: "sub", line: 1 },
                { kind: Lexeme.Identifier, text: "foo", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.Print, text: "print", line: 2 },
                { kind: Lexeme.String, text: "Lorem ipsum", line: 2, literal: new BrsString("Lorem ipsum") },
                { kind: Lexeme.Newline, text: "\\n", line: 2 },
                { kind: Lexeme.EndSub, text: "end sub", line: 3 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses subs with implicit-dynamic arguments", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Function, text: "sub", line: 1 },
                { kind: Lexeme.Identifier, text: "add2", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },
                { kind: Lexeme.Identifier, text: "a", line: 1 },
                { kind: Lexeme.Comma, text: ",", line: 1 },
                { kind: Lexeme.Identifier, text: "b", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.EndFunction, text: "end sub", line: 2 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses subs with typed arguments", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Function, text: "sub", line: 1 },
                { kind: Lexeme.Identifier, text: "repeat", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },
                { kind: Lexeme.Identifier, text: "str", line: 1 },
                { kind: Lexeme.Identifier, text: "as", line: 1 },
                { kind: Lexeme.Identifier, text: "string", line: 1 },
                { kind: Lexeme.Comma, text: ",", line: 1 },
                { kind: Lexeme.Identifier, text: "count", line: 1 },
                { kind: Lexeme.Identifier, text: "as", line: 1 },
                { kind: Lexeme.Identifier, text: "integer", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.EndFunction, text: "end sub", line: 2 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses subs with default argument expressions", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Sub, text: "sub", line: 1 },
                { kind: Lexeme.Identifier, text: "add", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },

                { kind: Lexeme.Identifier, text: "a", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: "3", line: 1, literal: new Int32(3) },
                { kind: Lexeme.Comma, text: ",", line: 1 },

                { kind: Lexeme.Identifier, text: "b", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: "4", line: 1, literal: new Int32(4) },
                { kind: Lexeme.Comma, text: ",", line: 1 },

                { kind: Lexeme.Identifier, text: "c", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Identifier, text: "a", line: 1 },
                { kind: Lexeme.Plus, text: "+", line: 1 },
                { kind: Lexeme.Integer, text: "5", line: 1, literal: new Int32(5) },
                { kind: Lexeme.RightParen, text: ")", line: 1 },

                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.EndSub, text: "end sub", line: 2 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses subs with typed arguments and default expressions", () => {
             let { statements, errors } = parser.parse([
                { kind: Lexeme.Sub, text: "sub", line: 1 },
                { kind: Lexeme.Identifier, text: "add", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },

                { kind: Lexeme.Identifier, text: "a", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Integer, text: "3", line: 1, literal: new Int32(3) },
                { kind: Lexeme.Identifier, text: "as", line: 1 },
                { kind: Lexeme.Identifier, text: "integer", line: 1 },
                { kind: Lexeme.Comma, text: ",", line: 1 },

                { kind: Lexeme.Identifier, text: "b", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Identifier, text: "a", line: 1 },
                { kind: Lexeme.Plus, text: "+", line: 1 },
                { kind: Lexeme.Integer, text: "5", line: 1, literal: new Int32(5) },
                { kind: Lexeme.Identifier, text: "as", line: 1 },
                { kind: Lexeme.Identifier, text: "integer", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },

                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.EndSub, text: "end sub", line: 2 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("doesn't allow return types", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Sub, text: "sub", line: 1 },
                { kind: Lexeme.Identifier, text: "foo", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                { kind: Lexeme.Identifier, text: "as", line: 1 },
                { kind: Lexeme.Identifier, text: "integer", line: 1 },
                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.EndSub, text: "end sub", line: 2 },
                EOF
            ]);

            expect(BrsError.found()).toBeTruthy();
        });
    });
});
