import { BrsValue, ValueKind, BrsBoolean } from "../BrsType";
import { BrsComponent } from "../components/BrsComponent";
import { BrsType, Int64, RoAssociativeArray, toAssociativeArray } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoInputEvent extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
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
