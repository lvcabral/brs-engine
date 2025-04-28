import { Token, Lexeme } from "../lexer";
import { BrsError, RuntimeErrorDetail } from "../error/BrsError";
import { numberToHex } from "../common";

export class ParseError extends BrsError {
    constructor(token: Token, message: string) {
        const errorDetail = RuntimeErrorDetail.BadSyntax;
        let m = `${errorDetail.message} (compile error &h${numberToHex(errorDetail.errno)}) ${message}`;
        if (token.kind === Lexeme.Eof) {
            m = "(At end of file) " + message;
        }

        super(m, token.location);
    }
}
