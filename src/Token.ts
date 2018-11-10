import Long from "long";
import { Lexeme } from "./Lexeme";
import { BrsType } from "./brsTypes";

/**
 * Represents a chunk of BrightScript scanned by the lexer.
 */
export interface Token {
    /** The type of token this represents. */
    kind: Lexeme;
    /** The text found in the original BrightScript source, if any. */
    text?: string;
    /** The literal value (using the BRS type system) associated with this token, if any. */
    literal?: BrsType;
    /** The line on which this token was found. */
    line: number;
}