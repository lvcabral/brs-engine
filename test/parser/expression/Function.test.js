const Parser = require("../../../lib/parser");
const { Lexeme, BrsTypes } = require("brs");
const { BrsString, Int32 } = BrsTypes;
const BrsError = require("../../../lib/Error");

const { EOF } = require("../ParserTests");

describe("parser", () => {
    afterEach(() => BrsError.reset());

    describe("function expressions", () => {
        it("parses minimal empty function expressions", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Function, text: "function", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.EndFunction, text: "end function", line: 2 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses non-empty function expressions", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Function, text: "function", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.Print, text: "print", line: 2 },
                { kind: Lexeme.String, text: "Lorem ipsum", line: 2, literal: new BrsString("Lorem ipsum") },
                { kind: Lexeme.Newline, text: "\\n", line: 2 },
                { kind: Lexeme.EndFunction, text: "end function", line: 3 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses functions with implicit-dynamic arguments", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Function, text: "function", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },
                { kind: Lexeme.Identifier, text: "a", line: 1 },
                { kind: Lexeme.Comma, text: ",", line: 1 },
                { kind: Lexeme.Identifier, text: "b", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.EndFunction, text: "end function", line: 2 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses functions with typed arguments", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Function, text: "function", line: 1 },
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

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses functions with default argument expressions", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Function, text: "function", line: 1 },
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

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses functions with typed arguments and default expressions", () => {
             let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Function, text: "function", line: 1 },
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

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses return types", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Function, text: "function", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                { kind: Lexeme.Identifier, text: "as", line: 1 },
                { kind: Lexeme.Identifier, text: "void", line: 1 },
                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.EndFunction, text: "end function", line: 2 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });
    });

    describe("sub expressions", () => {
        it("parses minimal sub expressions", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Sub, text: "sub", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.EndSub, text: "end sub", line: 2 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses non-empty sub expressions", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Sub, text: "sub", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.Print, text: "print", line: 2 },
                { kind: Lexeme.String, text: "Lorem ipsum", line: 2, literal: new BrsString("Lorem ipsum") },
                { kind: Lexeme.Newline, text: "\\n", line: 2 },
                { kind: Lexeme.EndSub, text: "end sub", line: 3 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses subs with implicit-dynamic arguments", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Function, text: "sub", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },
                { kind: Lexeme.Identifier, text: "a", line: 1 },
                { kind: Lexeme.Comma, text: ",", line: 1 },
                { kind: Lexeme.Identifier, text: "b", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.EndFunction, text: "end sub", line: 2 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses subs with typed arguments", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Function, text: "sub", line: 1 },
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

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses subs with default argument expressions", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Sub, text: "sub", line: 1 },
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

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("parses subs with typed arguments and default expressions", () => {
             let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Sub, text: "sub", line: 1 },
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

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("doesn't allow return types", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.Sub, text: "sub", line: 1 },
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

    describe("usage", () => {
        it("allows sub expressions in call arguments", () => {
            const parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "acceptsCallback", line: 1 },
                { kind: Lexeme.LeftParen,  text: "(", line: 1 },
                { kind: Lexeme.Newline, text: "\\n", line: 1 },

                { kind: Lexeme.Function, text: "function", line: 2 },
                { kind: Lexeme.LeftParen, text: "(", line: 2 },
                { kind: Lexeme.RightParen, text: ")", line: 2 },
                { kind: Lexeme.Newline, text: "\\n", line: 2 },
                { kind: Lexeme.Print, text: "print", line: 3 },
                { kind: Lexeme.String, text: "I'm a callback", line: 3, literal: new BrsString("I'm a callback") },
                { kind: Lexeme.Newline, text: "\\n", line: 3 },
                { kind: Lexeme.EndFunction, text: "end function", line: 4 },
                { kind: Lexeme.Newline, text: "\\n", line: 4 },

                { kind: Lexeme.RightParen, text: ")", line: 5 },
                EOF
            ]);

            expect(BrsError.found()).toBe(false);
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("allows function expressions in assignment RHS", () => {
            const parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "anonymousFunction", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },

                { kind: Lexeme.Function, text: "function", line: 1 },
                { kind: Lexeme.LeftParen, text: "(", line: 1 },
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                { kind: Lexeme.Newline, text: "\\n", line: 1 },
                { kind: Lexeme.Print, text: "print", line: 2 },
                { kind: Lexeme.String, text: "I'm anonymous", line: 2, literal: new BrsString("I'm anonymous") },
                { kind: Lexeme.Newline, text: "\\n", line: 2 },
                { kind: Lexeme.EndFunction, text: "end function", line: 3 },

                EOF
            ]);

            expect(BrsError.found()).toBe(false);
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });
    });
});