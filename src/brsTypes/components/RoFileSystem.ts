import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Int32 } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoList } from "./RoList";
import { RoAssociativeArray } from "./RoAssociativeArray";
import URL from "url-parse";
import MemoryFileSystem from "memory-fs";
import * as nanomatch from "nanomatch";
import * as path from "path";

type Volume = MemoryFileSystem;

export class RoFileSystem extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    constructor() {
        super("roFileSystem");

        this.registerMethods([
            this.getVolumeList,
            this.getVolumeInfo,
            this.getDirectoryListing,
            this.createDirectory,
            this.delete,
            this.copyFile,
            this.rename,
            this.find,
            this.findRecurse,
            this.match,
            this.exists,
            this.stat,
            this.getMessagePort,
            this.setMessagePort,
        ]);
    }

    toString(parent?: BrsType): string {
        return "<Component: roFileSystem>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    findOnTree(volume: Volume, jsRegex: RegExp, pathName: string): BrsString[] {
        try {
            let knownFiles = volume.readdirSync(pathName);
            let matchedFiles: BrsString[] = [];
            knownFiles.forEach(fileName => {
                if (jsRegex.test(fileName)) {
                    matchedFiles.push(new BrsString(fileName));
                    let fullPath = path.join(pathName, fileName);
                    if (volume.statSync(fullPath).isDirectory()) {
                        matchedFiles = matchedFiles.concat(
                            this.findOnTree(volume, jsRegex, fullPath)
                        );
                    }
                }
            });
            return matchedFiles;
        } catch (err) {
            return [];
        }
    }

    // ifFileSystem ----------------------------------------------------------------------------------

    /** Returns an `roList` containing Strings representing the available volumes. */
    private getVolumeList = new Callable("getVolumeList", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            let volumes = new Array<BrsString>();
            [...interpreter.fileSystem.keys()].forEach(key => {
                volumes.push(new BrsString(key));
            });
            return new RoList(volumes);
        },
    });

    /** Returns an roAssociativeArray containing information about the volume specified in path. */
    private getVolumeInfo = new Callable("getVolumeInfo", {
        signature: {
            args: [new StdlibArgument("path", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, pathArg: BrsString) => {
            const url = new URL(pathArg.value);
            const result = new RoAssociativeArray([]);
            const volume = interpreter.fileSystem.get(url.protocol);
            if (volume) {
                result.set(new BrsString("blocks"), new Int32(0));
                result.set(new BrsString("blocksize"), new Int32(0));
                result.set(new BrsString("freeblocks"), new Int32(0));
                result.set(new BrsString("usedblocks"), new Int32(0));
            }
            return result;
        },
    });

    /** Returns an `roList` containing Strings representing the available volumes. */
    private getDirectoryListing = new Callable("getDirectoryListing", {
        signature: {
            args: [new StdlibArgument("path", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, pathArg: BrsString) => {
            const url = new URL(pathArg.value);
            const volume = interpreter.fileSystem.get(url.protocol);
            if (volume) {
                try {
                    let subPaths = volume.readdirSync(url.pathname).map(s => new BrsString(s));
                    return new RoList(subPaths);
                } catch (err) {
                    return new RoList([]);
                }
            }
            return new RoList([]);
        },
    });

    /** Creates the directory specified by the path parameter. */
    private createDirectory = new Callable("createDirectory", {
        signature: {
            args: [new StdlibArgument("path", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, pathArg: BrsString) => {
            const url = new URL(pathArg.value);
            const volume = interpreter.fileSystem.get(url.protocol);
            if (volume) {
                try {
                    volume.mkdirSync(url.pathname);
                    return BrsBoolean.True;
                } catch (err) {
                    return BrsBoolean.False;
                }
            }
            return BrsBoolean.False;
        },
    });

    /** Permanently removes the file or directory specified by the path parameter. */
    private delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("path", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, pathArg: BrsString) => {
            const url = new URL(pathArg.value);
            const volume = interpreter.fileSystem.get(url.protocol);
            if (volume) {
                try {
                    if (volume.statSync(url.pathname).isDirectory()) {
                        volume.rmdirSync(url.pathname);
                    } else {
                        volume.unlinkSync(url.pathname);
                    }
                    return BrsBoolean.True;
                } catch (err) {
                    return BrsBoolean.False;
                }
            }
            return BrsBoolean.False;
        },
    });

    /** Copies the file from origin path to destiny path. */
    private copyFile = new Callable("copyFile", {
        signature: {
            args: [
                new StdlibArgument("fromPath", ValueKind.String),
                new StdlibArgument("toPath", ValueKind.String),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fromPath: BrsString, toPath: BrsString) => {
            const srcUrl = new URL(fromPath.value);
            const srcVolume = interpreter.fileSystem.get(srcUrl.protocol);
            if (!srcVolume) {
                return BrsBoolean.False;
            }
            const dstUrl = new URL(toPath.value);
            const dstVolume = interpreter.fileSystem.get(dstUrl.protocol);
            if (!dstVolume) {
                return BrsBoolean.False;
            }
            try {
                let contents = srcVolume.readFileSync(srcUrl.pathname);
                dstVolume.writeFileSync(dstUrl.pathname, contents);
                return BrsBoolean.True;
            } catch (err) {
                return BrsBoolean.False;
            }
        },
    });

    /** Renames or moves the file or directory. */
    private rename = new Callable("rename", {
        signature: {
            args: [
                new StdlibArgument("fromPath", ValueKind.String),
                new StdlibArgument("toPath", ValueKind.String),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fromPath: BrsString, toPath: BrsString) => {
            // TODO: Add support to rename directories
            const srcUrl = new URL(fromPath.value);
            const srcVolume = interpreter.fileSystem.get(srcUrl.protocol);
            if (!srcVolume) {
                return BrsBoolean.False;
            }
            const dstUrl = new URL(toPath.value);
            const dstVolume = interpreter.fileSystem.get(srcUrl.protocol);
            if (!dstVolume) {
                return BrsBoolean.False;
            }
            try {
                if (dstVolume.existsSync(dstUrl.pathname)) {
                    return BrsBoolean.False;
                }
                let contents = srcVolume.readFileSync(srcUrl.pathname);
                dstVolume.writeFileSync(dstUrl.pathname, contents);
                srcVolume.unlinkSync(srcUrl.pathname);
                return BrsBoolean.True;
            } catch (err) {
                return BrsBoolean.False;
            }
        },
    });

    /** Checks if the path exists. */
    private exists = new Callable("exists", {
        signature: {
            args: [new StdlibArgument("path", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, pathArg: BrsString) => {
            const url = new URL(pathArg.value);
            const volume = interpreter.fileSystem.get(url.protocol);
            if (volume) {
                try {
                    return BrsBoolean.from(volume.existsSync(url.pathname));
                } catch (err) {
                    return BrsBoolean.False;
                }
            }
            return BrsBoolean.False;
        },
    });

    /** Returns an roList of Strings representing the directory listing of names in dirPath which match the regEx regular expression. */
    private find = new Callable("find", {
        signature: {
            args: [
                new StdlibArgument("path", ValueKind.String),
                new StdlibArgument("regEx", ValueKind.String),
            ],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, pathArg: BrsString, regEx: BrsString) => {
            const jsRegex = new RegExp(regEx.value);
            const url = new URL(pathArg.value);
            const volume = interpreter.fileSystem.get(url.protocol);
            if (volume) {
                try {
                    let knownFiles = volume.readdirSync(url.pathname);
                    let matchedFiles: BrsString[] = [];
                    knownFiles.forEach(fileName => {
                        if (jsRegex.test(fileName)) {
                            matchedFiles.push(new BrsString(fileName));
                        }
                    });
                    return new RoList(matchedFiles);
                } catch (err) {
                    return new RoList([]);
                }
            }
            return new RoList([]);
        },
    });

    /** Returns an roList of Strings representing the recursive directory listing of names in dirPath which match the regEx regular expression. */
    private findRecurse = new Callable("findRecurse", {
        signature: {
            args: [
                new StdlibArgument("path", ValueKind.String),
                new StdlibArgument("regEx", ValueKind.String),
            ],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, pathArg: BrsString, regEx: BrsString) => {
            const jsRegex = new RegExp(regEx.value);
            const url = new URL(pathArg.value);
            const volume = interpreter.fileSystem.get(url.protocol);
            if (volume) {
                return new RoList(this.findOnTree(volume, jsRegex, url.pathname));
            }
            return new RoList([]);
        },
    });

    /** Returns an roList of Strings representing the directory listing of names in dirPath which match the shell-like pattern. */
    private match = new Callable("match", {
        signature: {
            args: [
                new StdlibArgument("path", ValueKind.String),
                new StdlibArgument("pattern", ValueKind.String),
            ],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, pathArg: BrsString, pattern: BrsString) => {
            const url = new URL(pathArg.value);
            const volume = interpreter.fileSystem.get(url.protocol);
            if (volume) {
                try {
                    let knownFiles = volume.readdirSync(url.pathname);
                    let matchedFiles = nanomatch.match(knownFiles, pattern.value, {
                        nocase: true,
                        nodupes: true,
                        noglobstar: true,
                        nonegate: true,
                    });

                    matchedFiles = (matchedFiles || []).map(
                        (match: string) => new BrsString(match)
                    );

                    return new RoList(matchedFiles);
                } catch (err) {
                    return new RoList([]);
                }
            }
            return new RoList([]);
        },
    });

    /** Returns an roAssociativeArray containing the keys for the passed in path. */
    private stat = new Callable("stat", {
        signature: {
            args: [new StdlibArgument("path", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, pathArg: BrsString) => {
            const url = new URL(pathArg.value);
            const result = new RoAssociativeArray([]);
            const volume = interpreter.fileSystem.get(url.protocol);
            if (volume) {
                try {
                    const stat = volume.statSync(url.pathname);
                    result.set(new BrsString("hidden"), BrsBoolean.False);
                    if (stat.isFile()) {
                        const content = volume.readFileSync(url.pathname);
                        if (typeof content.length === "number") {
                            result.set(new BrsString("size"), new Int32(content.length));
                        } else {
                            result.set(new BrsString("size"), new Int32(0)); // TODO: Find a way to get ImageBitmap byte length
                        }
                    }
                    result.set(
                        new BrsString("permissions"),
                        new BrsString(url.protocol === "tmp:" ? "rw" : "r")
                    );
                    result.set(
                        new BrsString("type"),
                        new BrsString(stat.isFile() ? "file" : "directory")
                    );
                } catch (err) {
                    return result;
                }
            }
            return result;
        },
    });
    // ifGetMessagePort ----------------------------------------------------------------------------------

    /** Returns the message port (if any) currently associated with the object */
    private getMessagePort = new Callable("getMessagePort", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            // Not supported, always return invalid
            return BrsInvalid.Instance;
        },
    });

    // ifSetMessagePort ----------------------------------------------------------------------------------

    /** Sets the roMessagePort to be used for all events from the screen */
    private setMessagePort = new Callable("setMessagePort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: BrsComponent) => {
            // Not supported, ignore any parameter
            return BrsInvalid.Instance;
        },
    });
}
