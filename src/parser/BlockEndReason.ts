import { BrsType } from "../brsTypes";
import * as BrsError from "../Error";
import { Token } from "../lexer";

export interface BlockEnd {
    kind: StopReason
}

export enum StopReason {
    ExitFor,
    ExitWhile,
    Return,
    RuntimeError
}

export class ExitForReason implements BlockEnd {
    readonly kind = StopReason.ExitFor;
}

export class ExitWhileReason implements BlockEnd {
    readonly kind = StopReason.ExitWhile;
}

export class ReturnValue implements BlockEnd {
    readonly kind = StopReason.Return;

    constructor(readonly location: Token, readonly value: BrsType) {}
}

export class Runtime implements BlockEnd {
    readonly kind = StopReason.RuntimeError;
}