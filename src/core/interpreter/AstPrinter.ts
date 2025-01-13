import * as Expr from "../parser/Expression";
import * as Stmt from "../parser/Statement";

/** Creates a pretty-printed representation of an expression to ease debugging. */
export class AstPrinter implements Expr.Visitor<string> {
    private indent = 0;
    /**
     * Pretty-prints an expression for debugging purposes.
     * @param expression the expression to pretty-print.
     */
    async print(expression: Expr.Expression): Promise<string> {
        this.indent = 0;
        return await expression.accept(this);
    }

    visitAnonymousFunction(e: Expr.Function): string {
        return JSON.stringify(e, undefined, 2);
    }

    async visitBinary(e: Expr.Binary): Promise<string> {
        return this.parenthesize(e.token.text, e.left, e.right);
    }
    visitCall(e: Expr.Call): string {
        return JSON.stringify(e, undefined, 2);
    }
    async visitAtSignGet(e: Expr.AtSignGet): Promise<string> {
        return Promise.resolve(JSON.stringify(e, undefined, 2));
    }

    async visitDottedGet(e: Expr.DottedGet): Promise<string> {
        return Promise.resolve(JSON.stringify(e, undefined, 2));
    }

    async visitIndexedGet(e: Expr.IndexedGet): Promise<string> {
        return Promise.resolve(JSON.stringify(e, undefined, 2));
    }

    async visitGrouping(e: Expr.Grouping): Promise<string> {
        return await this.parenthesize("group", e.expression);
    }

    visitLiteral(e: Expr.Literal): string {
        if (e.value == null) {
            return "invalid";
        } else {
            return e.value.toString();
        }
    }
    async visitArrayLiteral(e: Expr.ArrayLiteral): Promise<string> {
        return Promise.resolve(JSON.stringify(e, undefined, 2));
    }
    async visitAALiteral(e: Expr.AALiteral): Promise<string> {
        return Promise.resolve(JSON.stringify(e, undefined, 2));
    }
    visitDottedSet(e: Stmt.DottedSet): string {
        return JSON.stringify(e, undefined, 2);
    }
    visitIndexedSet(e: Stmt.IndexedSet): string {
        return JSON.stringify(e, undefined, 2);
    }
    visitIncrement(e: Stmt.Increment): string {
        return JSON.stringify(e, undefined, 2);
    }
    async visitUnary(e: Expr.Unary): Promise<string> {
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
    private async parenthesize(
        name: string = "",
        ...expressions: Expr.Expression[]
    ): Promise<string> {
        this.indent++;
        let out = [
            `(${name}\n`,
            expressions.map((e) => `${"  ".repeat(this.indent)}${e.accept(this)}\n`).join(""),
            `${"  ".repeat(this.indent - 1)})`,
        ].join("");
        this.indent--;
        return out;
    }
}
