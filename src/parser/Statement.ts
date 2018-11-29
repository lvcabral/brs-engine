import * as Expr from "./Expression";
import { Token } from "../lexer";
import { BrsType } from "../brsTypes";

/** A set of reasons why a `Block` stopped executing. */
export * from "./BlockEndReason";

export interface Visitor<T> {
    visitAssignment(statement: Assignment): BrsType;
    visitExpression(statement: Expression): BrsType;
    visitExitFor(statement: ExitFor): never;
    visitExitWhile(statement: ExitWhile): never;
    visitPrint(statement: Print): BrsType;
    visitIf(statement: If): BrsType;
    visitBlock(block: Block): BrsType;
    visitFor(statement: For): BrsType;
    visitForEach(statement: ForEach): BrsType;
    visitWhile(statement: While): BrsType;
    visitNamedFunction(statement: Function): BrsType;
    visitReturn(statement: Return): never;
}

/** A BrightScript statement */
export interface Statement {
    /**
     * Handles the enclosing `Statement` with `visitor`.
     * @param visitor the `Visitor` that will handle the enclosing `Statement`
     * @returns a BrightScript value (typically `invalid`) and the reason why
     *          the statement exited (typically `StopReason.End`)
     */
    accept <R> (visitor: Visitor<R>): BrsType;
}

export class Assignment implements Statement {
    constructor(readonly name: Token, readonly value: Expr.Expression) {}

    accept<R>(visitor: Visitor<R>): BrsType {
        return visitor.visitAssignment(this);
    }
}

export class Block implements Statement {
    constructor(readonly statements: ReadonlyArray<Statement>) {}

    accept<R>(visitor: Visitor<R>): BrsType {
        return visitor.visitBlock(this);
    }
}

export class Expression implements Statement {
    constructor(readonly expression: Expr.Expression) {}

    accept<R>(visitor: Visitor<R>): BrsType {
        return visitor.visitExpression(this);
    }
}

export class ExitFor implements Statement {
    accept<R>(visitor: Visitor<R>): BrsType {
        return visitor.visitExitFor(this);
    }
}

export class ExitWhile implements Statement {
    accept<R>(visitor: Visitor<R>): BrsType {
        return visitor.visitExitWhile(this);
    }
}


export class Function implements Statement {
    constructor(
        readonly name: Token,
        readonly func: Expr.Function
    ) {}

    accept<R>(visitor: Visitor<R>): BrsType {
        return visitor.visitNamedFunction(this);
    }
}

export interface ElseIf {
    condition: Expr.Expression,
    thenBranch: Block
}

export class If implements Statement {
    constructor(
        readonly condition: Expr.Expression,
        readonly thenBranch: Block,
        readonly elseIfs: ElseIf[],
        readonly elseBranch?: Block
    ) {}

    accept<R>(visitor: Visitor<R>): BrsType {
        return visitor.visitIf(this);
    }
}

/** The set of all accepted `print` statement separators. */
export enum PrintSeparator {
    /**
     * Used to indent the current `print` position to the next
     * 16-character-width output zone.
     */
    Tab,
    /** Used to insert a single whitespace character at the current `print` position. */
    Space
}

/**
 * Represents a `print` statement within BrightScript.
 */
export class Print implements Statement {
    /**
     * Creates a new internal representation of a BrightScript `print` statement.
     * @param expressions an array of expressions or `PrintSeparator`s to be
     *                    evaluated and printed.
     */
    constructor(
        readonly expressions: (Expr.Expression | PrintSeparator)[]
    ) {}

    accept<R>(visitor: Visitor<R>): BrsType {
        return visitor.visitPrint(this);
    }
}

export class Return implements Statement {
    constructor(
        readonly keyword: Token,
        readonly value?: Expr.Expression
    ) {}

    accept<R>(visitor: Visitor<R>): BrsType {
        return visitor.visitReturn(this);
    }
}

export class For implements Statement {
    constructor(
        readonly counterDeclaration: Assignment,
        readonly finalValue: Expr.Expression,
        readonly increment: Expr.Expression,
        readonly body: Block
    ) {}

    accept<R>(visitor: Visitor<R>): BrsType {
        return visitor.visitFor(this);
    }
}

export class ForEach implements Statement {
    constructor(
        readonly item: Token,
        readonly target: Expr.Expression,
        readonly body: Block
    ) {}

    accept<R>(visitor: Visitor<R>): BrsType {
        return visitor.visitForEach(this);
    }
}

export class While implements Statement {
    constructor(
        readonly condition: Expr.Expression,
        readonly body: Block
    ) {}

    accept<R>(visitor: Visitor<R>): BrsType {
        return visitor.visitWhile(this);
    }
}