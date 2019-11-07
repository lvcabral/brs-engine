import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoArray } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";

export class RoURLEvent extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private id: number;
    private responseCode: number;
    private responseString: string;
    private failureReason: string;
    private headers: string;
    private targetIp: string;

    constructor(id: number, response: string, status: number, statusText: string, headers: string) {
        super("roUrlEvent");
        this.id = id;
        this.responseCode = status;
        this.failureReason = statusText;
        this.responseString = response;
        this.headers = headers;
        this.targetIp = "";
        console.log(status, statusText);
        console.log(headers);

        this.registerMethods([
            this.getInt,
            this.getResponseCode,
            this.getFailureReason,
            this.getString,
            this.getSourceIdentity,
            this.getResponseHeaders,
            this.getResponseHeadersArray,
            this.getTargetIpAddress,
        ]);
    }

    messageBuilder(): BrsBoolean {
        throw new Error("Method not implemented.");
    }

    toString(parent?: BrsType): string {
        return "<Component: roUrlEvent>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Returns the type of event. */
    private getInt = new Callable("getInt", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(1); // Transfer Complete
        },
    });

    /** Returns response code from the request. */
    private getResponseCode = new Callable("getResponseCode", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.responseCode);
        },
    });

    /** Returns a description of the failure that occurred. */
    private getFailureReason = new Callable("getFailureReason", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.failureReason);
        },
    });

    /** For transfer complete AsyncGetToString, AsyncPostFromString and AsnycPostFromFile requests
     *  this will be the actual response body from the server. */
    private getString = new Callable("getString", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.responseString);
        },
    });

    /** Returns a unique number that can be matched with the value returned by roUrlTransfer.GetIdentity(). */
    private getSourceIdentity = new Callable("getSourceIdentity", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.id);
        },
    });

    /** Returns an roAssociativeArray containing all the headers returned by the server for appropriate protocols (such as HTTP). */
    private getResponseHeaders = new Callable("getResponseHeaders", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            // TODO: Get Headers and convert to AA
            return BrsInvalid.Instance;
        },
    });

    /** Returns an array of roAssociativeArray, each AA contains a single header name/value pair. Use this function if you
     *  need access to duplicate headers, since GetResponseHeaders() returns only the last name/value pair for a given name. */
    private getResponseHeadersArray = new Callable("getResponseHeadersArray", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            // TODO: Get Headers and convert to Array of AA's
            return new RoArray([]);
        },
    });

    /** Returns the IP address of the destination. */
    private getTargetIpAddress = new Callable("getTargetIpAddress", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.targetIp);
        },
    });
}
