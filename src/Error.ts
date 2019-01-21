import { BrsType, ValueKind } from "./brsTypes";

let foundError = false;

export function make(message: string, line: number, file?: string) {
    foundError = true;
    let location = file ? `${file}: ${line}` : `Line ${line}`;
    let error = new Error(`[${location}] ${message}`);
    if (process.env.NODE_ENV !== "test") {
        console.error(error.message);
    }
    return error;
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
export function typeMismatch(mismatchMetadata: TypeMismatchMetadata) {
    let messageLines = [
        mismatchMetadata.message,
        `    left: ${ValueKind.toString(mismatchMetadata.left.kind)}`
    ];

    if (mismatchMetadata.right) {
        messageLines.push(
        `    right: ${ValueKind.toString(mismatchMetadata.right.kind)}`
        );
    }

    return make(
        messageLines.join("\n"),
        mismatchMetadata.line,
        mismatchMetadata.file
    );
}

export function found() {
    return foundError;
}

export function reset() {
    foundError = false;
}
