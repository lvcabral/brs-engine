const brs = require("brs");
const { Lexeme } = brs.lexer;
const { BrsString, Int32 } = brs.types;

const { token, identifier, EOF } = require("../ParserTests");

describe("parser assignment operators", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.parser.Parser();
    });


    test("+=", () => {
        let { statements, errors } = parser.parse([
            identifier("_"),
            token(Lexeme.PlusEqual),
            token(Lexeme.String, `"lorem"`, new BrsString("lorem")),
            EOF
        ]);

        expect(errors).toEqual([]);
        expect(statements).not.toBeFalsy();
        expect(statements).toMatchSnapshot();
    });

    test("-=", () => {
        let { statements, errors } = parser.parse([
            identifier("_"),
            token(Lexeme.MinusEqual),
            token(Lexeme.Integer, "1", new Int32(1)),
            EOF
        ]);

        expect(errors).toEqual([]);
        expect(statements).not.toBeFalsy();
        expect(statements).toMatchSnapshot();
    });

    test("^=", () => {
        let { statements, errors } = parser.parse([
            identifier("_"),
            token(Lexeme.CaretEqual),
            token(Lexeme.Integer, "2", new Int32(2)),
            EOF
        ]);

        expect(errors).toEqual([]);
        expect(statements).not.toBeFalsy();
        expect(statements).toMatchSnapshot();
    });

    test("*=", () => {
        let { statements, errors } = parser.parse([
            identifier("_"),
            token(Lexeme.StarEqual),
            token(Lexeme.Integer, "3", new Int32(3)),
            EOF
        ]);

        expect(errors).toEqual([]);
        expect(statements).not.toBeFalsy();
        expect(statements).toMatchSnapshot();
    });

    test("/=", () => {
        let { statements, errors } = parser.parse([
            identifier("_"),
            token(Lexeme.SlashEqual),
            token(Lexeme.Integer, "4", new Int32(4)),
            EOF
        ]);

        expect(errors).toEqual([]);
        expect(statements).not.toBeFalsy();
        expect(statements).toMatchSnapshot();
    });

    test("\\=", () => {
        let { statements, errors } = parser.parse([
            identifier("_"),
            token(Lexeme.BackslashEqual),
            token(Lexeme.Integer, "5", new Int32(5)),
            EOF
        ]);

        expect(errors).toEqual([]);
        expect(statements).not.toBeFalsy();
        expect(statements).toMatchSnapshot();
    });

    test("<<=", () => {
        let { statements, errors } = parser.parse([
            identifier("_"),
            token(Lexeme.LeftShiftEqual),
            token(Lexeme.Integer, "6", new Int32(6)),
            EOF
        ]);

        expect(errors).toEqual([]);
        expect(statements).not.toBeFalsy();
        expect(statements).toMatchSnapshot();
    });

    test(">>=", () => {
        let { statements, errors } = parser.parse([
            identifier("_"),
            token(Lexeme.RightShiftEqual),
            token(Lexeme.Integer, "7", new Int32(7)),
            EOF
        ]);

        expect(errors).toEqual([]);
        expect(statements).not.toBeFalsy();
        expect(statements).toMatchSnapshot();
    });
});