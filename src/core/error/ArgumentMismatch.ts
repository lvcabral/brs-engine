import { ValueKind, SignatureAndMismatches, MismatchReason, Callable, BrsType } from "../brsTypes";
import { BrsError, ErrorDetail, RuntimeError, RuntimeErrorDetail } from "../error/BrsError";
import { Location } from "../lexer";

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
    messageParts.push(`function ${functionName}(${args}) as ${ValueKind.toString(sig.returns)}:`);
    messageParts.push(
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
    return new RuntimeError(errDetail, location);
}
