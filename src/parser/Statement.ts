import * as Expr from "./Expression";
import { Token } from "../Token";
import { BrsType, BrsInvalid, Argument } from "../brsTypes/index";

/** A set of reasons why a `Block` stopped executing. */
export enum StopReason {
    /** Execution reached the end of a block. */
    End,
    /** A runtime error occurred. */
    Error,
    /** An `exit for` statement was encountered. */
    ExitFor,
    /** An `exit while` statement was encountered. */
    ExitWhile
}

/** The output of a statement's execution. */
export interface Result {
    /** The value produced by executing the statement. */
    value: BrsType,
    /** Why the statement stopped executing. */
    reason: StopReason
}

export interface Visitor<T> {
    visitAssignment(statement: Assignment): Result;
    visitExpression(statement: Expression): Result;
    visitExitFor(statement: ExitFor): Result;
    visitExitWhile(statement: ExitWhile): Result;
    visitPrint(statement: Print): Result;
    visitIf(statement: If): Result;
    visitBlock(block: Block): Result;
    visitFor(statement: For): Result;
    visitWhile(statement: While): Result;
}

/** A BrightScript statement */
export interface Statement {
    /**
     * Handles the enclosing `Statement` with `visitor`.
     * @param visitor the `Visitor` that will handle the enclosing `Statement`
     * @returns a BrightScript value (typically `invalid`) and the reason why
     *          the statement exited (typically `StopReason.End`)
     */
    accept <R> (visitor: Visitor<R>): Result;
}

export class Assignment implements Statement {
    constructor(readonly name: Token, readonly value: Expr.Expression) {}

    accept<R>(visitor: Visitor<R>): Result {
        return visitor.visitAssignment(this);
    }
}

export class Block implements Statement {
    constructor(readonly statements: ReadonlyArray<Statement>) {}

    accept<R>(visitor: Visitor<R>): Result {
        return visitor.visitBlock(this);
    }
}

export class Expression implements Statement {
    constructor(readonly expression: Expr.Expression) {}

    accept<R>(visitor: Visitor<R>): Result {
        return visitor.visitExpression(this);
    }
}

export class ExitFor implements Statement {
    accept<R>(visitor: Visitor<R>): Result {
        return visitor.visitExitFor(this);
    }
}

export class ExitWhile implements Statement {
    accept<R>(visitor: Visitor<R>): Result {
        return visitor.visitExitWhile(this);
    }
}


export class Function implements Statement {
    constructor(
        readonly name: Token,
        readonly parameters: ReadonlyArray<Argument>,
        readonly body: Block
    ) {}

    // this might have to return a real value once we start to add anonymous functions
    // WAIT NO - anonymous functions are an `assign` with the RHS of a `function` expression I think?
    accept<R>(visitor: Visitor<R>): Result {
        throw new Error("Functions haven't been implemented yet.  But they parse!");
    }
}

export interface ElseIf {
    condition: Expr.Expression,
    thenBranch: Block
};

export class If implements Statement {
    constructor(
        readonly condition: Expr.Expression,
        readonly thenBranch: Block,
        readonly elseIfs: ElseIf[],
        readonly elseBranch?: Block
    ) {}

    accept<R>(visitor: Visitor<R>): Result {
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

    accept<R>(visitor: Visitor<R>): Result {
        return visitor.visitPrint(this);
    }
}

export class Return implements Statement {
    constructor(
        readonly keyword: Token,
        readonly value?: Expr.Expression
    ) {}

    accept<R>(visitor: Visitor<R>): Result {
        throw new Error("Method not implemented.");
    }
}

export class For implements Statement {
    constructor(
        readonly counterDeclaration: Assignment,
        readonly finalValue: Expr.Expression,
        readonly increment: Expr.Expression,
        readonly body: Block
    ) {}

    accept<R>(visitor: Visitor<R>): Result {
        return visitor.visitFor(this);
    }
}

export class While implements Statement {
    constructor(
        readonly condition: Expr.Expression,
        readonly body: Block
    ) {}

    accept<R>(visitor: Visitor<R>): Result {
        return visitor.visitWhile(this);
    }
}