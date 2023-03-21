const Expr = require("../../lib/parser/Expression");
const Stmt = require("../../lib/parser/Statement");

/**
 * Creates an expression AST that performs binary operation `operator` on left` and `right`.
 *
 * @param {*} left the literal to use as the left-hand side of the operation.
 * @param {Lexeme} operator the operator to use during the operation.
 * @param {*} right the literal to use as the right-hand side of the operation.
 *
 * @returns An AST representing the expression `${left} ${operator} ${right}`.
 */
exports.binary = function (left, operator, right) {
    return new Stmt.Expression(
        new Expr.Binary(
            new Expr.Literal(left),
            { kind: operator, line: 1 },
            new Expr.Literal(right)
        )
    );
};
