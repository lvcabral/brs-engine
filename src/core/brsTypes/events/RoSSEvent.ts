import { BrsType, BrsString, Int32, ValueKind } from "..";
import { BrsEvent } from "./BrsEvent";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";
import { ServerSentEvent } from "../../device/SseParser";

/**
 * Sent by `roUrlTransfer` to its message port for each server-sent event received after
 * `AsyncGetSSEvents()` (since Roku OS 16.0).
 * https://developer.roku.com/docs/references/brightscript/events/rossevent.md
 */
export class RoSSEvent extends BrsEvent {
    constructor(private readonly sourceId: number, private readonly sse: ServerSentEvent) {
        super("roSSEvent");
        this.registerMethods({
            ifSSEvent: [this.getSourceIdentity, this.getEvent, this.getId, this.getData, this.getRetry],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roSSEvent>";
    }

    /** Returns a number that matches the originating roUrlTransfer.GetIdentity(). */
    private readonly getSourceIdentity = new Callable("getSourceIdentity", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(this.sourceId);
        },
    });

    /** Returns the "event" field of the server-sent event, or an empty string if not present. */
    private readonly getEvent = new Callable("getEvent", {
        signature: { args: [], returns: ValueKind.String },
        impl: (_: Interpreter) => {
            return new BrsString(this.sse.event);
        },
    });

    /** Returns the "id" field of the server-sent event, or an empty string if not present. */
    private readonly getId = new Callable("getId", {
        signature: { args: [], returns: ValueKind.String },
        impl: (_: Interpreter) => {
            return new BrsString(this.sse.id);
        },
    });

    /** Returns the "data" field of the server-sent event, or an empty string if not present. */
    private readonly getData = new Callable("getData", {
        signature: { args: [], returns: ValueKind.String },
        impl: (_: Interpreter) => {
            return new BrsString(this.sse.data);
        },
    });

    /** Returns the "retry" field (reconnection interval in ms) of the server-sent event, or 0 if not present. */
    private readonly getRetry = new Callable("getRetry", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(this.sse.retry);
        },
    });
}
