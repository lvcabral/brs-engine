import { BrsValue, ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Int32 } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoList } from "./RoList";
import { BrsDevice } from "../../device/BrsDevice";

export class RoRegistry extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly devId: string;

    constructor() {
        super("roRegistry");
        this.devId = BrsDevice.deviceInfo.developerId;
        this.registerMethods({
            ifRegistry: [this.delete, this.flush, this.getSectionList, this.getSpaceAvailable],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roRegistry>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Deletes the specified section. */
    private readonly delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("section", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, section: BrsString) => {
            BrsDevice.refreshRegistry();
            const regSection = `${this.devId}.${section.value}`;
            for (const key of BrsDevice.registry.current.keys()) {
                if (key.startsWith(regSection) && BrsDevice.registry.current.delete(key)) {
                    BrsDevice.registry.removed.push(key);
                    BrsDevice.registry.isDirty = true;
                }
            }
            return BrsBoolean.True;
        },
    });

    /** Flushes the contents of the registry out to persistent storage. */
    private readonly flush = new Callable("flush", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            BrsDevice.flushRegistry();
            return BrsBoolean.True;
        },
    });

    /** Returns an roList with one entry for each registry section */
    private readonly getSectionList = new Callable("getSectionList", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            BrsDevice.refreshRegistry();
            let sections = new Set<string>();
            for (const key of BrsDevice.registry.current.keys()) {
                if (key.split(".")[0] === this.devId) {
                    sections.add(key.split(".")[1]);
                }
            }
            return new RoList(
                [...sections].map(function (value: string) {
                    return new BrsString(value);
                })
            );
        },
    });

    /** Returns the number of bytes available in the application's device registry (32K) */
    private readonly getSpaceAvailable = new Callable("getSpaceAvailable", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            BrsDevice.refreshRegistry();
            let space = 32 * 1024;
            for (const [key, value] of BrsDevice.registry.current) {
                if (key.split(".")[0] === this.devId) {
                    space -= Buffer.byteLength(key.substring(this.devId.length + 1), "utf8");
                    space -= Buffer.byteLength(value, "utf8");
                }
            }
            return new Int32(space);
        },
    });
}
