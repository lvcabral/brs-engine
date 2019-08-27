import { BrsValue, ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoArray } from "./RoArray";
import { RoAssociativeArray, AAMember } from "./RoAssociativeArray";
import { deviceInfo, registry } from "../..";

export class RoRegistrySection extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private devId: string;
    private section: string;

    constructor(section: BrsString) {
        super("roRegistrySection");
        this.section = section.value;
        this.devId = deviceInfo.get("developerId");

        this.registerMethods([
            this.read,
            this.readMulti,
            this.write,
            this.writeMulti,
            this.delete,
            this.exists,
            this.flush,
            this.getKeyList,
        ]);
    }

    toString(parent?: BrsType): string {
        return "<Component: roRegistrySection>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    getValue() {
        return registry;
    }

    /** Reads and returns the value of the specified key. */
    private read = new Callable("read", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String)],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter, key: BrsString) => {
            let value = registry.get(this.devId + "." + this.section + "." + key.value);
            if (!value) {
                value = "";
            }
            return new BrsString(value);
        },
    });

    /** Reads multiple values from the registry. */
    private readMulti = new Callable("readMulti", {
        signature: {
            args: [new StdlibArgument("keysArray", ValueKind.Object)],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter, keysArray: RoArray) => {
            let keys = keysArray.getElements() as Array<BrsString>;
            let result = new RoAssociativeArray([]);
            keys.forEach(key => {
                let fullKey = this.devId + "." + this.section + "." + key.value;
                let value = registry.get(fullKey);
                if (value) {
                    result.set(key, new BrsString(value));
                }
            });
            return result;
        },
    });

    /** Replaces the value of the specified key. */
    private write = new Callable("write", {
        signature: {
            args: [
                new StdlibArgument("key", ValueKind.String),
                new StdlibArgument("value", ValueKind.String),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, key: BrsString, value: BrsString) => {
            registry.set(this.devId + "." + this.section + "." + key.value, value.value);
            return BrsBoolean.True;
        },
    });

    /** Writes multiple values to the registry. */
    private writeMulti = new Callable("writeMulti", {
        signature: {
            args: [new StdlibArgument("roAA", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, roAA: RoAssociativeArray) => {
            let elements = roAA.getElements();
            let devSection = this.devId + "." + this.section + ".";
            elements.forEach(function(value, key) {
                registry.set(devSection + key, value.value);
            });
            return BrsBoolean.True;
        },
    });

    /** Deletes the specified key. */
    private delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, key: BrsString) => {
            let deleted = registry.delete(this.devId + "." + this.section + "." + key.value);
            return BrsBoolean.from(deleted);
        },
    });

    /** Checks if the specified key exists */
    private exists = new Callable("exists", {
        signature: {
            args: [new StdlibArgument("key", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, key: BrsString) => {
            return BrsBoolean.from(registry.has(this.devId + "." + this.section + "." + key.value));
        },
    });

    /** Flushes the contents of the registry out to persistent storage. */
    private flush = new Callable("flush", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter) => {
            //TODO: Post message with registry data back to browser
            return BrsBoolean.True;
        },
    });

    /** Each entry is an roString containing the name of the key */
    private getKeyList = new Callable("getKeyList", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            let keys = new Array<BrsString>();
            [...registry.keys()].forEach(key => {
                let regSection = this.devId + "." + this.section;
                if (key.substr(0, regSection.length) === regSection) {
                    keys.push(new BrsString(key.substr(regSection.length + 1)));
                }
            });
            return new RoArray(keys);
        },
    });
}
