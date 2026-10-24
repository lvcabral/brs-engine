const brs = require("../../../packages/node/bin/brs.node");
const { Lexeme } = brs;
const { Int32 } = brs.types;

const { token, identifier, EOF } = require("../ParserTests");

describe("parser", () => {
    let parser;

    beforeEach(() => {
        parser = new brs.Parser();
    });

    describe("exponential expressions", () => {
        it("parses exponential operators", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.Caret, "^"),
                token(Lexeme.Integer, "3", new Int32(3)),
                EOF,
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("parses repeated exponential operators as right-associative", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.Caret, "^"),
                token(Lexeme.Integer, "3", new Int32(3)),
                token(Lexeme.Caret, "^"),
                token(Lexeme.Integer, "4", new Int32(4)),
                EOF,
            ]);

            expect(errors).toEqual([]);
            expect(statements).toBeDefined();
            expect(statements).not.toBeNull();
            expect(statements).toMatchSnapshot();
        });

        it("binds tighter than unary minus", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                token(Lexeme.Minus, "-"),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.Caret, "^"),
                token(Lexeme.Minus, "-"),
                token(Lexeme.Integer, "1", new Int32(1)),
                EOF,
            ]);

            expect(errors).toEqual([]);
            // -(2 ^ (-1))
            const value = statements[0].value;
            expect(value.constructor.name).toBe("Unary");
            expect(value.operator.kind).toBe(Lexeme.Minus);
            expect(value.right.constructor.name).toBe("Binary");
            expect(value.right.left.value.getValue()).toBe(2);
            expect(value.right.right.constructor.name).toBe("Unary");
            expect(value.right.right.right.value.getValue()).toBe(1);
        });

        it("binds unary minus between ^ and multiplicative operators", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                token(Lexeme.Minus, "-"),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.Caret, "^"),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.Star, "*"),
                token(Lexeme.Integer, "3", new Int32(3)),
                EOF,
            ]);

            expect(errors).toEqual([]);
            // (-(2 ^ 2)) * 3
            const value = statements[0].value;
            expect(value.constructor.name).toBe("Binary");
            expect(value.token.kind).toBe(Lexeme.Star);
            expect(value.left.constructor.name).toBe("Unary");
            expect(value.left.right.constructor.name).toBe("Binary");
            expect(value.left.right.token.kind).toBe(Lexeme.Caret);
            expect(value.right.value.getValue()).toBe(3);
        });

        it("parses a negated power on the right of a multiplicative operator", () => {
            let { statements, errors } = parser.parse([
                identifier("_"),
                token(Lexeme.Equal, "="),
                token(Lexeme.Integer, "2", new Int32(2)),
                token(Lexeme.Star, "*"),
                token(Lexeme.Minus, "-"),
                token(Lexeme.Integer, "3", new Int32(3)),
                token(Lexeme.Caret, "^"),
                token(Lexeme.Integer, "2", new Int32(2)),
                EOF,
            ]);

            expect(errors).toEqual([]);
            // 2 * (-(3 ^ 2))
            const value = statements[0].value;
            expect(value.token.kind).toBe(Lexeme.Star);
            expect(value.left.value.getValue()).toBe(2);
            expect(value.right.constructor.name).toBe("Unary");
            expect(value.right.right.token.kind).toBe(Lexeme.Caret);
        });
    });
});
