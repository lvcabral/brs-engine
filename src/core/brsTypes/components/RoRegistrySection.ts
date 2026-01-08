import { BrsValue, ValueKind, BrsString, BrsBoolean, Uninitialized } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, isStringComp } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RuntimeError, RuntimeErrorDetail } from "../../error/BrsError";
import { RoArray } from "./RoArray";
import { RoList } from "./RoList";
import { RoAssociativeArray } from "./RoAssociativeArray";
import { BrsDevice } from "../../device/BrsDevice";

export class RoRegistrySection extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    readonly section: string;
    readonly devId: string;

    constructor(section: BrsType) {
        super("roRegistrySection");
        if (!isStringComp(section)) {
            const errorDetail =
                section instanceof Uninitialized
                    ? RuntimeErrorDetail.UninitializedVariable
                    : RuntimeErrorDetail.TypeMismatch;
            throw new RuntimeError(errorDetail, true);
        }
        this.section = section.getValue();
        this.devId = BrsDevice.deviceInfo.developerId;
        this.registerMethods({
            ifRegistrySection: [
                this.read,
                this.readMulti,
                this.write,
                this.writeMulti,
                this.delete,
                this.exists,
                this.flush,
                this.getKeyList,
            ],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roRegistrySection>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    getValue() {
        return this.section;
    }

    /** Reads and returns the value of the specified key. */
    private readonly read = new Callable("read", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, key: BrsString) => {
            BrsDevice.refreshRegistry();
            const fullKey = `${this.devId}.${this.section}.${key.value}`;
            const value = BrsDevice.registry.current.get(fullKey) ?? "";
            return new BrsString(value);
        },
    });

    /** Reads multiple values from the registry. */
    private readonly readMulti = new Callable("readMulti", {
        signature: {
            args: [new StdlibArgument("keysArray", ValueKind.Object)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, keysArray: RoArray) => {
            BrsDevice.refreshRegistry();
            const keys = keysArray.getElements() as BrsString[];
            const result = new RoAssociativeArray([]);
            for (const key of keys) {
                const fullKey = `${this.devId}.${this.section}.${key.value}`;
                const value = BrsDevice.registry.current.get(fullKey);
                if (value) {
                    result.set(key, new BrsString(value));
                }
            }
            return result;
        },
    });

    /** Replaces the value of the specified key. */
    private readonly write = new Callable("write", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String), new StdlibArgument("value", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, key: BrsString, value: BrsString) => {
            BrsDevice.refreshRegistry();
            const fullKey = `${this.devId}.${this.section}.${key.value}`;
            BrsDevice.registry.current.set(fullKey, value.value);
            BrsDevice.registry.isDirty = true;
            return BrsBoolean.True;
        },
    });

    /** Writes multiple values to the registry. */
    private readonly writeMulti = new Callable("writeMulti", {
        signature: {
            args: [new StdlibArgument("roAA", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, roAA: RoAssociativeArray) => {
            BrsDevice.refreshRegistry();
            const devSection = `${this.devId}.${this.section}.`;
            for (const [key, value] of roAA.elements) {
                BrsDevice.registry.current.set(`${devSection}${key}`, value.toString());
                BrsDevice.registry.isDirty = true;
            }
            return BrsBoolean.True;
        },
    });

    /** Deletes the specified key. */
    private readonly delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, key: BrsString) => {
            BrsDevice.refreshRegistry();
            const fullKey = `${this.devId}.${this.section}.${key.value}`;
            if (BrsDevice.registry.current.delete(fullKey)) {
                BrsDevice.registry.removed.push(fullKey);
                BrsDevice.registry.isDirty = true;
            }
            return BrsBoolean.True;
        },
    });

    /** Checks if the specified key exists */
    private readonly exists = new Callable("exists", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, key: BrsString) => {
            BrsDevice.refreshRegistry();
            const fullKey = `${this.devId}.${this.section}.${key.value}`;
            return BrsBoolean.from(BrsDevice.registry.current.has(fullKey));
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

    /** Each entry is an roString containing the name of the key */
    private readonly getKeyList = new Callable("getKeyList", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            BrsDevice.refreshRegistry();
            const keys = new Array<BrsString>();
            for (const key of BrsDevice.registry.current.keys()) {
                const sectionKey = `${this.devId}.${this.section}`;
                if (key.startsWith(sectionKey)) {
                    keys.push(new BrsString(key.slice(sectionKey.length + 1)));
                }
            }
            return new RoList(keys);
        },
    });
}
