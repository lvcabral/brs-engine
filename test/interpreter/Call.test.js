const BrsError = require("../../lib/Error");
const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { Interpreter } = require("../../lib/interpreter");
const { Lexeme, BrsTypes } = require("brs");
const { BrsString, ValueKind } = BrsTypes;

const { identifier } = require("../parser/ParserTests");

let interpreter;

describe("interpreter calls", () => {
    beforeEach(() => {
        BrsError.reset();
        interpreter = new Interpreter();
    });

    it("calls functions", () => {
        const call = new Stmt.Expression(
            new Expr.Call(
                new Expr.Variable(identifier("UCase")),
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                [ new Expr.Literal(new BrsTypes.BrsString("h@lL0")) ]
            )
        );
        const [ result ] = interpreter.exec([call]);
        expect(result.toString()).toBe("H@LL0");
    });

    it("sets a new `m` pointer when called from an associative array", () => {
        const ast = [
            new Stmt.Assignment(
                { kind: Lexeme.Identifier, text: "foo", line: 2 },
                new Expr.AALiteral([
                    {
                        name: new BrsString("setMId"),
                        value: new Expr.Function(
                            [],
                            ValueKind.Void,
                            new Stmt.Block([
                                new Stmt.DottedSet(
                                    new Expr.Variable({ kind: Lexeme.Identifier, text: "m", line: 3 }),
                                    { kind: Lexeme.Identifier, text: "id", line: 3 },
                                    new Expr.Literal(new BrsString("this is an ID"))
                                )
                            ])
                        )
                    }
                ])
            ),
            new Stmt.Expression(
                new Expr.Call(
                    new Expr.DottedGet(
                        new Expr.Variable({ kind: Lexeme.Identifier, text: "foo", line: 5 }),
                        { kind: Lexeme.Identifier, text: "setMId" }
                    ),
                    { kind: Lexeme.RightParen, text: ")", line: 2 },
                    [ ] // no args required
                )
            )
        ];

        interpreter.exec(ast);

        let foo = interpreter.environment.get({ kind: Lexeme.Identifier, text: "foo", line: -1 });
        expect(foo.kind).toBe(ValueKind.Object);
        expect(
            foo.get(new BrsString("id"))
        ).toEqual(new BrsString("this is an ID"));
    });

    it("errors when not enough arguments provided", () => {
        const call = new Stmt.Expression(
            new Expr.Call(
                new Expr.Variable(identifier("UCase")),
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                [] // no arugments
            )
        );

        expect(() => interpreter.exec([call])).toThrow(/UCase.*arguments/);
        expect(BrsError.found()).toBe(true);
    });

    it("errors when too many arguments are provided", () => {
        const call = new Stmt.Expression(
            new Expr.Call(
                new Expr.Variable(identifier("UCase")),
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                [
                    new Expr.Literal(new BrsTypes.BrsString("h@lL0")),
                    new Expr.Literal(new BrsTypes.BrsString("too many args")),
                ]
            )
        );

        expect(() => interpreter.exec([call])).toThrow(/UCase.*arguments/);
        expect(BrsError.found()).toBe(true);
    });

    it("errors when argument types are incorrect", () => {
        const call = new Stmt.Expression(
            new Expr.Call(
                new Expr.Variable(identifier("UCase")),
                { kind: Lexeme.RightParen, text: ")", line: 1 },
                [
                    new Expr.Literal(new BrsTypes.Int32(5)),
                ]
            )
        );

        expect(() => interpreter.exec([call])).toThrow(/Argument '.+' must be of type/);
        expect(BrsError.found()).toBe(true);
    });
});
