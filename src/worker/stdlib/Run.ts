import * as path from "path";

import * as brs from "../";
import {
    BrsType,
    ValueKind,
    Callable,
    BrsString,
    BrsInvalid,
    StdlibArgument,
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
    let volumes = filenames.map((filename) => getVolumeByPath(interpreter, filename.value));
    let pathsToFiles = filenames.map((filename) =>
        path.join(interpreter.options.root, getPath(filename.value))
    );

    // if the file-to-run doesn't exist, RBI returns invalid
    if (!volumes.every((volume) => volume != null)) {
        return BrsInvalid.Instance;
    }

    try {
        let ast = brs.lexParseSync(interpreter, pathsToFiles);
        // execute the new files in a brand-new interpreter, as no scope is shared with the `Run`-ed files in RBI
        let sandbox = new Interpreter(interpreter.options);
        return sandbox.exec(ast, ...args)[0] || BrsInvalid.Instance;
    } catch (err: any) {
        // swallow errors and just return invalid; RBI returns invalid for "file doesn't exist" errors,
        // syntax errors, etc.
        return BrsInvalid.Instance;
    }
}

export const Run = new Callable(
    "Run",
    ...Callable.variadic({
        signature: {
            args: [new StdlibArgument("filename", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, filename: BrsString, ...args: BrsType[]) => {
            return runFiles(interpreter, [filename], args);
        },
    }),
    ...Callable.variadic({
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
