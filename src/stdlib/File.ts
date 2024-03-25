import { Callable, ValueKind, BrsString, BrsBoolean, RoArray, StdlibArgument } from "../brsTypes";
import { Interpreter } from "../interpreter";
import { URL } from "url";
import MemoryFileSystem from "memory-fs";
import * as nanomatch from "nanomatch";

import * as fs from "fs";
import * as path from "path";

type Volume = MemoryFileSystem | typeof fs;

/*
 * Returns a memfs volume based on the brs path uri.  For example, passing in
 * "tmp:/test.txt" will return the memfs temporary volume on the interpreter.
 *
 * Returns invalid in no appopriate volume is found for the path
 */
export function getVolumeByPath(interpreter: Interpreter, path: string): Volume | null {
    try {
        const protocol = new URL(path).protocol;
        if (protocol === "tmp:") {
            return interpreter.temporaryVolume;
        }
        if (protocol === "pkg:") {
            return fs;
        }
    } catch (err) {
        return null;
    }
    return null;
}

/*
 * Returns a memfs file path from a brs file uri
 *   ex. "tmp:/test/test1.txt" -> "/test/test1.txt"
 */
export function getPath(fileUri: string) {
    return new URL(fileUri).pathname;
}

/*
 * Returns a memfs file path from a brs file uri. If the brs file uri
 * has the "pkg" protocol, append the file path with our root directory
 * so that we're searching the correct place.
 *   ex. "tmp:/test/test1.txt" -> "/test/test1.txt"
 *   ex. "pkg:/test/test1.txt" -> "/path/to/proj/test/test1.txt"
 *
 */
export function getScopedPath(interpreter: Interpreter, fileUri: string) {
    let url = new URL(fileUri);
    let filePath = getPath(fileUri);
    let scopedPath = filePath;
    if (url.protocol === "pkg:") {
        scopedPath = path.join(interpreter.options.root, filePath);
    }
    return scopedPath.replace(/[\/\\]+/g, path.posix.sep);
}

/** Copies a file from src to dst, return true if successful */
export const CopyFile = new Callable("CopyFile", {
    signature: {
        args: [
            new StdlibArgument("source", ValueKind.String),
            new StdlibArgument("destination", ValueKind.String),
        ],
        returns: ValueKind.Boolean,
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

        const srcMemfsPath = getScopedPath(interpreter, src.value);
        const dstMemfsPath = getScopedPath(interpreter, dst.value);
        try {
            let contents = srcVolume.readFileSync(srcMemfsPath);
            dstVolume.writeFileSync(dstMemfsPath, contents);
            return BrsBoolean.True;
        } catch (err) {
            return BrsBoolean.False;
        }
    },
});

/** Copies a file from src to dst, return true if successful */
export const MoveFile = new Callable("MoveFile", {
    signature: {
        args: [
            new StdlibArgument("source", ValueKind.String),
            new StdlibArgument("destination", ValueKind.String),
        ],
        returns: ValueKind.Boolean,
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

        const srcMemfsPath = getScopedPath(interpreter, src.value);
        const dstMemfsPath = getScopedPath(interpreter, dst.value);
        try {
            let contents = srcVolume.readFileSync(srcMemfsPath);
            dstVolume.writeFileSync(dstMemfsPath, contents);
            srcVolume.unlinkSync(srcMemfsPath);
            return BrsBoolean.True;
        } catch (err) {
            return BrsBoolean.False;
        }
    },
});

/** Deletes a file, return true if successful */
export const DeleteFile = new Callable("DeleteFile", {
    signature: {
        args: [new StdlibArgument("file", ValueKind.String)],
        returns: ValueKind.Boolean,
    },
    impl: (interpreter: Interpreter, file: BrsString) => {
        const volume = getVolumeByPath(interpreter, file.value);
        if (volume === null) {
            return BrsBoolean.False;
        }

        const memfsPath = getScopedPath(interpreter, file.value);
        try {
            volume.unlinkSync(memfsPath);
            return BrsBoolean.True;
        } catch (err) {
            return BrsBoolean.False;
        }
    },
});

/** Deletes a directory (if empty), return true if successful */
export const DeleteDirectory = new Callable("DeleteDirectory", {
    signature: {
        args: [new StdlibArgument("dir", ValueKind.String)],
        returns: ValueKind.Boolean,
    },
    impl: (interpreter: Interpreter, dir: BrsString) => {
        const volume = getVolumeByPath(interpreter, dir.value);
        if (volume === null) {
            return BrsBoolean.False;
        }

        const memfsPath = getScopedPath(interpreter, dir.value);
        try {
            volume.rmdirSync(memfsPath);
            return BrsBoolean.True;
        } catch (err) {
            return BrsBoolean.False;
        }
    },
});

/** Creates a directory, return true if successful */
export const CreateDirectory = new Callable("CreateDirectory", {
    signature: {
        args: [new StdlibArgument("dir", ValueKind.String)],
        returns: ValueKind.Boolean,
    },
    impl: (interpreter: Interpreter, dir: BrsString) => {
        const volume = getVolumeByPath(interpreter, dir.value);
        if (volume === null) {
            return BrsBoolean.False;
        }

        const memfsPath = getScopedPath(interpreter, dir.value);
        try {
            volume.mkdirSync(memfsPath);
            return BrsBoolean.True;
        } catch (err) {
            return BrsBoolean.False;
        }
    },
});

/** Stubbed function for formatting a drive; always returns false */
export const FormatDrive = new Callable("FormatDrive", {
    signature: {
        args: [
            new StdlibArgument("drive", ValueKind.String),
            new StdlibArgument("fs_type", ValueKind.String),
        ],
        returns: ValueKind.Boolean,
    },
    impl: (interpreter: Interpreter, dir: BrsString) => {
        if (process.env.NODE_ENV !== "test") {
            console.error("`FormatDrive` is not implemented in `brs`.");
        }
        return BrsBoolean.False;
    },
});

/** Returns an array of paths in a directory */
export const ListDir = new Callable("ListDir", {
    signature: {
        args: [new StdlibArgument("path", ValueKind.String)],
        returns: ValueKind.Object,
    },
    impl: (interpreter: Interpreter, pathArg: BrsString) => {
        const volume = getVolumeByPath(interpreter, pathArg.value);
        if (volume === null) {
            return new RoArray([]);
        }

        let localPath = getScopedPath(interpreter, pathArg.value);
        try {
            let subPaths = volume.readdirSync(localPath).map((s) => new BrsString(s));
            return new RoArray(subPaths);
        } catch (err) {
            return new RoArray([]);
        }
    },
});

/** Reads ascii file from file system. */
export const ReadAsciiFile = new Callable("ReadAsciiFile", {
    signature: {
        args: [new StdlibArgument("filepath", ValueKind.String)],
        returns: ValueKind.String,
    },
    impl: (interpreter: Interpreter, filepath: BrsString, text: BrsString) => {
        const volume = getVolumeByPath(interpreter, filepath.value);
        if (volume === null) {
            return new BrsString("");
        }

        const memfsPath = getScopedPath(interpreter, filepath.value);
        return new BrsString(volume.readFileSync(memfsPath).toString());
    },
});

/** Writes a string to a temporary file. */
export const WriteAsciiFile = new Callable("WriteAsciiFile", {
    signature: {
        args: [
            new StdlibArgument("filepath", ValueKind.String),
            new StdlibArgument("text", ValueKind.String),
        ],
        returns: ValueKind.Boolean,
    },
    impl: (interpreter: Interpreter, filepath: BrsString, text: BrsString) => {
        const volume = getVolumeByPath(interpreter, filepath.value);
        if (volume === null) {
            return BrsBoolean.False;
        }

        const memfsPath = getScopedPath(interpreter, filepath.value);
        volume.writeFileSync(memfsPath, text.value);
        return BrsBoolean.True;
    },
});

/** Searches a directory for filenames that match a certain pattern. */
export const MatchFiles = new Callable("MatchFiles", {
    signature: {
        args: [
            new StdlibArgument("path", ValueKind.String),
            new StdlibArgument("pattern_in", ValueKind.String),
        ],
        returns: ValueKind.Object,
    },
    impl: (interpreter: Interpreter, pathArg: BrsString, patternIn: BrsString) => {
        let volume = getVolumeByPath(interpreter, pathArg.value);
        if (volume == null) {
            // TODO: replace with RoList when that's implemented
            return new RoArray([]);
        }

        let localPath = getScopedPath(interpreter, pathArg.value);
        try {
            let knownFiles = fs.readdirSync(localPath, "utf8");
            let matchedFiles = nanomatch.match(knownFiles, patternIn.value, {
                nocase: true,
                nodupes: true,
                noglobstar: true,
                nonegate: true,
            });

            matchedFiles = (matchedFiles || []).map((match: string) => new BrsString(match));

            // TODO: replace with RoList when that's implemented
            return new RoArray(matchedFiles);
        } catch (err) {
            // TODO: replace with RoList when that's implemented
            return new RoArray([]);
        }
    },
});
