const Parser = require("../../../lib/parser");
const Expr = require("../../../lib/parser/Expression");
const { Lexeme } = require("../../../lib/Lexeme");
const BrsError = require("../../../lib/Error");
const { BrsBoolean, BrsInvalid, Int32 } = require("../../../lib/brsTypes");

const { EOF } = require("../ParserTests");

describe("parser array literals", () => {
    afterEach(() => BrsError.reset());

    describe("empty arrays", () => {
        test("on one line", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.LeftSquare, text: "[", line: 1 },
                { kind: Lexeme.RightSquare, text: "]", line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        test("on multiple lines", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.LeftSquare, text: "[", line: 1 },
                { kind: Lexeme.Newline, text: "\n", line: 1 },
                { kind: Lexeme.Newline, text: "\n", line: 2 },
                { kind: Lexeme.Newline, text: "\n", line: 3 },
                { kind: Lexeme.Newline, text: "\n", line: 4 },
                { kind: Lexeme.Newline, text: "\n", line: 5 },
                { kind: Lexeme.Newline, text: "\n", line: 6 },
                { kind: Lexeme.RightSquare, text: "]", line: 7 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });
    });

    describe("filled arrays", () => {
        test("on one line", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.LeftSquare, text: "[", line: 1 },
                { kind: Lexeme.Integer, text: "1", line: 1, literal: new Int32(1) },
                { kind: Lexeme.Comma, text: ",", line: 1 },
                { kind: Lexeme.Integer, text: "2", line: 1, literal: new Int32(2) },
                { kind: Lexeme.Comma, text: ",", line: 1 },
                { kind: Lexeme.Integer, text: "3", line: 1, literal: new Int32(3) },
                { kind: Lexeme.RightSquare, text: "]", line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        test("on multiple lines with commas", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.LeftSquare, text: "[", line: 1 },
                { kind: Lexeme.Newline, text: "\n", line: 1 },
                { kind: Lexeme.Integer, text: "1", line: 1, literal: new Int32(1) },
                { kind: Lexeme.Comma, text: ",", line: 1 },
                { kind: Lexeme.Newline, text: "\n", line: 1 },
                { kind: Lexeme.Integer, text: "2", line: 2, literal: new Int32(2) },
                { kind: Lexeme.Comma, text: ",", line: 2 },
                { kind: Lexeme.Newline, text: "\n", line: 2 },
                { kind: Lexeme.Integer, text: "3", line: 3, literal: new Int32(3) },
                { kind: Lexeme.Newline, text: "\n", line: 3 },
                { kind: Lexeme.RightSquare, text: "]", line: 4 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        test("on multiple lines without commas", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.LeftSquare, text: "[", line: 1 },
                { kind: Lexeme.Newline, text: "\n", line: 1 },
                { kind: Lexeme.Integer, text: "1", line: 1, literal: new Int32(1) },
                { kind: Lexeme.Newline, text: "\n", line: 1 },
                { kind: Lexeme.Integer, text: "2", line: 2, literal: new Int32(2) },
                { kind: Lexeme.Newline, text: "\n", line: 2 },
                { kind: Lexeme.Integer, text: "3", line: 3, literal: new Int32(3) },
                { kind: Lexeme.Newline, text: "\n", line: 3 },
                { kind: Lexeme.RightSquare, text: "]", line: 4 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });
    });

    describe("contents", () => {
        it("can contain primitives", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.LeftSquare, text: "[", line: 1 },
                { kind: Lexeme.Integer, text: "1", line: 1, literal: new Int32(1) },
                { kind: Lexeme.Comma, text: ",", line: 1 },
                { kind: Lexeme.Integer, text: "2", line: 1, literal: new Int32(2) },
                { kind: Lexeme.Comma, text: ",", line: 1 },
                { kind: Lexeme.Integer, text: "3", line: 1, literal: new Int32(3) },
                { kind: Lexeme.RightSquare, text: "]", line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("can contain other arrays", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.LeftSquare, text: "[", line: 1 },
                    { kind: Lexeme.LeftSquare, text: "[", line: 1 },
                    { kind: Lexeme.Integer, text: "1", line: 1, literal: new Int32(1) },
                    { kind: Lexeme.Comma, text: ",", line: 1 },
                    { kind: Lexeme.Integer, text: "2", line: 1, literal: new Int32(2) },
                    { kind: Lexeme.Comma, text: ",", line: 1 },
                    { kind: Lexeme.Integer, text: "3", line: 1, literal: new Int32(3) },
                    { kind: Lexeme.RightSquare, text: "]", line: 1 },
                { kind: Lexeme.Comma, text: ",", line: 1 },
                    { kind: Lexeme.LeftSquare, text: "[", line: 1 },
                    { kind: Lexeme.Integer, text: "4", line: 1, literal: new Int32(4) },
                    { kind: Lexeme.Comma, text: ",", line: 1 },
                    { kind: Lexeme.Integer, text: "5", line: 1, literal: new Int32(5) },
                    { kind: Lexeme.Comma, text: ",", line: 1 },
                    { kind: Lexeme.Integer, text: "6", line: 1, literal: new Int32(6) },
                    { kind: Lexeme.RightSquare, text: "]", line: 1 },
                { kind: Lexeme.RightSquare, text: "]", line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });

        it("can contain expressions", () => {
            let parsed = Parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.LeftSquare, text: "[", line: 1 },
                { kind: Lexeme.Integer, text: "1", line: 1, literal: new Int32(1) },
                { kind: Lexeme.Plus, text: "+", line: 1},
                { kind: Lexeme.Integer, text: "2", line: 1, literal: new Int32(2) },
                { kind: Lexeme.Comma, text: ",", line: 1 },
                { kind: Lexeme.Not, text: "not", line: 1 },
                { kind: Lexeme.False, text: "false", line: 1, literal: BrsBoolean.False },
                { kind: Lexeme.RightSquare, text: "]", line: 1 },
                EOF
            ]);

            expect(BrsError.found()).toBeFalsy();
            expect(parsed).toBeDefined();
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchSnapshot();
        });
    });
});