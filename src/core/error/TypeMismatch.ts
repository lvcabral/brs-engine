import { BrsType, ValueKind } from "../brsTypes";
import { RuntimeError, RuntimeErrorDetail } from "../error/BrsError";
import type { Location } from "../lexer";

/**
 * Metadata describing a type mismatch error.
 * Used to construct detailed error messages with type and location information.
 */
export interface TypeMismatchMetadata {
    /**
     * The base message to use for this error. Should be as helpful as possible, e.g.
     * "Attempting to subtract non-numeric values".
     */
    message: string;
    /** The value on the left-hand side of a binary operator, or the *only* value for a unary operator. */
    left: TypeAndLocation;
    /** The value on the right-hand side of a binary operator. */
    right?: TypeAndLocation;
    cast?: boolean;
}

/**
 * Combines a BrightScript type with its source code location.
 * Used for tracking where type mismatches occur.
 */
export type TypeAndLocation = {
    /** The type of a value involved in a type mismatch. */
    type: BrsType | ValueKind;
    /** The location at which the offending value was resolved. */
    location: Location;
};

/**
 * Runtime error for type mismatches in operations or assignments.
 * Automatically formats error messages with the involved types.
 * Handles both binary operations (left/right) and unary operations or casts.
 */
export class TypeMismatch extends RuntimeError {
    /**
     * Creates a TypeMismatch error with formatted type information.
     * @param mismatchMetadata - Object containing message, types, locations, and cast flag
     */

    constructor(mismatchMetadata: TypeMismatchMetadata) {
        const errDetail = RuntimeErrorDetail.TypeMismatch;
        let errMessage = `${errDetail.message} ${mismatchMetadata.message} `;
        if (!mismatchMetadata.cast) {
            errMessage += `"${ValueKind.toString(getKind(mismatchMetadata.left.type))}"`;
            if (mismatchMetadata.right) {
                errMessage += ` and "${ValueKind.toString(getKind(mismatchMetadata.right.type))}"`;
            }
        } else if (mismatchMetadata.right) {
            errMessage += `"${ValueKind.toString(getKind(mismatchMetadata.right.type))}"`;
            errMessage += ` to "${ValueKind.toString(getKind(mismatchMetadata.left.type))}"`;
        }
        errMessage += ".";
        super({ errno: errDetail.errno, message: errMessage }, mismatchMetadata.left.location);
    }
}

/**
 * Returns the `.kind` property of a `BrsType`, otherwise returns the provided `ValueKind`.
 * @param maybeType the `BrsType` to extract a `.kind` field from, or the `ValueKind` to return directly
 * @returns the `ValueKind` for `maybeType`
 */
function getKind(maybeType: BrsType | ValueKind): ValueKind {
    if (typeof maybeType === "number") {
        return maybeType;
    } else {
        return maybeType.kind;
    }
}
