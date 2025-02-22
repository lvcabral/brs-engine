import { BrsValue, ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoArray } from "./RoArray";
import { RoList } from "./RoList";
import { RoAssociativeArray } from "./RoAssociativeArray";
import { BrsDevice } from "../../device/BrsDevice";

export class RoRegistrySection extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    readonly section: string;
    readonly devId: string;

    constructor(section: BrsString) {
        super("roRegistrySection");
        this.section = section.value;
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
            let value = BrsDevice.registry.get(`${this.devId}.${this.section}.${key.value}`);
            if (!value) {
                value = "";
            }
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
            let keys = keysArray.getElements() as BrsString[];
            let result = new RoAssociativeArray([]);
            keys.forEach((key) => {
                let fullKey = `${this.devId}.${this.section}.${key.value}`;
                let value = BrsDevice.registry.get(fullKey);
                if (value) {
                    result.set(key, new BrsString(value));
                }
            });
            return result;
        },
    });

    /** Replaces the value of the specified key. */
    private readonly write = new Callable("write", {
        signature: {
            args: [
                new StdlibArgument("key", ValueKind.String),
                new StdlibArgument("value", ValueKind.String),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, key: BrsString, value: BrsString) => {
            BrsDevice.refreshRegistry();
            BrsDevice.registry.set(this.devId + "." + this.section + "." + key.value, value.value);
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
            const elements = roAA.getElements();
            const devSection = `${this.devId}.${this.section}.`;
            elements.forEach(function (value, key) {
                BrsDevice.registry.set(`${devSection}${key}`, value.value);
            });
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
            return BrsBoolean.from(
                BrsDevice.registry.delete(this.devId + "." + this.section + "." + key.value)
            );
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
            return BrsBoolean.from(
                BrsDevice.registry.has(this.devId + "." + this.section + "." + key.value)
            );
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
            postMessage(BrsDevice.registry);
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
            [...BrsDevice.registry.keys()].forEach((key) => {
                const regSection = this.devId + "." + this.section;
                if (key.startsWith(regSection)) {
                    keys.push(new BrsString(key.slice(regSection.length + 1)));
                }
            });
            return new RoList(keys);
        },
    });
}
