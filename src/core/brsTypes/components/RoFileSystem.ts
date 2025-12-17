import { BrsValue, ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsEvent, BrsType, FlexObject, RoList, RoMessagePort, toAssociativeArray } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { FileSystem, getVolume, validUri, writeUri } from "../../device/FileSystem";
import { RoFileSystemEvent } from "../events/RoFileSystemEvent";
import { IfSetMessagePort, IfGetMessagePort } from "../interfaces/IfMessagePort";
import * as nanomatch from "nanomatch";
import * as path from "path";
import { BrsDevice } from "../../device/BrsDevice";
export class RoFileSystem extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly brsFS: FileSystem;
    private port?: RoMessagePort;
    private extMounted: boolean;

    constructor() {
        super("roFileSystem");
        const setPortIface = new IfSetMessagePort(this, this.getNewEvents.bind(this));
        const getPortIface = new IfGetMessagePort(this);
        this.registerMethods({
            ifFileSystem: [
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
            ],
            ifSetMessagePort: [setPortIface.setMessagePort],
            ifGetMessagePort: [getPortIface.getMessagePort],
        });
        this.brsFS = BrsDevice.fileSystem;
        this.extMounted = this.brsFS.volumesSync().includes("ext1:");
    }

    private getNewEvents() {
        const events: BrsEvent[] = [];
        const extEvent = this.brsFS.volumesSync().includes("ext1:");
        if (extEvent !== this.extMounted) {
            this.extMounted = extEvent;
            events.push(new RoFileSystemEvent(extEvent));
        }
        return events;
    }

    toString(parent?: BrsType): string {
        return "<Component: roFileSystem>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    findOnTree(regex: RegExp, pathName: string): BrsString[] {
        try {
            let knownFiles = this.brsFS.readdirSync(pathName);
            let matchedFiles: BrsString[] = [];
            for (const fileName of knownFiles) {
                if (regex.test(fileName)) {
                    matchedFiles.push(new BrsString(fileName));
                    let fullPath = path.posix.join(pathName, fileName);
                    if (this.brsFS.statSync(fullPath).isDirectory()) {
                        matchedFiles = matchedFiles.concat(this.findOnTree(regex, fullPath));
                    }
                }
            }
            return matchedFiles;
        } catch (err: any) {
            if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write(`warning,roFileSystem.findOnTree: ${err.message}`);
            }
            return [];
        }
    }

    // ifFileSystem ----------------------------------------------------------------------------------

    /** Returns an `roList` containing Strings representing the available volumes. */
    private readonly getVolumeList = new Callable("getVolumeList", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            try {
                const volumes = this.brsFS.volumesSync().map((s) => new BrsString(s));
                return new RoList(volumes);
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,roFileSystem.getVolumeList: ${err.message}`);
                }
                return new RoList([]);
            }
        },
    });

    /** Returns an roAssociativeArray containing information about the volume specified in path. */
    private readonly getVolumeInfo = new Callable("getVolumeInfo", {
        signature: {
            args: [new StdlibArgument("path", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, pathArg: BrsString) => {
            let result = {};
            if (this.brsFS.existsSync(pathArg.value)) {
                result = { blocks: 0, blocksize: 0, freeblocks: 0, usedblocks: 0 };
            }
            return toAssociativeArray(result);
        },
    });

    /** Returns an `roList` containing Strings representing the available volumes. */
    private readonly getDirectoryListing = new Callable("getDirectoryListing", {
        signature: {
            args: [new StdlibArgument("path", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, pathArg: BrsString) => {
            try {
                if (validUri(pathArg.value) && this.brsFS.existsSync(pathArg.value)) {
                    const subPaths = this.brsFS.readdirSync(pathArg.value).map((s) => new BrsString(s));
                    return new RoList(subPaths);
                }
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,roFileSystem.getDirectoryListing: ${err.message}`);
                }
                return new RoList([]);
            }
            return new RoList([]);
        },
    });

    /** Creates the directory specified by the path parameter. */
    private readonly createDirectory = new Callable("createDirectory", {
        signature: {
            args: [new StdlibArgument("path", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, pathArg: BrsString) => {
            try {
                if (!writeUri(pathArg.value)) {
                    return BrsBoolean.False;
                }
                this.brsFS.mkdirSync(pathArg.value);
                return BrsBoolean.True;
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,roFileSystem.createDirectory: ${err.message}`);
                }
                return BrsBoolean.False;
            }
        },
    });

    /** Permanently removes the file or directory specified by the path parameter. */
    private readonly delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("path", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, pathArg: BrsString) => {
            try {
                if (!writeUri(pathArg.value)) {
                    return BrsBoolean.False;
                } else if (this.brsFS.statSync(pathArg.value).isDirectory()) {
                    this.brsFS.rmdirSync(pathArg.value);
                } else {
                    this.brsFS.unlinkSync(pathArg.value);
                }
                return BrsBoolean.True;
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,roFileSystem.delete: ${err.message}`);
                }
                return BrsBoolean.False;
            }
        },
    });

    /** Copies the file from origin path to destiny path. */
    private readonly copyFile = new Callable("copyFile", {
        signature: {
            args: [new StdlibArgument("fromPath", ValueKind.String), new StdlibArgument("toPath", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, fromPath: BrsString, toPath: BrsString) => {
            try {
                if (!writeUri(toPath.value) || !this.brsFS.existsSync(fromPath.value)) {
                    return BrsBoolean.False;
                }
                const content = this.brsFS.readFileSync(fromPath.value);
                this.brsFS.writeFileSync(toPath.value, content);
                return BrsBoolean.True;
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,roFileSystem.copyFile: ${err.message}`);
                }
                return BrsBoolean.False;
            }
        },
    });

    /** Renames or moves the file or directory. */
    private readonly rename = new Callable("rename", {
        signature: {
            args: [new StdlibArgument("fromPath", ValueKind.String), new StdlibArgument("toPath", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, fromPath: BrsString, toPath: BrsString) => {
            try {
                if (
                    !writeUri(fromPath.value) ||
                    !writeUri(toPath.value) ||
                    getVolume(fromPath.value) !== getVolume(toPath.value) ||
                    !this.brsFS.existsSync(fromPath.value)
                ) {
                    return BrsBoolean.False;
                }
                this.brsFS.renameSync(fromPath.value, toPath.value);
                return BrsBoolean.True;
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,roFileSystem.rename: ${err.message}`);
                }
                return BrsBoolean.False;
            }
        },
    });

    /** Checks if the path exists. */
    private readonly exists = new Callable("exists", {
        signature: {
            args: [new StdlibArgument("path", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, pathArg: BrsString) => {
            try {
                return BrsBoolean.from(this.brsFS.existsSync(pathArg.value));
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,roFileSystem.exists: ${err.message}`);
                }
                return BrsBoolean.False;
            }
        },
    });

    /** Returns an roList of Strings representing the directory listing of names in dirPath which match the regEx regular expression. */
    private readonly find = new Callable("find", {
        signature: {
            args: [new StdlibArgument("path", ValueKind.String), new StdlibArgument("regEx", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, pathArg: BrsString, regEx: BrsString) => {
            const jsRegex = new RegExp(regEx.value);
            try {
                if (!validUri(pathArg.value)) {
                    return new RoList([]);
                }
                const knownFiles = this.brsFS.readdirSync(pathArg.value);
                const matchedFiles: BrsString[] = [];
                for (const fileName of knownFiles) {
                    if (jsRegex.test(fileName)) {
                        matchedFiles.push(new BrsString(fileName));
                    }
                }
                return new RoList(matchedFiles);
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,roFileSystem.find: ${err.message}`);
                }
                return new RoList([]);
            }
        },
    });

    /** Returns an roList of Strings representing the recursive directory listing of names in dirPath which match the regEx regular expression. */
    private readonly findRecurse = new Callable("findRecurse", {
        signature: {
            args: [new StdlibArgument("path", ValueKind.String), new StdlibArgument("regEx", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, pathArg: BrsString, regEx: BrsString) => {
            const jsRegex = new RegExp(regEx.value);
            try {
                if (!validUri(pathArg.value)) {
                    return new RoList([]);
                }
                return new RoList(this.findOnTree(jsRegex, pathArg.value));
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,roFileSystem.findRecurse: ${err.message}`);
                }
                return new RoList([]);
            }
        },
    });

    /** Returns an roList of Strings representing the directory listing of names in dirPath which match the shell-like pattern. */
    private readonly match = new Callable("match", {
        signature: {
            args: [new StdlibArgument("path", ValueKind.String), new StdlibArgument("pattern", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, pathArg: BrsString, pattern: BrsString) => {
            try {
                if (!validUri(pathArg.value)) {
                    return new RoList([]);
                }
                let knownFiles = BrsDevice.fileSystem.readdirSync(pathArg.value);
                let matchedFiles = nanomatch.match(knownFiles, pattern.value, {
                    nocase: true,
                    nodupes: true,
                    noglobstar: true,
                    nonegate: true,
                });

                matchedFiles = (matchedFiles || []).map((match: string) => new BrsString(match));

                return new RoList(matchedFiles);
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,roFileSystem.match: ${err.message}`);
                }
                return new RoList([]);
            }
        },
    });

    /** Returns an roAssociativeArray containing the keys for the passed in path. */
    private readonly stat = new Callable("stat", {
        signature: {
            args: [new StdlibArgument("path", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, pathArg: BrsString) => {
            const result: FlexObject = {};
            const arg = pathArg.value;
            try {
                if (!validUri(arg)) {
                    return toAssociativeArray(result);
                }
                const pathStat = this.brsFS.statSync(arg);
                result.hidden = false;
                if (pathStat.isFile()) {
                    const content = this.brsFS.readFileSync(arg);
                    result.size = typeof content.length === "number" ? content.length : 0;
                    result.type = "file";
                } else {
                    result.type = "directory";
                }
                const perm = arg.startsWith("tmp:") || arg.startsWith("cachefs:") ? "rw" : "r";
                result.permissions = perm;
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`warning,roFileSystem.stat: ${err.message}`);
                }
            }
            return toAssociativeArray(result);
        },
    });
}
