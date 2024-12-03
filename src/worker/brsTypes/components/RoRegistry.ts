import { BrsValue, ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Int32 } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoList } from "./RoList";

export class RoRegistry extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    constructor() {
        super("roRegistry");
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
        impl: (interpreter: Interpreter, section: BrsString) => {
            let devId = interpreter.deviceInfo.get("developerId");
            [...interpreter.registry.keys()].forEach((key) => {
                let regSection = `${devId}.${section}`;
                if (key.startsWith(regSection)) {
                    interpreter.registry.delete(key);
                }
            });
            return BrsBoolean.True;
        },
    });

    /** Flushes the contents of the registry out to persistent storage. */
    private readonly flush = new Callable("flush", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter) => {
            postMessage(interpreter.registry);
            return BrsBoolean.True;
        },
    });

    /** Returns an roList with one entry for each registry section */
    private readonly getSectionList = new Callable("getSectionList", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            let devId = interpreter.deviceInfo.get("developerId");
            let sections = new Set<string>();
            [...interpreter.registry.keys()].forEach((key) => {
                if (key.split(".")[0] === devId) {
                    sections.add(key.split(".")[1]);
                }
            });
            return new RoList(
                [...sections].map(function (value: string) {
                    return new BrsString(value);
                })
            );
        },
    });

    /** Returns the number of bytes available in the channel application's device registry (32K) */
    private readonly getSpaceAvailable = new Callable("getSpaceAvailable", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            const devId = interpreter.deviceInfo.get("developerId");
            let space = 32 * 1024;
            interpreter.registry.forEach((value, key) => {
                if (key.split(".")[0] === devId) {
                    space -= Buffer.byteLength(key.substring(devId.length + 1), "utf8");
                    space -= Buffer.byteLength(value, "utf8");
                }
            });
            return new Int32(space);
        },
    });
}
