import { Lexeme } from "./Lexeme";
import { BrsType } from "../brsTypes";

/**
 * Represents a chunk of BrightScript scanned by the lexer.
 */
export interface Token {
    /** The type of token this represents. */
    kind: Lexeme;
    /** The text found in the original BrightScript source, if any. */
    text: string;
    /** True if this token's `text` is a reserved word, otherwise `false`. */
    isReserved: boolean;
    /** The literal value (using the BRS type system) associated with this token, if any. */
    literal?: BrsType;
    /** The starting and ending line/column pairs where the token was found. */
    location: Location;
}

/** Represents a BrightScript comment scanned by the lexer. */
export interface Comment {
    /** The type of comment (block or line) this node represents. */
    type: "Block" | "Line";
    /** The text that started this comment - one of `("'" | "rem" | "REM")`, or any other capitalization. */
    starter: string;
    /** The text found in this comment (excludes the `starter`). */
    value: string;
    /** The starting and ending line/column pairs where the comment was found. */
    loc: Location;
    /** The starting and ending byte offsets in `loc.file` where the comment was found. */
    range: [number, number];
}

/** Represents the location at which a `Token` was found. */
export interface Location {
    /** The line and column at which this token began. */
    start: LineAndColumn;
    /**
     * The line and column at which this token ended.
     * *NOTE*: The ending column follows the one-past-last convention, to allow direct use with
     * `String.prototype.substring` and similar.
     * @example
     * // For input `foo = 1 + 2`
     * // (columns): 0   4   8
     *
     * foo.location.end === { line: 1, column: 3 };
     */
    end: LineAndColumn;
    /** The name of the file in which this token was found. */
    file: string;
}

export namespace Location {
    export function equalTo(loc1: Location, loc2: Location) {
        return (
            loc1.file === loc2.file &&
            loc1.start.line === loc2.start.line &&
            loc1.start.column === loc2.start.column &&
            loc1.end.line === loc2.end.line &&
            loc1.end.column === loc2.end.column
        );
    }
}

/** A line-column pair. */
type LineAndColumn = {
    /** A *one-indexed* line number. */
    line: number;
    /** A *zero-indexed* column number. */
    column: number;
};

/** Represents an identifier as scanned by the lexer. */
export interface Identifier extends Token {
    kind: Lexeme.Identifier;
}

/**
 * Determines whether or not `obj` is a `Token`.
 * @param obj the object to check for `Token`-ness
 * @returns `true` if `obj` is a `Token`, otherwise `false`
 */
export function isToken(obj: Record<string, any>): obj is Token {
    return !!(obj.kind && obj.text && obj.location);
}
