import { BrsValue, ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoList } from "./RoList";
import { deviceInfo, registry } from "../..";

export class RoRegistry extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private devId: string;

    constructor() {
        super("roRegistry");
        this.devId = deviceInfo.get("developerId");

        this.registerMethods([this.delete, this.flush, this.getSectionList]);
    }

    toString(parent?: BrsType): string {
        return "<Component: roRegistry>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    getValue() {
        return registry;
    }

    /** Deletes the specified section. */
    private delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("section", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, section: BrsString) => {
            [...registry.keys()].forEach(key => {
                let regSection = this.devId + "." + section;
                if (key.substr(0, regSection.length) === regSection) {
                    registry.delete(key);
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
            postMessage(registry);
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
            let sections = new Set<string>();
            [...registry.keys()].forEach(key => {
                sections.add(key.split(".")[1]);
            });
            return new RoList(
                [...sections].map(function(value: string) {
                    return new BrsString(value);
                })
            );
        },
    });
}
