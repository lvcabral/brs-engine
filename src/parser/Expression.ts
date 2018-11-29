import { Token, Identifier } from "../Token";
import { BrsType, Argument, ValueKind, BrsString } from "../brsTypes";
import { Block } from "./Statement";
import { Lexeme } from "../Lexeme";

export interface Visitor<T> {
    visitAssign(expression: Assign): T;
    visitBinary(expression: Binary): T;
    visitCall(expression: Call): T;
    visitAnonymousFunction(func: Function): T;
    visitDottedGet(expression: DottedGet): T;
    visitIndexedGet(expression: IndexedGet): T;
    visitGrouping(expression: Grouping): T;
    visitLiteral(expression: Literal): T;
    visitArrayLiteral(expression: ArrayLiteral): T;
    visitAALiteral(expression: AALiteral): T;
    visitLogical(expression: Logical): T;
    visitM(expression: M): T;
    visitSet(expression: Set): T;
    visitUnary(expression: Unary): T;
    visitVariable(expression: Variable): T;
}

export interface Expression {
    accept <R> (visitor: Visitor<R>): R;
}

export class Assign implements Expression {
    constructor(
        readonly name: Token,
        readonly value: Expression
    ) {}

    accept <R> (visitor: Visitor<R>): R {
        return visitor.visitAssign(this);
    }
}

export class Binary implements Expression {
    constructor(
        readonly left: Expression,
        readonly token: Token,
        readonly right: Expression
    ) { }


    accept <R> (visitor: Visitor<R>): R {
        return visitor.visitBinary(this);
    }
}

export class Call implements Expression {
    static MaximumArguments = 32;

    constructor(
        readonly callee: Expression,
        readonly closingParen: Token,
        readonly args: Expression[]
    ) {}

    accept <R> (visitor: Visitor<R>): R {
        return visitor.visitCall(this);
    }
}

export class Function implements Expression {
    constructor(
        readonly parameters: ReadonlyArray<Argument>,
        readonly returns: ValueKind,
        readonly body: Block
    ) {}

    accept <R> (visitor: Visitor<R>): R {
        return visitor.visitAnonymousFunction(this);
    }
}

export class DottedGet implements Expression {
    constructor(
        readonly obj: Expression,
        readonly name: Identifier
    ) {}

    accept <R> (visitor: Visitor<R>): R {
        return visitor.visitDottedGet(this);
    }
}

export class IndexedGet implements Expression {
    constructor(
        readonly obj: Expression,
        readonly index: Expression,
        readonly closingSquare: Token,
    ) {}

    accept <R> (visitor: Visitor<R>): R {
        return visitor.visitIndexedGet(this);
    }
}

export class Grouping implements Expression {

    constructor(
        readonly expression: Expression
    ) {}

    accept <R> (visitor: Visitor<R>): R {
        return visitor.visitGrouping(this);
    }
}

export class Literal implements Expression {
    constructor(readonly value: BrsType) {}

    accept <R> (visitor: Visitor<R>): R {
        return visitor.visitLiteral(this);
    }
}

export class ArrayLiteral implements Expression {
    constructor(readonly elements: Expression[]) {}

    accept <R> (visitor: Visitor<R>): R {
        return visitor.visitArrayLiteral(this);
    }
}

/** A member of an associative array literal. */
export interface AAMember {
    /** The name of the member. */
    name: BrsString,
    /** The expression evaluated to determine the member's initial value. */
    value: Expression
}

export class AALiteral implements Expression {
    constructor(readonly elements: AAMember[]) {}

    accept <R> (visitor: Visitor<R>): R {
        return visitor.visitAALiteral(this);
    }
}

export class Logical implements Expression {
    constructor(
        readonly left: Expression,
        readonly operator: Token,
        readonly right: Expression
    ) {}

    accept<R>(visitor: Visitor<R>): R {
        return visitor.visitLogical(this);
    }
}

export class M implements Expression {
    constructor(readonly keyword: Token) {}

    accept<R>(visitor: Visitor<R>): R {
        return visitor.visitM(this);
    }
}

export class Set implements Expression {
    constructor(
       readonly obj: Expression,
       readonly name: Token,
       readonly value: Expression
    ) {}

    accept<R>(visitor: Visitor<R>): R {
        return visitor.visitSet(this);
    }
}

export class Unary implements Expression {
    constructor(
        readonly operator: Token,
        readonly right: Expression
    ) {}

    accept<R>(visitor: Visitor<R>): R {
        return visitor.visitUnary(this);
    }
}

export class Variable implements Expression {
    constructor(
        readonly name: Token
    ) {}

    accept<R>(visitor: Visitor<R>): R {
        return visitor.visitVariable(this);
    }
}