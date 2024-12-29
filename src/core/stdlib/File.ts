import { Callable, ValueKind, BrsString, BrsBoolean, StdlibArgument, RoList } from "../brsTypes";
import { Interpreter } from "../interpreter";
import { getVolume, validUri, writeUri } from "../interpreter/FileSystem";
import * as nanomatch from "nanomatch";

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
        const fsys = interpreter.fileSystem;
        try {
            if (!writeUri(dst.value) || !fsys.existsSync(src.value)) {
                return BrsBoolean.False;
            }
            const content = fsys.readFileSync(src.value);
            fsys.writeFileSync(dst.value, content);
            return BrsBoolean.True;
        } catch (err: any) {
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
        const fsys = interpreter.fileSystem;
        try {
            if (
                !writeUri(src.value) ||
                !writeUri(dst.value) ||
                getVolume(src.value) !== getVolume(dst.value) ||
                !fsys.existsSync(src.value)
            ) {
                return BrsBoolean.False;
            }
            fsys.renameSync(src.value, dst.value);
            return BrsBoolean.True;
        } catch (err: any) {
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
        const fsys = interpreter.fileSystem;
        try {
            if (!writeUri(file.value)) {
                return BrsBoolean.False;
            }
            fsys.unlinkSync(file.value);
            return BrsBoolean.True;
        } catch (err: any) {
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
        const fsys = interpreter.fileSystem;
        try {
            if (!writeUri(dir.value)) {
                return BrsBoolean.False;
            }
            fsys.rmdirSync(dir.value);
            return BrsBoolean.True;
        } catch (err: any) {
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
        const fsys = interpreter.fileSystem;
        try {
            if (!writeUri(dir.value)) {
                return BrsBoolean.False;
            }
            fsys.mkdirSync(dir.value);
            return BrsBoolean.True;
        } catch (err: any) {
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
        if (interpreter.isDevMode) {
            interpreter.stderr.write("warning,`FormatDrive` is not implemented in `brs-engine`.");
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
    impl: (interpreter: Interpreter, dir: BrsString) => {
        const fsys = interpreter.fileSystem;
        try {
            if (!validUri(dir.value)) {
                interpreter.stderr.write(
                    `warning,*** ERROR: Missing or invalid PHY: '${dir.value}'`
                );
            } else if (fsys.existsSync(dir.value)) {
                const subPaths = fsys.readdirSync(dir.value).map((s) => new BrsString(s));
                return new RoList(subPaths);
            }
        } catch (err: any) {
            interpreter.stderr.write(`warning,*** ERROR: Listing '${dir.value}': ${err.message}`);
        }
        return new RoList([]);
    },
});

/** Reads ascii file from file system. */
export const ReadAsciiFile = new Callable("ReadAsciiFile", {
    signature: {
        args: [new StdlibArgument("filepath", ValueKind.String)],
        returns: ValueKind.String,
    },
    impl: (interpreter: Interpreter, filepath: BrsString) => {
        const fsys = interpreter.fileSystem;
        try {
            if (!validUri(filepath.value)) {
                return new BrsString("");
            }
            return new BrsString(fsys.readFileSync(filepath.value, "utf8"));
        } catch (err: any) {
            return new BrsString("");
        }
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
        const fsys = interpreter.fileSystem;
        try {
            if (!writeUri(filePath.value)) {
                return BrsBoolean.False;
            }
            fsys.writeFileSync(filePath.value, text.value, "utf8");
            return BrsBoolean.True;
        } catch (err: any) {
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
        const fsys = interpreter.fileSystem;
        try {
            if (!validUri(pathArg.value)) {
                return new RoList([]);
            }
            let knownFiles = fsys.readdirSync(pathArg.value);
            let matchedFiles = nanomatch.match(knownFiles, patternIn.value, {
                nocase: true,
                nodupes: true,
                noglobstar: true,
                nonegate: true,
            });

            matchedFiles = (matchedFiles || []).map((match: string) => new BrsString(match));

            return new RoList(matchedFiles);
        } catch (err: any) {
            return new RoList([]);
        }
    },
});