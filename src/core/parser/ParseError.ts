import { Token, Lexeme } from "../lexer";
import { BrsError, ErrorDetail, RuntimeErrorDetail } from "../error/BrsError";
import { numberToHex } from "../common";

/** Formats a compile error as the device reports it, e.g. `Syntax Error. (compile error &h2)`. */
function compileError(detail: ErrorDetail) {
    return `${detail.message} (compile error &h${numberToHex(detail.errno)})`;
}

export class ParseError extends BrsError {
    /**
     * @param token the token where the error occurred
     * @param message a detail appended to the generic syntax error, or a specific compile error whose
     *                own message and code are reported instead
     */
    constructor(token: Token, message: string | ErrorDetail) {
        let m: string;
        if (typeof message !== "string") {
            m = compileError(message);
        } else if (token.kind === Lexeme.Eof) {
            m = "(At end of file) " + message;
        } else {
            m = `${compileError(RuntimeErrorDetail.BadSyntax)} ${message}`;
        }
        super(m, token.location);
    }
}
