import { BrsValue, ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Int64, RoAssociativeArray } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoInputEvent extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private id: number;
    private response?: BrsType;

    constructor(response?: BrsType) {
        super("roInputEvent");
        this.id = Math.floor(Math.random() * 100) + 1;
        this.response = response;
        this.registerMethods({
            ifChannelStoreEvent: [this.isInput, this.getInfo],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roInputEvent>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Checks if an input event was received. */
    private isInput = new Callable("isInput", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.response !== undefined);
        },
    });

    /** Returns an roAssociativeArray describing the input event. */
    private getInfo = new Callable("getSourceIdentity", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return new RoAssociativeArray([
                { name: new BrsString("type"), value: new BrsString("") },
                { name: new BrsString("id"), value: new Int64(this.id) },
                { name: new BrsString("command"), value: new BrsString("") },
                { name: new BrsString("direction"), value: new BrsString("") },
                { name: new BrsString("duration"), value: new BrsString("") },
            ]);
        },
    });
}
