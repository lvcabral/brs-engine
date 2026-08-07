import { BrsType } from "..";
import { Callable, Int32, ValueKind } from "..";
import { BrsEvent } from "./BrsEvent";
import { Interpreter } from "../../interpreter";

/**
 * Sent by roStreamSocket/roDataGramSocket to signal a socket status change (readable, writable,
 * exception) once the socket's ifSocketAsync notify methods are enabled. Carries no payload — the
 * app pulls the actual data via ifSocket.Receive()/ReceiveStr() on the socket the event refers to.
 * https://developer.roku.com/docs/references/brightscript/events/rosocketevent.md
 */
export class RoSocketEvent extends BrsEvent {
    private readonly socketId: number;

    constructor(socketId: number) {
        super("roSocketEvent");
        this.socketId = socketId;
        this.registerMethods({
            ifSocketEvent: [this.getSocketID],
        });
    }

    toString(parent?: BrsType): string {
        return `<Component: roSocketEvent>`;
    }

    /** Returns the ID of the socket this event is for, matching ifSocketAsync.GetID(). */
    private readonly getSocketID = new Callable("getSocketID", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(this.socketId);
        },
    });
}
