import { BrsValue, ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoList } from "./RoList";
import { deviceInfo, registry } from "../..";
import { URL } from "url";

export class RoFileSystem extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private devId: string;

    constructor() {
        super("roFileSystem");
        this.devId = deviceInfo.get("developerId");

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

    getValue() {
        return registry;
    }

    /**  */
    private getVolumeList = new Callable("getVolumeList", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            let volumes = [];
            volumes.push(new BrsString("common:"));
            volumes.push(new BrsString("pkg:"));
            volumes.push(new BrsString("tmp:"));
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
            return BrsBoolean.True;
        },
    });
}
