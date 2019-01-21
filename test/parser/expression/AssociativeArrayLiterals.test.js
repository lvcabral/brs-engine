const BrsError = require("../../../lib/Error");
const brs = require("brs");
const { Lexeme, BrsTypes } = brs;
const { BrsString, Int32 } = BrsTypes;

const { EOF } = require("../ParserTests");

describe("parser associative array literals", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });

    describe("empty associative arrays", () => {
        test("on one line", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.LeftBrace, text: "{", line: 1 },
                { kind: Lexeme.RightBrace, text: "}", line: 1 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        test("on multiple lines", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.LeftBrace, text: "{", line: 1 },
                { kind: Lexeme.Newline, text: "\n", line: 1 },
                { kind: Lexeme.Newline, text: "\n", line: 2 },
                { kind: Lexeme.Newline, text: "\n", line: 3 },
                { kind: Lexeme.Newline, text: "\n", line: 4 },
                { kind: Lexeme.Newline, text: "\n", line: 5 },
                { kind: Lexeme.Newline, text: "\n", line: 6 },
                { kind: Lexeme.RightBrace, text: "}", line: 7 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });
    });

    describe("filled arrays", () => {
        test("on one line", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.LeftBrace, text: "{", line: 1 },
                { kind: Lexeme.Identifier, text: "foo", line: 1 },
                { kind: Lexeme.Colon, text: ":", line: 1 },
                { kind: Lexeme.Integer, text: "1", line: 1, literal: new Int32(1) },
                { kind: Lexeme.Comma, text: ",", line: 1 },
                { kind: Lexeme.Identifier, text: "bar", line: 1 },
                { kind: Lexeme.Colon, text: ":", line: 1 },
                { kind: Lexeme.Integer, text: "2", line: 1, literal: new Int32(2) },
                { kind: Lexeme.Comma, text: ",", line: 1 },
                { kind: Lexeme.Identifier, text: "baz", line: 1 },
                { kind: Lexeme.Colon, text: ":", line: 1 },
                { kind: Lexeme.Integer, text: "3", line: 1, literal: new Int32(3) },
                { kind: Lexeme.RightBrace, text: "}", line: 1 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        test("on multiple lines with commas", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.LeftBrace, text: "{", line: 1 },
                { kind: Lexeme.Newline, text: "\n", line: 1 },
                { kind: Lexeme.Identifier, text: "foo", line: 2 },
                { kind: Lexeme.Colon, text: ":", line: 2 },
                { kind: Lexeme.Integer, text: "1", line: 2, literal: new Int32(1) },
                { kind: Lexeme.Comma, text: ",", line: 2 },
                { kind: Lexeme.Newline, text: "\n", line: 2 },
                { kind: Lexeme.Identifier, text: "bar", line: 3 },
                { kind: Lexeme.Colon, text: ":", line: 3 },
                { kind: Lexeme.Integer, text: "2", line: 3, literal: new Int32(2) },
                { kind: Lexeme.Comma, text: ",", line: 3 },
                { kind: Lexeme.Newline, text: "\n", line: 3 },
                { kind: Lexeme.Identifier, text: "baz", line: 4 },
                { kind: Lexeme.Colon, text: ":", line: 4 },
                { kind: Lexeme.Integer, text: "3", line: 4, literal: new Int32(3) },
                { kind: Lexeme.Newline, text: "\n", line: 5 },
                { kind: Lexeme.RightBrace, text: "}", line: 6 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        test("on multiple lines without commas", () => {
            let { statements, errors } = parser.parse([
                { kind: Lexeme.Identifier, text: "_", line: 1 },
                { kind: Lexeme.Equal, text: "=", line: 1 },
                { kind: Lexeme.LeftBrace, text: "{", line: 1 },
                { kind: Lexeme.Newline, text: "\n", line: 1 },
                { kind: Lexeme.Identifier, text: "foo", line: 2 },
                { kind: Lexeme.Colon, text: ":", line: 2 },
                { kind: Lexeme.Integer, text: "1", line: 2, literal: new Int32(1) },
                { kind: Lexeme.Newline, text: "\n", line: 2 },
                { kind: Lexeme.Identifier, text: "bar", line: 3 },
                { kind: Lexeme.Colon, text: ":", line: 3 },
                { kind: Lexeme.Integer, text: "2", line: 3, literal: new Int32(2) },
                { kind: Lexeme.Newline, text: "\n", line: 3 },
                { kind: Lexeme.Identifier, text: "baz", line: 4 },
                { kind: Lexeme.Colon, text: ":", line: 4 },
                { kind: Lexeme.Integer, text: "3", line: 4, literal: new Int32(3) },
                { kind: Lexeme.Newline, text: "\n", line: 5 },
                { kind: Lexeme.RightBrace, text: "}", line: 6 },
                EOF
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });
    });

    it("allows a mix of quoted and unquoted keys", () => {
        let { statements, errors } = parser.parse([
            { kind: Lexeme.Identifier, text: "_", line: 1 },
            { kind: Lexeme.Equal, text: "=", line: 1 },
            { kind: Lexeme.LeftBrace, text: "{", line: 1 },
            { kind: Lexeme.Newline, text: "\n", line: 1 },
            { kind: Lexeme.String, text: "foo", line: 2, literal: new BrsString("foo") },
            { kind: Lexeme.Colon, text: ":", line: 2 },
            { kind: Lexeme.Integer, text: "1", line: 2, literal: new Int32(1) },
            { kind: Lexeme.Comma, text: ",", line: 2 },
            { kind: Lexeme.Newline, text: "\n", line: 2 },
            { kind: Lexeme.Identifier, text: "bar", line: 3 },
            { kind: Lexeme.Colon, text: ":", line: 3 },
            { kind: Lexeme.Integer, text: "2", line: 3, literal: new Int32(2) },
            { kind: Lexeme.Comma, text: ",", line: 3 },
            { kind: Lexeme.Newline, text: "\n", line: 3 },
            { kind: Lexeme.String, text: "requires-hyphens", line: 4, literal: new BrsString("requires-hypens") },
            { kind: Lexeme.Colon, text: ":", line: 4 },
            { kind: Lexeme.Integer, text: "3", line: 4, literal: new Int32(3) },
            { kind: Lexeme.Newline, text: "\n", line: 5 },
            { kind: Lexeme.RightBrace, text: "}", line: 6 },
            EOF
        ]);

        expect(errors).toEqual([]);
        expect(statements).toBeDefined();
        expect(statements).not.toBeNull();
        expect(statements).toMatchSnapshot();
    });
});
