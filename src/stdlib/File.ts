import { Callable, ValueKind, BrsString, BrsBoolean, BrsArray, StdlibArgument } from "../brsTypes";
import { Interpreter } from "../interpreter";
import { URL } from "url";
import MemoryFileSystem from "memory-fs";

/*
 * Returns a memfs volume based on the brs path uri.  For example, passing in
 * "tmp:///test.txt" will return the memfs temporary volume on the interpreter.
 *
 * Returns invalid in no appopriate volume is found for the path
 */
export function getVolumeByPath(interpreter: Interpreter, path: string): MemoryFileSystem | null {
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

/** Copies a file from src to dst, return true if successful */
export const CopyFile = new Callable(
    "CopyFile",
    {
        signature: {
            args: [
                new StdlibArgument("source", ValueKind.String),
                new StdlibArgument("destination", ValueKind.String)
            ],
            returns: ValueKind.Boolean
        },
        impl: (interpreter: Interpreter, src: BrsString, dst: BrsString) => {
            const srcVolume = getVolumeByPath(interpreter, src.value);
            if (srcVolume === null) {
                return BrsBoolean.False;
            }
            const dstVolume = getVolumeByPath(interpreter, dst.value);
            if (dstVolume === null) {
                return BrsBoolean.False;
            }

            const srcMemfsPath = getMemfsPath(src.value);
            const dstMemfsPath = getMemfsPath(dst.value);
            try {
                let contents = srcVolume.readFileSync(srcMemfsPath);
                dstVolume.writeFileSync(dstMemfsPath, contents);
                return BrsBoolean.True;
            } catch (err) {
                return BrsBoolean.False;
            }
        }
    }
);

/** Copies a file from src to dst, return true if successful */
export const MoveFile = new Callable(
    "MoveFile",
    {
        signature: {
            args: [
                new StdlibArgument("source", ValueKind.String),
                new StdlibArgument("destination", ValueKind.String),
            ],
            returns: ValueKind.Boolean
        },
        impl: (interpreter: Interpreter, src: BrsString, dst: BrsString) => {
            const srcVolume = getVolumeByPath(interpreter, src.value);
            if (srcVolume === null) {
                return BrsBoolean.False;
            }
            const dstVolume = getVolumeByPath(interpreter, dst.value);
            if (dstVolume === null) {
                return BrsBoolean.False;
            }

            const srcMemfsPath = getMemfsPath(src.value);
            const dstMemfsPath = getMemfsPath(dst.value);
            try {
                let contents = srcVolume.readFileSync(srcMemfsPath);
                dstVolume.writeFileSync(dstMemfsPath, contents);
                srcVolume.unlinkSync(srcMemfsPath);
                return BrsBoolean.True;
            } catch (err) {
                return BrsBoolean.False;
            }
        }
    }
);

/** Deletes a file, return true if successful */
export const DeleteFile = new Callable(
    "DeleteFile",
    {
        signature: {
            args: [
                new StdlibArgument("file", ValueKind.String)
            ],
            returns: ValueKind.Boolean
        },
        impl: (interpreter: Interpreter, file: BrsString) => {
            const volume = getVolumeByPath(interpreter, file.value);
            if (volume === null) {
                return BrsBoolean.False;
            }

            const memfsPath = getMemfsPath(file.value);
            try {
                volume.unlinkSync(memfsPath);
                return BrsBoolean.True;
            } catch (err) {
                return BrsBoolean.False;
            }
        }
    }
);

/** Deletes a directory (if empty), return true if successful */
export const DeleteDirectory = new Callable(
    "DeleteDirectory",
    {
        signature: {
            args: [
                new StdlibArgument("dir", ValueKind.String)
            ],
            returns: ValueKind.Boolean
        },
        impl: (interpreter: Interpreter, dir: BrsString) => {
            const volume = getVolumeByPath(interpreter, dir.value);
            if (volume === null) {
                return BrsBoolean.False;
            }

            const memfsPath = getMemfsPath(dir.value);
            try {
                volume.rmdirSync(memfsPath);
                return BrsBoolean.True;
            } catch (err) {
                return BrsBoolean.False;
            }
        }
    }
);

/** Creates a directory, return true if successful */
export const CreateDirectory = new Callable(
    "CreateDirectory",
    {
        signature: {
            args: [
                new StdlibArgument("dir", ValueKind.String)
            ],
            returns: ValueKind.Boolean
        },
        impl: (interpreter: Interpreter, dir: BrsString) => {
            const volume = getVolumeByPath(interpreter, dir.value);
            if (volume === null) {
                return BrsBoolean.False;
            }

            const memfsPath = getMemfsPath(dir.value);
            try {
                volume.mkdirSync(memfsPath);
                return BrsBoolean.True;
            } catch (err) {
                return BrsBoolean.False;
            }
        }
    }
);

/** Stubbed function for formatting a drive; always returns false */
export const FormatDrive = new Callable(
    "FormatDrive",
    {
        signature: {
            args: [
                new StdlibArgument("drive", ValueKind.String),
                new StdlibArgument("fs_type", ValueKind.String)
            ],
            returns: ValueKind.Boolean
        },
        impl: (interpreter: Interpreter, dir: BrsString) => {
            if (process.env.NODE_ENV !== "test") {
                console.error("`FormatDrive` is not implemented in `brs`.");
            }
            return BrsBoolean.False;
        }
    }
);

/** Returns an array of paths in a directory */
export const ListDir = new Callable(
    "ListDir",
    {
        signature: {
            args: [
                new StdlibArgument("path", ValueKind.String)
            ],
            returns: ValueKind.Object
        },
        impl: (interpreter: Interpreter, path: BrsString) => {
            const volume = getVolumeByPath(interpreter, path.value);
            if (volume === null) {
                return new BrsArray([]);
            }

            const memfsPath = getMemfsPath(path.value);
            try {
                let subPaths = volume.readdirSync(memfsPath).map((s) => new BrsString(s));
                return new BrsArray(subPaths);
            } catch (err) {
                return new BrsArray([]);
            }
        }
    }
);

/** Reads ascii file from file system. */
export const ReadAsciiFile = new Callable(
    "ReadAsciiFile",
    {
        signature: {
            args: [
                new StdlibArgument("filepath", ValueKind.String)
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
                new StdlibArgument("filepath", ValueKind.String),
                new StdlibArgument("text", ValueKind.String)
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

