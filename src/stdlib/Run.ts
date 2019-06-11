import * as path from "path";

import * as brs from "../";
import {
    BrsType,
    ValueKind,
    Callable,
    BrsString,
    BrsInvalid,
    StdlibArgument,
    SignatureAndImplementation,
    RoArray,
    isBrsString,
} from "../brsTypes";
import { Interpreter } from "../interpreter";
import { getVolumeByPath, getPath } from "./File";
import { BrsComponent } from "../brsTypes/components/BrsComponent";

/**
 * Runs a file (or set of files) with the provided arguments, returning either the value returned by those files'
 * `main` function or `invalid` if an error occurs.
 *
 * @param interpreter the interpreter hosting this call to `Run`
 * @param filenames a list of files to lex, parse, and run
 * @param args the arguments to pass into the found `main` function
 *
 * @returns the value returned by the executed file(s) if no errors are detected, otherwise `invalid`
 */
function runFiles(interpreter: Interpreter, filenames: BrsString[], args: BrsType[]) {
    let volumes = filenames.map(filename => getVolumeByPath(interpreter, filename.value));
    let pathsToFiles = filenames.map(filename =>
        path.join(interpreter.options.root, getPath(filename.value))
    );

    // if the file-to-run doesn't exist, RBI returns invalid
    if (!volumes.every(volume => volume != null)) {
        return BrsInvalid.Instance;
    }

    try {
        let results = brs.executeSync(pathsToFiles, interpreter.options, args);
        return results[0] || BrsInvalid.Instance;
    } catch (err) {
        // swallow errors and just return invalid; RBI returns invalid for "file doesn't exist" errors,
        // syntax errors, etc.
        return BrsInvalid.Instance;
    }
}

/**
 * Creates several copies of the provided signature and implementation pair, simulating variadic types by creating a
 * function that accepts zero args, one that accepts one arg, one that accepts two args, (…).
 *
 * @param signatureAndImpl the base signature and implementation to make variadic
 *
 * @returns an array containing psuedo-variadic versions of the provided signature and implementation
 */
function variadic(signatureAndImpl: SignatureAndImplementation): SignatureAndImplementation[] {
    let { signature, impl } = signatureAndImpl;
    return [
        signatureAndImpl,
        ...new Array(10).fill(0).map((_, numArgs) => {
            return {
                signature: {
                    args: [
                        ...signature.args,
                        ...new Array(numArgs)
                            .fill(0)
                            .map((_, i) => new StdlibArgument(`arg${i}`, ValueKind.Dynamic)),
                    ],
                    returns: signature.returns,
                },
                impl: impl,
            };
        }),
    ];
}

export const Run = new Callable(
    "Run",
    ...variadic({
        signature: {
            args: [new StdlibArgument("filename", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, filename: BrsString, ...args: BrsType[]) => {
            return runFiles(interpreter, [filename], args);
        },
    }),
    ...variadic({
        signature: {
            args: [new StdlibArgument("filenamearray", ValueKind.Object)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, filenamearray: BrsComponent, ...args: BrsType[]) => {
            if (
                filenamearray instanceof RoArray &&
                filenamearray.getElements().every(isBrsString)
            ) {
                return runFiles(interpreter, filenamearray.getElements() as BrsString[], args);
            }

            // RBI seems to hard-reboot when passed a non-empty associative array, but returns invalid for empty
            // AA's. Let's return invalid to be safe.
            return BrsInvalid.Instance;
        },
    })
);
