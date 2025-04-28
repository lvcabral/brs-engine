import { BrsValue, ValueKind, BrsString, BrsBoolean, Comparable } from "../BrsType";
import { BrsComponent } from "../components/BrsComponent";
import { BrsType, RoArray, RoAssociativeArray, isStringComp } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { resolveHostToIP } from "../../interpreter/Network";

export class RoURLEvent extends BrsComponent implements BrsValue, Comparable {
    readonly kind = ValueKind.Object;
    private readonly id: number;
    private readonly responseCode: number;
    private readonly responseString: string;
    private readonly failureReason: string;
    private readonly headers: string;
    private readonly host: string;

    constructor(id: number, host: string, response: string, status: number, statusText: string, headers: string) {
        super("roUrlEvent");
        this.id = id;
        this.responseCode = status;
        this.failureReason = statusText;
        this.responseString = response;
        this.headers = headers;
        this.host = host;

        this.registerMethods({
            ifUrlEvent: [
                this.getResponseCode,
                this.getFailureReason,
                this.getSourceIdentity,
                this.getResponseHeaders,
                this.getResponseHeadersArray,
                this.getTargetIpAddress,
            ],
            ifString: [this.getString],
            ifInt: [this.getInt],
        });
    }

    getStatus() {
        return this.responseCode;
    }

    getValue() {
        return this.responseString;
    }

    toString(parent?: BrsType): string {
        return this.responseString;
    }

    lessThan(other: BrsType): BrsBoolean {
        if (isStringComp(other)) {
            return BrsBoolean.from(this.getValue() < other.getValue());
        }
        return BrsBoolean.False;
    }

    greaterThan(other: BrsType): BrsBoolean {
        if (isStringComp(other)) {
            return BrsBoolean.from(this.getValue() > other.getValue());
        }
        return BrsBoolean.False;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (isStringComp(other)) {
            return BrsBoolean.from(this.getValue() === other.getValue());
        }
        return BrsBoolean.False;
    }

    concat(other: BrsType): BrsString {
        if (isStringComp(other)) {
            return new BrsString(this.getValue() + other.getValue());
        }
        return new BrsString(this.getValue() + other.toString());
    }

    /** Returns the type of event. */
    private readonly getInt = new Callable("getInt", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(1); // Transfer Complete
        },
    });

    /** Returns response code from the request. */
    private readonly getResponseCode = new Callable("getResponseCode", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.responseCode);
        },
    });

    /** Returns a description of the failure that occurred. */
    private readonly getFailureReason = new Callable("getFailureReason", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.failureReason);
        },
    });

    /** For transfer complete AsyncGetToString, AsyncPostFromString and AsnycPostFromFile requests this will be the actual response body from the server. */
    private readonly getString = new Callable("getString", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.responseString);
        },
    });

    /** Returns a unique number that can be matched with the value returned by roUrlTransfer.GetIdentity(). */
    private readonly getSourceIdentity = new Callable("getSourceIdentity", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.id);
        },
    });

    /** Returns an roAssociativeArray containing all the headers returned by the server for appropriate protocols (such as HTTP). */
    private readonly getResponseHeaders = new Callable("getResponseHeaders", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            let headers = new RoAssociativeArray([]);
            this.headers
                // for each line
                .split("\n")
                // remove leading/trailing whitespace
                .map((line) => line.trim())
                // separate keys and values
                .map((line, index) => {
                    // skip empty and invalid headers
                    let equals = line.indexOf(":");
                    if (line === "" || equals === -1) {
                        return ["", ""];
                    }
                    return [line.slice(0, equals), line.slice(equals + 1)];
                })
                // keep only non-empty keys and values
                .filter(([key, value]) => key && value)
                // remove leading/trailing whitespace from keys and values
                .map(([key, value]) => [key.trim(), value.trim()])
                .map(([key, value]) => {
                    headers.set(new BrsString(key), new BrsString(value));
                });
            return headers;
        },
    });

    /** Returns an array of roAssociativeArray, each AA contains a single header name/value pair. */
    /** Use this function if you need access to duplicate headers, since GetResponseHeaders() returns only the last name/value pair for a given name. */
    private readonly getResponseHeadersArray = new Callable("getResponseHeadersArray", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            let headers = new Array<RoAssociativeArray>();
            this.headers
                // for each line
                .split("\n")
                // remove leading/trailing whitespace
                .map((line) => line.trim())
                // separate keys and values
                .map((line, index) => {
                    // skip empty and invalid headers
                    let equals = line.indexOf(":");
                    if (line === "" || equals === -1) {
                        return ["", ""];
                    }
                    return [line.slice(0, equals), line.slice(equals + 1)];
                })
                // keep only non-empty keys and values
                .filter(([key, value]) => key && value)
                // remove leading/trailing whitespace from keys and values
                .map(([key, value]) => [key.trim(), value.trim()])
                .map(([key, value]) => {
                    let header = new RoAssociativeArray([]);
                    header.set(new BrsString(key), new BrsString(value));
                    headers.push(header);
                });
            return new RoArray(headers);
        },
    });

    /** Returns the IP address of the destination. */
    private readonly getTargetIpAddress = new Callable("getTargetIpAddress", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(resolveHostToIP(this.host) ?? "");
        },
    });
}
