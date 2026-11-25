import { ValueKind, BrsString, toAssociativeArray } from "..";
import { BrsEvent } from "./BrsEvent";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";

/**
 * Delivered through `roAnimatedImage`'s message port after `SetContent` finishes loading. Per
 * `ifAnimatedImage`: `GetMessage()` reports "ready"/"failed", and `GetInfo()` returns an
 * associative array whose `id` field matches the source `roAnimatedImage`'s `GetID()`, and an
 * `error` field that is empty on success.
 */
export class RoAnimatedImageEvent extends BrsEvent {
    private readonly id: string;
    private readonly message: "ready" | "failed";
    private readonly error: string;

    constructor(id: number, message: "ready" | "failed", error: string = "") {
        super("roAnimatedImageEvent");
        this.id = String(id);
        this.message = message;
        this.error = error;

        this.registerMethods({
            ifAnimatedImageEvent: [this.getMessage, this.getInfo],
        });
    }

    getValue() {
        return this.message;
    }

    /** Returns "ready" on success or "failed" on failure. */
    private readonly getMessage = new Callable("getMessage", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.message);
        },
    });

    /** Returns an associative array with `id` (matching GetID()) and `error`. */
    private readonly getInfo = new Callable("getInfo", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return toAssociativeArray({ error: this.error, id: this.id });
        },
    });
}
