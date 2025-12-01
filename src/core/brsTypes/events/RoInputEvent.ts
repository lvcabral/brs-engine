import { ValueKind, BrsBoolean, BrsType, Int64, RoAssociativeArray, toAssociativeArray } from "..";
import { BrsEvent } from "./BrsEvent";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoInputEvent extends BrsEvent {
    private readonly id: number;
    private readonly input?: BrsType;

    constructor(input?: BrsType) {
        super("roInputEvent");
        this.id = Math.floor(Math.random() * 100) + 1;
        this.input = input;
        this.registerMethods({
            ifroInputEvent: [this.isInput, this.getInfo],
        });
    }

    /** Checks if an input event was received. */
    private readonly isInput = new Callable("isInput", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.input !== undefined);
        },
    });

    /** Returns an roAssociativeArray describing the input event. */
    private readonly getInfo = new Callable("getInfo", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            if (this.input instanceof RoAssociativeArray) {
                return this.input;
            }
            const id = new Int64(this.id);
            const info = { type: "transport", id: id, command: "", direction: "", duration: "" };
            return toAssociativeArray(info);
        },
    });
}
