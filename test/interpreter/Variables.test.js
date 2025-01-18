const brs = require("../../bin/brs.node");
const { Lexeme } = brs.lexer;
const { Expr, Stmt } = brs.parser;
const { Interpreter } = brs;
const { token, identifier } = require("../parser/ParserTests");
const { Int32, Int64, Float, Double, BrsString, BrsInvalid, ValueKind } = brs.types;

let interpreter;

describe("interpreter variables", () => {
    let tokens = { equals: token(Lexeme.Equals, "=") };

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    it("returns 'invalid' for assignments", async () => {
        let ast = new Stmt.Assignment(tokens, identifier("foo"), new Expr.Literal(new Int32(5)));

        let [result] = await interpreter.exec([ast]);
        expect(result).toEqual(BrsInvalid.Instance);
    });

    it("stores assigned values in variable scope", async () => {
        let six = new Int32(6);
        let ast = new Stmt.Assignment(tokens, identifier("bar"), new Expr.Literal(six));
        await interpreter.exec([ast]);
        expect(interpreter.environment.get(identifier("bar"))).toBe(six);
    });

    it("retrieves variables from variable scope", async () => {
        let seven = new Int32(7);
        let assign = new Stmt.Assignment(tokens, identifier("baz"), new Expr.Literal(seven));
        let retrieve = new Stmt.Expression(new Expr.Variable(identifier("baz")));
        let results = await interpreter.exec([assign, retrieve]);
        expect(results).toEqual([BrsInvalid.Instance, seven]);
    });

    it("disallows variables named after reserved words", async () => {
        let ast = [
            new Stmt.Assignment(
                tokens,
                identifier("type"),
                new Expr.Literal(new BrsString("this will fail"))
            ),
        ];

        await expect(() => interpreter.exec(ast)).rejects.toThrow(/reserved name/);
    });

    it("allows values of matching declared types", async () => {
        let assign = [
            new Stmt.Assignment(
                tokens,
                identifier("str$"),
                new Expr.Literal(new BrsString("$ suffix for strings"))
            ),
            new Stmt.Assignment(tokens, identifier("int32%"), new Expr.Literal(new Int32(1))),
            new Stmt.Assignment(tokens, identifier("float!"), new Expr.Literal(new Float(2))),
            new Stmt.Assignment(tokens, identifier("double#"), new Expr.Literal(new Double(3))),
            new Stmt.Assignment(tokens, identifier("int64&"), new Expr.Literal(new Int64(4))),
        ];

        await interpreter.exec(assign);

        let retrieve = ["str$", "int32%", "float!", "double#", "int64&"].map(
            (name) => new Stmt.Expression(new Expr.Variable(identifier(name)))
        );

        let stored = await interpreter.exec(retrieve);
        expect(stored).toEqual([
            new BrsString("$ suffix for strings"),
            new Int32(1),
            new Float(2),
            new Double(3),
            new Int64(4),
        ]);
    });

    // describe("type coercion", () => {
    //     describe("into integer LHS", () => {
    //         test.each([
    //             // pairs of [type, rhs, lhs_result]
    //             ["integer", new Int32(-5), new Int32(-5)],
    //             ["float", new Float(3.14159), new Int32(3)],
    //             ["double", new Double(2.71828), new Int32(2)],
    //             ["longinteger", new Int64(2147483647119), new Int32(-881)],
    //         ])("from %s to integer", async (_type, rhs, lhs_result) => {
    //             let assign = [
    //                 new Stmt.Assignment(tokens, identifier("int32%"), new Expr.Literal(rhs)),
    //             ];
    //             await expect(() => interpreter.exec(assign)).not.rejects;
    //             expect(interpreter.environment.get(identifier("int32%"))).toEqual(lhs_result);
    //         });
    //     });

    //     describe("into float LHS", () => {
    //         test.each([
    //             // pairs of [type, rhs, lhs_result]
    //             ["integer", new Int32(-5), new Float(-5)],
    //             ["float", new Float(3.14159), new Float(3.14159)],
    //             ["double", new Double(2.71828), new Float(2.71828)],
    //             ["longinteger", new Int64(2147483647119), new Float(2147483647119)],
    //         ])("from %s to integer", async (_type, rhs, lhs_result) => {
    //             let assign = [
    //                 new Stmt.Assignment(tokens, identifier("float!"), new Expr.Literal(rhs)),
    //             ];
    //             await expect(() => interpreter.exec(assign)).not.rejects;
    //             expect(interpreter.environment.get(identifier("float!"))).toEqual(lhs_result);
    //         });
    //     });

    //     describe("into double LHS", () => {
    //         test.each([
    //             // pairs of [type, rhs, lhs_result]
    //             ["integer", new Int32(-5), new Double(-5)],
    //             ["float", new Float(3.14159), new Double(3.14159)],
    //             ["double", new Double(2.71828), new Double(2.71828)],
    //             ["longinteger", new Int64(2147483647119), new Double(2147483647119)],
    //         ])("from %s to integer", async (_type, rhs, lhs_result) => {
    //             let assign = [
    //                 new Stmt.Assignment(tokens, identifier("double#"), new Expr.Literal(rhs)),
    //             ];
    //             await expect(() => interpreter.exec(assign)).not.rejects;
    //             expect(interpreter.environment.get(identifier("double#"))).toEqual(lhs_result);
    //         });
    //     });

    //     describe("into longinteger LHS", () => {
    //         test.each([
    //             // pairs of [type, rhs, lhs_result]
    //             ["integer", new Int32(-5), new Int64(-5)],
    //             ["float", new Float(3.14159), new Int64(3)],
    //             ["double", new Double(2.71828), new Int64(2)],
    //             ["longinteger", new Int64(2147483647119), new Int64(2147483647119)],
    //         ])("from %s to integer", async (_type, rhs, lhs_result) => {
    //             let assign = [
    //                 new Stmt.Assignment(tokens, identifier("longint&"), new Expr.Literal(rhs)),
    //             ];
    //             await expect(() => interpreter.exec(assign)).not.rejects;
    //             expect(interpreter.environment.get(identifier("longint&"))).toEqual(lhs_result);
    //         });
    //     });
    // });

    describe("type mismatch errors", () => {
        let str = new BrsString("foo");
        let int32 = new Int32(1);
        let float = new Float(2);
        let double = new Double(3);
        let int64 = new Int64(4);

        [
            {
                lhs: "string$",
                values: [int32, int64, float, double],
            },
            {
                lhs: "int32%",
                values: [str],
            },
            {
                lhs: "float!",
                values: [str],
            },
            {
                lhs: "double#",
                values: [str],
            },
            {
                lhs: "int64&",
                values: [str],
            },
        ].forEach(({ lhs, values }) => {
            test(lhs, async () => {
                values.forEach(async (value) => {
                    let assign = new Stmt.Assignment(
                        tokens,
                        identifier(lhs),
                        new Expr.Literal(value)
                    );
                    await expect(() => interpreter.exec([assign])).rejects.toThrowError(
                        "Type Mismatch."
                    );
                });
            });
        });
    });
});
