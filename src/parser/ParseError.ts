import { Token, Lexeme } from "../lexer";
import * as BrsError from "../Error";

export function make(token: Token, message: string) {
    let m = message;
    if (token.kind === Lexeme.Eof) {
        m = "(At end of file) " + message;
    }
    BrsError.make(m, token.line);

    return new ParseError();
}

export class ParseError extends Error {}
