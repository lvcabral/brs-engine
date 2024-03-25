import * as path from "path";
import * as brs from "../";

import {
    Callable,
    StdlibArgument,
    ValueKind,
    BrsString,
    BrsInvalid,
    BrsType,
    RoArray,
    isBrsString,
} from "../brsTypes";
import { BrsComponent } from "../brsTypes/components/BrsComponent";
import { Interpreter } from "../interpreter";
import { getVolumeByPath, getPath } from "../stdlib/File";
import { Scope } from "../interpreter/Environment";

/**
 * Runs a file (or set of files) **in the current global + module scope** with the provided arguments, returning either
 * the value returned by those files' `main` function or `invalid` if an error occurs.
 *
 * @param interpreter the interpreter hosting this call to `Run`
 * @param filenames a list of files to lex, parse, and run
 * @param args the arguments to pass into the found `main` function
 *
 * @returns the value returned by the executed file(s) if no errors are detected, otherwise `invalid`
 */
function runFilesInScope(interpreter: Interpreter, filenames: BrsString[], args: BrsType[]) {
    let volumes = filenames.map((filename) => getVolumeByPath(interpreter, filename.value));
    let posixRoot = interpreter.options.root.replace(/[\/\\]+/g, path.posix.sep);
    let pathsToFiles = filenames.map((filename) => path.join(posixRoot, getPath(filename.value)));

    // if the file-to-run doesn't exist, RBI returns invalid
    if (!volumes.every((volume) => volume != null)) {
        return BrsInvalid.Instance;
    }

    let ast = brs.lexParseSync(pathsToFiles, interpreter.options);
    return interpreter.inSubEnv((subInterpreter) => {
        // remove the original `main` function so we can execute the new file
        subInterpreter.environment.remove("main", Scope.Module);
        return subInterpreter.exec(ast, ...args)[0] || BrsInvalid.Instance;
    });
}

export const RunInScope = new Callable(
    "RunInScope",
    ...Callable.variadic({
        signature: {
            args: [new StdlibArgument("filename", ValueKind.String)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, filename: BrsString, ...args: BrsType[]) => {
            return runFilesInScope(interpreter, [filename], args);
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
                return runFilesInScope(
                    interpreter,
                    filenamearray.getElements() as BrsString[],
                    args
                );
            }

            // RBI seems to hard-reboot when passed a non-empty associative array, but returns invalid for empty
            // AA's. Let's return invalid to be safe.
            return BrsInvalid.Instance;
        },
    })
);
