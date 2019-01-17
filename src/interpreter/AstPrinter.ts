import * as Expr from "../parser/Expression";
import * as Stmt from "../parser/Statement";
import { BrsType } from "../brsTypes";

/** Creates a pretty-printed representation of an expression to ease debugging. */
export class AstPrinter implements Expr.Visitor<string> {
    private indent = 0;
    /**
     * Pretty-prints an expression for debugging purposes.
     * @param expression the expression to pretty-print.
     */
    print(expression: Expr.Expression): string {
        this.indent = 0;
        return expression.accept(this);
    }

    visitAnonymousFunction(e: Expr.Function): string {
        return JSON.stringify(e, undefined, 2);
    }

    visitBinary(e: Expr.Binary): string {
        return this.parenthesize(e.token.text, e.left, e.right);
    }
    visitCall(e: Expr.Call): string {
        return JSON.stringify(e, undefined, 2);
    }
    visitDottedGet(e: Expr.DottedGet): string {
        return JSON.stringify(e, undefined, 2);
    }
    visitIndexedGet(e: Expr.IndexedGet): string {
        return JSON.stringify(e, undefined, 2);
    }
    visitGrouping(e: Expr.Grouping): string {
        return this.parenthesize("group", e.expression);
    }
    visitLiteral(e: Expr.Literal): string {
        if (e.value == null) { return "invalid"; }
        else { return e.value.toString(); }
    }
    visitArrayLiteral(e: Expr.ArrayLiteral): string {
        return JSON.stringify(e, undefined, 2);
    }
    visitAALiteral(e: Expr.AALiteral): string {
        return JSON.stringify(e, undefined, 2);
    }
    visitDottedSet(e: Stmt.DottedSet): string {
        return JSON.stringify(e, undefined, 2);
    }
    visitIndexedSet(e: Stmt.IndexedSet): string {
        return JSON.stringify(e, undefined, 2);
    }
    visitUnary(e: Expr.Unary): string {
        return this.parenthesize(e.operator.text, e.right);
    }
    visitVariable(expression: Expr.Variable): string {
        return JSON.stringify(expression, undefined, 2);
    }

    /**
     * Wraps an expression in parentheses to make its grouping visible during debugging.
     *
     * @param name The name of the expression type being printed.
     * @param expressions any subexpressions that need to be stringified as well.
     */
    private parenthesize(name: string = "", ...expressions: Expr.Expression[]): string {
        this.indent++;
        let out = [
            `(${name}\n`,
            expressions.map(e =>
                `${"  ".repeat(this.indent)}${e.accept(this)}\n`
            ).join(""),
            `${"  ".repeat(this.indent - 1)})`
        ].join("");
        this.indent--;
        return out;
    }
}
