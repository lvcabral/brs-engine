import { BrsValue, ValueKind, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Int64, toAssociativeArray } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoInputEvent extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly id: number;
    private readonly response?: BrsType;

    constructor(response?: BrsType) {
        super("roInputEvent");
        this.id = Math.floor(Math.random() * 100) + 1;
        this.response = response;
        this.registerMethods({
            ifInputEvent: [this.isInput, this.getInfo],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roInputEvent>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Checks if an input event was received. */
    private readonly isInput = new Callable("isInput", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.response !== undefined);
        },
    });

    /** Returns an roAssociativeArray describing the input event. */
    private readonly getInfo = new Callable("getInfo", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            const id = new Int64(this.id);
            const info = { type: "", id: id, command: "", direction: "", duration: "" };
            return toAssociativeArray(info);
        },
    });
}
