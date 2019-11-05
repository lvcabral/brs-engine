import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoArray } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";

export class RoURLEvent extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private id: number;
    private response?: BrsType[];

    constructor(id: number, response?: BrsType[]) {
        super("roUrlEvent");
        this.id = id;
        this.response = response;
        this.registerMethods([
            this.isRequestSucceeded,
            this.isRequestFailed,
            this.getSourceIdentity,
            this.getResponse,
            this.getStatus,
            this.getStatusMessage,
            this.isRequestInterrupted,
        ]);
    }

    toString(parent?: BrsType): string {
        return "<Component: roUrlEvent>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Returns if the previous Get request has completed successfully. */
    private isRequestSucceeded = new Callable("isRequestSucceeded", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.response !== undefined);
        },
    });

    /** Returns true if the Get request fail. */
    private isRequestFailed = new Callable("isRequestFailed", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.response === undefined);
        },
    });

    /** Returns a unique number that can be matched with the value returned by ifChannelStore.GetIdentity(). */
    private getSourceIdentity = new Callable("getSourceIdentity", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.id);
        },
    });

    /** Returns an array of roAssociativeArray items for the previous Get* method invocation. */
    private getResponse = new Callable("getResponse", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            if (this.response) {
                return new RoArray(this.response);
            }
            return BrsInvalid.Instance;
        },
    });

    /** Returns an Integer code that indicates the reason for failure. */
    private getStatus = new Callable("getStatus", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.response === undefined ? -4 : 1);
        },
    });

    /** Returns a human-readable string describing the status of the completed request	. */
    private getStatusMessage = new Callable("getStatusMessage", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.response === undefined ? "Empty List" : "Items Received");
        },
    });

    /** Returns true if the request was not complete. */
    private isRequestInterrupted = new Callable("isRequestInterrupted", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.False;
        },
    });
}
