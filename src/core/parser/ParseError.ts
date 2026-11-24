import { Token, Lexeme } from "../lexer";
import { BrsError, ErrorDetail, RuntimeErrorDetail } from "../error/BrsError";
import { numberToHex } from "../common";

export class ParseError extends BrsError {
    /**
     * @param token the token where the error occurred
     * @param message a detail appended to the generic syntax error, or a specific compile error whose
     *                own message and code are reported instead
     */
    constructor(token: Token, message: string | ErrorDetail) {
        let m: string;
        if (typeof message === "string") {
            const errorDetail = RuntimeErrorDetail.BadSyntax;
            m = `${errorDetail.message} (compile error &h${numberToHex(errorDetail.errno)}) ${message}`;
            if (token.kind === Lexeme.Eof) {
                m = "(At end of file) " + message;
            }
        } else {
            m = `${message.message} (compile error &h${numberToHex(message.errno)})`;
        }

        super(m, token.location);
    }
}
