import { Callable, ValueKind, BrsString, BrsBoolean } from "../brsTypes";
import { Interpreter } from "../interpreter";
import { Volume } from "memfs/lib/volume";
import { URL } from "url";


/*
 * Returns a memfs volume based on the brs path uri.  For example, passing in
 * "tmp:///test.txt" will return the memfs temporary volume on the interpreter. 
 * 
 * Returns invalid in no appopriate volume is found for the path
 */
export function getVolumeByPath(interpreter: Interpreter, path: string): Volume | null {
    try {
        const protocol = new URL(path).protocol;
        if (protocol === "tmp:") return interpreter.temporaryVolume;
    } catch (err) {
        return null;
    }
    return null;
}

/*
 * Returns a memfs file path from a brs file uri 
 *   ex. "tmp:///test/test1.txt" -> "/test/test1.txt"
 */
export function getMemfsPath(fileUri: string) {
    return new URL(fileUri).pathname;
}

/** Reads ascii file from file system. */
export const ReadAsciiFile = new Callable(
    "ReadAsciiFile",
    {
        signature: {
            args: [
                {name: "filepath", type: ValueKind.String}
            ],
            returns: ValueKind.String
        },
        impl: (interpreter: Interpreter, filepath: BrsString, text: BrsString) => {
            const volume = getVolumeByPath(interpreter, filepath.value);
            if (volume === null) {
                return new BrsString("");
            }

            const memfsPath = getMemfsPath(filepath.value);
            return new BrsString(volume.readFileSync(memfsPath).toString());
        }
    }
);

/** Writes a string to a temporary file. */
export const WriteAsciiFile = new Callable(
    "WriteAsciiFile",
    {
        signature: {
            args: [
                {name: "filepath", type: ValueKind.String},
                {name: "text", type: ValueKind.String}
            ],
            returns: ValueKind.Boolean
        },
        impl: (interpreter: Interpreter, filepath: BrsString, text: BrsString) => {
            const volume = getVolumeByPath(interpreter, filepath.value);
            if (volume === null) {
                return BrsBoolean.False;
            }

            const memfsPath = getMemfsPath(filepath.value);
            volume.writeFileSync(memfsPath, text.value);
            return BrsBoolean.True;
        }
    }
);

