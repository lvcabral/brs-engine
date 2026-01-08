import { ValueKind, SignatureAndMismatches, MismatchReason, Callable, BrsType } from "../brsTypes";
import { BrsError, ErrorDetail, RuntimeError, RuntimeErrorDetail } from "../error/BrsError";
import { Location } from "../lexer";

/**
 * Formats a function signature mismatch into a human-readable error message.
 * @param functionName - The name of the function that had mismatched arguments
 * @param mismatchedSignature - Object containing the signature and array of mismatches
 * @returns A formatted multi-line string describing the signature and mismatches
 */
function formatMismatch(functionName: string, mismatchedSignature: SignatureAndMismatches) {
    let sig = mismatchedSignature.signature;
    let mismatches = mismatchedSignature.mismatches;

    let messageParts = [];

    let requiredCount = 0;
    let args = sig.args
        .map((a) => {
            let requiredArg = `${a.name.text} as ${ValueKind.toString(a.type.kind)}`;
            if (a.defaultValue) {
                return `[${requiredArg}]`;
            } else {
                requiredCount++;
                return requiredArg;
            }
        })
        .join(", ");
    messageParts.push(
        `function ${functionName}(${args}) as ${ValueKind.toString(sig.returns)}:`,
        ...mismatches
            .map((mm) => {
                switch (mm.reason) {
                    case MismatchReason.TooFewArguments:
                        return `* ${functionName} requires at least ${requiredCount} argument(s), but received ${mm.received}.`;
                    case MismatchReason.TooManyArguments:
                        return `* ${functionName} accepts at most ${mm.expected} argument(s), but received ${mm.received}.`;
                    case MismatchReason.ArgumentTypeMismatch:
                        return `* Argument '${mm.argName}' must be of type ${mm.expected}, but received ${mm.received}.`;
                }
            })
            .map((line) => `    ${line}`)
    );

    return messageParts.map((line) => `    ${line}`).join("\n");
}

/**
 * Generates a detailed argument mismatch error for a function call.
 * Checks all possible signatures and formats detailed error messages for each mismatch.
 * @param callee - The callable function that was invoked
 * @param args - The arguments that were provided to the function
 * @param location - The source code location where the call occurred
 * @returns A BrsError with detailed information about the argument mismatch
 */
export function generateArgumentMismatchError(callee: Callable, args: BrsType[], location: Location): BrsError {
    let functionName = callee.getName();
    let mismatchedSignatures = callee.getAllSignatureMismatches(args);

    let header;
    let messages;
    if (mismatchedSignatures.length === 1) {
        header = `Provided arguments don't match ${functionName}'s signature.`;
        messages = [formatMismatch(functionName, mismatchedSignatures[0])];
    } else {
        header = `Provided arguments don't match any of ${functionName}'s signatures.`;
        messages = mismatchedSignatures.map(formatMismatch.bind(null, functionName));
    }
    const errDetail: ErrorDetail = {
        message: `${RuntimeErrorDetail.TypeMismatch.message}: ${[header, ...messages].join("\n")}`,
        errno: RuntimeErrorDetail.TypeMismatch.errno,
    };
    return new RuntimeError(errDetail, false, location);
}
