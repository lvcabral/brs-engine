const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");
const { identifier, token } = require("../parser/ParserTests");
const { Interpreter } = require("../../lib/interpreter");
const brs = require("brs");
const { Lexeme } = brs.lexer;
const { Int32, BrsString, BrsBoolean } = brs.types;

let interpreter;

describe("interpreter if statements", () => {
    let assignTo;

    beforeEach(() => {
        equals = { equals: token(Lexeme.Equals, "=") };
        assignTo = {
            foo: new Stmt.Assignment(
                equals,
                identifier("foo"),
                new Expr.Literal(BrsBoolean.True)
            ),
            bar: new Stmt.Assignment(
                equals,
                identifier("bar"),
                new Expr.Literal(BrsBoolean.False)
            ),
            lorem: new Stmt.Assignment(
                equals,
                identifier("lorem"),
                new Expr.Literal(new BrsString("lorem"))
            ),
            ipsum: new Stmt.Assignment(
                equals,
                identifier("ipsum"),
                new Expr.Literal(new BrsString("ipsum"))
            ),
            dolor: new Stmt.Assignment(
                equals,
                identifier("dolor"),
                new Expr.Literal(new BrsString("dolor"))
            ),
            sit: new Stmt.Assignment(
                equals,
                identifier("sit"),
                new Expr.Literal(new BrsString("sit"))
            ),
            amet: new Stmt.Assignment(
                equals,
                identifier("amet"),
                new Expr.Literal(new BrsString("amet"))
            )
        }

        interpreter = new Interpreter();
    });

    it("executes 'then' statements if 'condition' is 'true'", () => {
        assignTo.bar.accept = jest.fn();
        let statements = [
            new Stmt.If(
                {
                    if: token(Lexeme.If, "if"),
                    then: token(Lexeme.Then, "then"),
                    endIf: token(Lexeme.EndIf, "end if")
                },
                new Expr.Binary(
                    new Expr.Literal(new Int32(1)),
                    token(Lexeme.Less),
                    new Expr.Literal(new Int32(2))
                ),
                new Stmt.Block([
                    assignTo.foo,
                    assignTo.bar
                ])
            )
        ];

        interpreter.exec(statements);
        expect(assignTo.bar.accept).toBeCalled();
    });

    it("skips 'then' statements if 'condition' is 'false'", () => {
        assignTo.foo.accept = jest.fn();
        let statements = [
            new Stmt.If(
                {
                    if: token(Lexeme.If, "if"),
                    then: token(Lexeme.Then, "then"),
                    endIf: token(Lexeme.EndIf, "end if")
                },
                new Expr.Binary(
                    new Expr.Literal(new Int32(2)),
                    token(Lexeme.Less),
                    new Expr.Literal(new Int32(1))
                ),
                new Stmt.Block([
                    assignTo.foo,
                    assignTo.bar
                ])
            )
        ];

        interpreter.exec(statements);
        expect(assignTo.foo.accept).not.toBeCalled();
    });

    it("only executes one valid 'else if' that evaluates to 'true'", () => {
        let shouldExecute = jest.fn();
        let shouldNotExecute = jest.fn();

        [assignTo.foo, assignTo.bar, assignTo.dolor, assignTo.sit, assignTo.amet].forEach(
            assignment => assignment.accept = shouldNotExecute
        );
        [assignTo.lorem, assignTo.ipsum].forEach(
            assignment => assignment.accept = shouldExecute
        );

        let statements = [
            new Stmt.If(
                {
                    if: token(Lexeme.If, "if"),
                    then: token(Lexeme.Then, "then"),
                    elseIfs: [ token(Lexeme.ElseIf, "else if"), token(Lexeme.ElseIf, "else if") ],
                    else: token(Lexeme.Else, "else"),
                    endIf: token(Lexeme.EndIf, "end if")
                },
                new Expr.Binary(
                    new Expr.Literal(new Int32(2)),
                    token(Lexeme.Less),
                    new Expr.Literal(new Int32(1))
                ),
                new Stmt.Block([
                    assignTo.foo,
                    assignTo.bar
                ]),
                [
                    {
                        condition: new Expr.Literal(BrsBoolean.True),
                        thenBranch: new Stmt.Block([assignTo.lorem, assignTo.ipsum])
                    },
                    {
                        condition: new Expr.Literal(BrsBoolean.True),
                        thenBranch: new Stmt.Block([assignTo.dolor, assignTo.sit])
                    }
                ],
                new Stmt.Block([
                    assignTo.amet
                ])
            )
        ];

        interpreter.exec(statements);
        expect(shouldNotExecute).not.toBeCalled();
        expect(shouldExecute).toHaveBeenCalledTimes(2);
    })

    it("executes 'else' statements if nothing else matches", () => {
        let shouldExecute = jest.fn();
        let shouldNotExecute = jest.fn();

        [assignTo.foo, assignTo.bar, assignTo.lorem, assignTo.ipsum, assignTo.dolor, assignTo.sit].forEach(
            assignment => assignment.accept = shouldNotExecute
        );
        assignTo.amet.accept = shouldExecute;

        let statements = [
            new Stmt.If(
                {
                    if: token(Lexeme.If, "if"),
                    then: token(Lexeme.Then, "then"),
                    elseIfs: [ token(Lexeme.ElseIf, "else if"), token(Lexeme.ElseIf, "else if") ],
                    else: token(Lexeme.Else, "else"),
                    endIf: token(Lexeme.EndIf, "end if")
                },
                new Expr.Binary(
                    new Expr.Literal(new Int32(2)),
                    token(Lexeme.Less),
                    new Expr.Literal(new Int32(1))
                ),
                new Stmt.Block([
                    assignTo.foo,
                    assignTo.bar
                ]),
                [
                    {
                        condition: new Expr.Literal(BrsBoolean.False),
                        thenBranch: new Stmt.Block([assignTo.lorem, assignTo.ipsum])
                    },
                    {
                        condition: new Expr.Literal(BrsBoolean.False),
                        thenBranch: new Stmt.Block([assignTo.dolor, assignTo.sit])
                    }
                ],
                new Stmt.Block([
                    assignTo.amet
                ])
            )
        ];

        interpreter.exec(statements);
        expect(shouldNotExecute).not.toBeCalled();
        expect(shouldExecute).toBeCalled();
    });
});