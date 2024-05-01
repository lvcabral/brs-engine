import { BrsType, ValueKind } from "../brsTypes";
import { RuntimeError, RuntimeErrorCode } from "../Error";
import type { Location } from "../lexer";

/** Wraps up the metadata associated with a type mismatch error. */
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

export type TypeAndLocation = {
    /** The type of a value involved in a type mismatch. */
    type: BrsType | ValueKind;
    /** The location at which the offending value was resolved. */
    location: Location;
};

/**
 * Creates a "type mismatch"-like error message, but with the appropriate types specified.
 * @return a type mismatch error that will be tracked by this module.
 */
export class TypeMismatch extends RuntimeError {
    constructor(mismatchMetadata: TypeMismatchMetadata) {
        const errCode = RuntimeErrorCode.TypeMismatch;
        let errMessage = `${errCode.message} ${mismatchMetadata.message} `;
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
        super({ errno: errCode.errno, message: errMessage }, mismatchMetadata.left.location);
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
