import { BrsValue, ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Int32 } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoList } from "./RoList";
import URL from "url-parse";
import { RoAssociativeArray } from "./RoAssociativeArray";

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
            // this.copyFile,
            // this.rename,
            // this.find,
            // this.findRecurse,
            // this.match,
            // this.exists,
            // this.stats,
        ]);
    }

    toString(parent?: BrsType): string {
        return "<Component: roFileSystem>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

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
        impl: (interpreter: Interpreter, path: BrsString) => {
            const url = new URL(path.value);
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
        impl: (interpreter: Interpreter, path: BrsString) => {
            const url = new URL(path.value);
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
        impl: (interpreter: Interpreter, path: BrsString) => {
            const url = new URL(path.value);
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
        impl: (interpreter: Interpreter, path: BrsString) => {
            const url = new URL(path.value);
            const volume = interpreter.fileSystem.get(url.protocol);
            if (volume) {
                try {
                    volume.unlinkSync(url.pathname);
                    return BrsBoolean.True;
                } catch (err) {
                    return BrsBoolean.False;
                }
            }
            return BrsBoolean.False;
        },
    });
}
