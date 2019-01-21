import { BrsType, ValueKind } from "./brsTypes";

export class BrsError extends Error {
    constructor(message: string, line: number, file?: string) {
        let location = file ? `${file}: ${line}` : `Line ${line}`;
        let output = `[${location}] ${message}`;
        super(output);
    }
}

/** Wraps up the metadata associated with a type mismatch error. */
export interface TypeMismatchMetadata {
    /**
     * The base message to use for this error. Should be as helpful as possible, e.g.
     * "Attempting to subtract non-numeric values".
     */
    message: string,
    /** The line number on which the error occured. */
    line: number,
    /** The value on the left-hand side of a binary operator, or the *only* value for a unary operator. */
    left: BrsType,
    /** The value on the right-hand side of a binary operator. */
    right?: BrsType,
    /** The file in which the error occurred. */
    file?: string
}

/**
 * Creates a "type mismatch"-like error message, but with the appropriate types specified.
 * @return a type mismatch error that will be tracked by this module.
 */
export class TypeMismatch extends BrsError {
    constructor(mismatchMetadata: TypeMismatchMetadata) {
        let messageLines = [
            mismatchMetadata.message,
            `    left: ${ValueKind.toString(mismatchMetadata.left.kind)}`
        ];

        if (mismatchMetadata.right) {
            messageLines.push(
            `    right: ${ValueKind.toString(mismatchMetadata.right.kind)}`
            );
        }

        super(
            messageLines.join("\n"),
            mismatchMetadata.line,
            mismatchMetadata.file
        );
    }
}