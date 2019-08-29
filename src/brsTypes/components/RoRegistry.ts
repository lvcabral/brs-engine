import { BrsValue, ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoList } from "./RoList";

export class RoRegistry extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    constructor() {
        super("roRegistry");
        this.registerMethods([this.delete, this.flush, this.getSectionList]);
    }

    toString(parent?: BrsType): string {
        return "<Component: roRegistry>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Deletes the specified section. */
    private delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("section", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, section: BrsString) => {
            let devId = interpreter.deviceInfo.get("developerId");
            [...interpreter.registry.keys()].forEach(key => {
                let regSection = devId + "." + section;
                if (key.substr(0, regSection.length) === regSection) {
                    interpreter.registry.delete(key);
                }
            });
            return BrsBoolean.True;
        },
    });

    /** Flushes the contents of the registry out to persistent storage. */
    private flush = new Callable("flush", {
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
    private getSectionList = new Callable("getSectionList", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            let devId = interpreter.deviceInfo.get("developerId");
            let sections = new Set<string>();
            [...interpreter.registry.keys()].forEach(key => {
                if (key.split(".")[0] === devId) {
                    sections.add(key.split(".")[1]);
                }
            });
            return new RoList(
                [...sections].map(function(value: string) {
                    return new BrsString(value);
                })
            );
        },
    });
}
