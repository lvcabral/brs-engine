import { ValueKind, BrsBoolean, BrsString } from "..";
import { BrsEvent } from "./BrsEvent";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoFileSystemEvent extends BrsEvent {
    private readonly message: string;
    private readonly mounted: boolean = false;

    constructor(data: any) {
        // Roku does not capitalize the "s" in "Filesystem"
        super("roFilesystemEvent");
        if (typeof data === "boolean") {
            this.mounted = data;
        }
        this.message = "ext1:";
        this.registerMethods({
            ifroFileSystemEvent: [this.getMessage, this.isStorageDeviceAdded, this.isStorageDeviceRemoved],
        });
    }

    /** Checks if a storage device was inserted in the USB port. */
    private readonly isStorageDeviceAdded = new Callable("isStorageDeviceAdded", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.mounted === true);
        },
    });

    /** Checks if a storage device was removed from the USB port. */
    private readonly isStorageDeviceRemoved = new Callable("isStorageDeviceRemoved", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.mounted === false);
        },
    });

    /** Returns the volume name of the device inserted or removed from the USB port. */
    private readonly getMessage = new Callable("getMessage", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.message);
        },
    });
}
