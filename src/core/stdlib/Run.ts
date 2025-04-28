import * as brs from "..";
import {
    BrsType,
    BrsComponent,
    ValueKind,
    Callable,
    BrsString,
    BrsInvalid,
    StdlibArgument,
    RoArray,
    isBrsString,
} from "../brsTypes";
import { BrsDevice } from "../device/BrsDevice";
import { Interpreter } from "../interpreter";

/**
 * Runs a file (or set of files) with the provided arguments, returning either the value returned by those files'
 * `main` function or `invalid` if an error occurs.
 * @param interpreter the interpreter hosting this call to `Run`
 * @param filenames a list of files to lex, parse, and run
 * @param args the arguments to pass into the found `main` function
 *
 * @returns the value returned by the executed file(s) if no errors are detected, otherwise `invalid`
 */
function runFiles(interpreter: Interpreter, filenames: BrsString[], args: BrsType[]) {
    try {
        // execute the new files in a brand-new interpreter, as no scope is shared with the `Run`-ed files in RBI
        const sandbox = new Interpreter(interpreter.options);
        interpreter.manifest.forEach((value, key) => {
            sandbox.manifest.set(key, value);
        });
        const sourceMap = new Map<string, string>();
        filenames.forEach((filename) => {
            if (BrsDevice.fileSystem.existsSync(filename.value)) {
                sourceMap.set(filename.value, BrsDevice.fileSystem.readFileSync(filename.value, "utf8"));
            }
        });
        if (sourceMap.size !== 0) {
            const parseResult = brs.lexParseSync(BrsDevice.fileSystem, sandbox.manifest, sourceMap);
            const result = sandbox.exec(parseResult.statements, sourceMap, ...args);
            return result[0] || BrsInvalid.Instance;
        }
    } catch (err: any) {
        // swallow errors and just return invalid; RBI returns invalid for "file doesn't exist" errors,
        // syntax errors, etc.
    }
    return BrsInvalid.Instance;
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
            args: [new StdlibArgument("filenameArray", ValueKind.Object)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, filenameArray: BrsComponent, ...args: BrsType[]) => {
            if (filenameArray instanceof RoArray && filenameArray.getElements().every(isBrsString)) {
                return runFiles(interpreter, filenameArray.getElements() as BrsString[], args);
            }

            // RBI seems to hard-reboot when passed a non-empty associative array, but returns invalid for empty
            // AA's. Let's return invalid to be safe.
            return BrsInvalid.Instance;
        },
    })
);
