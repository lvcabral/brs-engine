import { Callable, ValueKind, BrsString, BrsBoolean, StdlibArgument, RoList } from "../brsTypes";
import { Interpreter } from "../interpreter";
import MemoryFileSystem from "memory-fs";
import URL from "url-parse";
import * as nanomatch from "nanomatch";

type Volume = MemoryFileSystem;

/*
 * Returns a memfs volume based on the brs path uri.  For example, passing in
 * "tmp:/test.txt" will return the memfs temporary volume on the interpreter.
 *
 * Returns invalid in no appopriate volume is found for the path
 */
export function getVolumeByPath(interpreter: Interpreter, path: string): Volume | null {
    try {
        const protocol = new URL(path).protocol;
        const volume = interpreter.fileSystem.get(protocol);
        if (volume) {
            return volume;
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

export function createDir(interpreter: Interpreter, dir: string) {
    const volume = getVolumeByPath(interpreter, dir);
    if (volume === null) {
        return BrsBoolean.False;
    }
    const memfsPath = getPath(dir);
    try {
        volume.mkdirSync(memfsPath);
        return BrsBoolean.True;
    } catch (err) {
        return BrsBoolean.False;
    }
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

        const srcMemfsPath = getPath(src.value);
        const dstMemfsPath = getPath(dst.value);
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

        const srcMemfsPath = getPath(src.value);
        const dstMemfsPath = getPath(dst.value);
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

        const memfsPath = getPath(file.value);
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

        const memfsPath = getPath(dir.value);
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
        return createDir(interpreter, dir.value);
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
    impl: (interpreter: Interpreter, path: BrsString) => {
        const volume = getVolumeByPath(interpreter, path.value);
        if (volume === null) {
            return new RoList([]);
        }

        const memfsPath = getPath(path.value);
        try {
            let subPaths = volume.readdirSync(memfsPath).map(s => new BrsString(s));
            return new RoList(subPaths);
        } catch (err) {
            return new RoList([]);
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
        if (volume) {
            const memfsPath = getPath(filepath.value);
            return new BrsString(volume.readFileSync(memfsPath).toString());
        }
        return new BrsString("");
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
    impl: (interpreter: Interpreter, filePath: BrsString, text: BrsString) => {
        const volume = getVolumeByPath(interpreter, filePath.value);
        if (volume === null) {
            return BrsBoolean.False;
        }
        const memfsPath = getPath(filePath.value);
        try {
            volume.writeFileSync(memfsPath, text.value, "utf-8");
            return BrsBoolean.True;
        } catch (err) {
            return BrsBoolean.False;
        }
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
            return new RoList([]);
        }
        let localPath = getPath(pathArg.value);
        try {
            let knownFiles = volume.readdirSync(localPath);
            let matchedFiles = nanomatch.match(knownFiles, patternIn.value, {
                nocase: true,
                nodupes: true,
                noglobstar: true,
                nonegate: true,
            });

            matchedFiles = (matchedFiles || []).map((match: string) => new BrsString(match));

            return new RoList(matchedFiles);
        } catch (err) {
            return new RoList([]);
        }
    },
});
