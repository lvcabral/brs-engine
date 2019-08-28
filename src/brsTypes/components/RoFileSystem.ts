import { BrsValue, ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
//import { DeleteFile } from "../../stdlib/File";
import { RoList } from "./RoList";
import URL from "url-parse";

export class RoFileSystem extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    constructor() {
        super("roFileSystem");

        this.registerMethods([
            this.getVolumeList,
            // this.getVolumeInfo,
            // this.getDirectoryListing,
            // this.createDirectory,
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

    /**  */
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

    /** Permanently removes the file or directory specified by the path parameter. */
    private delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("path", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, path: BrsString) => {
            // DeleteFile.call(interpreter,path);
            return BrsBoolean.True;
        },
    });
}
