const brs = require("../../bin/brs.node");
const { Expr, Stmt } = brs.parser;
const { token, fakeLocation } = require("../parser/ParserTests");
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
        new Expr.Binary(new Expr.Literal(left, fakeLocation), token(operator), new Expr.Literal(right, fakeLocation))
    );
};
