import { BrsType, Callable, Int32, ValueKind, BrsInvalid, FlexObject, toAssociativeArray } from "..";
import { BrsEvent } from "./BrsEvent";
import { Interpreter } from "../../interpreter";

/**
 * Event type values reported by `roWebSocketEvent.GetType()`.
 * https://developer.roku.com/docs/references/brightscript/events/rowebsocketevent.md
 */
export enum WebSocketEventType {
    Opened = 1,
    Closed = 2,
    Error = 3,
    MsgSent = 4,
    TextReceived = 5,
    DataReceived = 6,
    PingReceived = 7,
    PongReceived = 8,
    Timer = 9,
}

/**
 * Delivered by `roWebSocket` via its message port for every asynchronous WebSocket occurrence
 * (open/close/error, sent/received messages, ping/pong, timers).
 * https://developer.roku.com/docs/references/brightscript/events/rowebsocketevent.md
 */
export class RoWebSocketEvent extends BrsEvent {
    constructor(
        private readonly socketId: number,
        /** Plain TS accessor for internal use (e.g. `RoWebSocket`'s synchronous waits) — the
         *  BrightScript-visible equivalent is the `getType` Callable below. */
        readonly type: WebSocketEventType,
        private readonly socketData: BrsType | undefined,
        private readonly info: FlexObject
    ) {
        super("roWebSocketEvent");
        this.registerMethods({
            ifWebSocketEvent: [this.getType, this.getSocketId, this.getSocketData, this.getInfo],
        });
    }

    toString(parent?: BrsType): string {
        return `<Component: roWebSocketEvent>`;
    }

    /** Returns the event type of the WebSocket event (see `WebSocketEventType`). */
    private readonly getType = new Callable("getType", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(this.type);
        },
    });

    /** Returns a unique number for the WebSocket instance that originated the event. */
    private readonly getSocketId = new Callable("getSocketId", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(this.socketId);
        },
    });

    /** Returns the socket data object stored on the originating `roWebSocket` via `SetData()`. */
    private readonly getSocketData = new Callable("getSocketData", {
        signature: { args: [], returns: ValueKind.Dynamic },
        impl: (_: Interpreter) => {
            return this.socketData ?? BrsInvalid.Instance;
        },
    });

    /** Returns an roAssociativeArray with event-specific information (see the event-type table). */
    private readonly getInfo = new Callable("getInfo", {
        signature: { args: [], returns: ValueKind.Object },
        impl: (_: Interpreter) => {
            return toAssociativeArray(this.info);
        },
    });
}
