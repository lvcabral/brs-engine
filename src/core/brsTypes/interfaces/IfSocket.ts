import { BrsBoolean, Callable, Int32, RoSocketAddress, StdlibArgument, ValueKind } from "..";
import { Interpreter } from "../../interpreter";
import type * as net from "net";

/** Generic socket failure, used when a host error maps to nothing `ifSocketStatus` recognizes. */
export const GENERIC_SOCKET_ERROR = 3474;

/**
 * Host error names mapped to the numeric codes `ifSocketStatus` compares against.
 *
 * Node reports a failure as a *name* (`err.code`, e.g. "EPIPE") plus `err.errno`, whose numeric value
 * is the host platform's — and those differ (EAGAIN is 11 on Linux, 35 on BSD/macOS). The status
 * predicates test fixed numbers, so mapping the stable name is what keeps `eAgain()` and friends
 * answering the same thing regardless of where the simulator runs. Values follow Roku's Linux base,
 * matching the constants those predicates already assert.
 */
const SOCKET_ERROR_CODES: Record<string, number> = {
    EAGAIN: 11,
    EWOULDBLOCK: 35,
    EALREADY: 114,
    EBADADDR: 14,
    EBADF: 14,
    EINVAL: 22,
    EINPROGRESS: 36,
    EDESTADDRREQ: 39,
    EHOSTUNREACH: 65,
    ECONNABORTED: 103,
    ECONNREFUSED: 111,
    ECONNRESET: 104,
};

/**
 * Normalizes a host socket error to the numeric code BrightScript reads back.
 *
 * `errorCode` is typed `number` and surfaces through `ifSocket.status()` as an `Int32` and through
 * every `ifSocketStatus` predicate as an equality test. Assigning `err.code` straight through put a
 * *string* there, so `status()` produced garbage and every predicate answered false.
 * @param err Error thrown by, or emitted from, a Node socket.
 * @returns A numeric code, or `GENERIC_SOCKET_ERROR` when the error maps to nothing known.
 */
export function socketErrorCode(err: any): number {
    const name = typeof err?.code === "string" ? SOCKET_ERROR_CODES[err.code.toUpperCase()] : undefined;
    if (name !== undefined) {
        return name;
    }
    // `errno` is the host's own value, so it is a fallback rather than the primary source.
    return typeof err?.errno === "number" && err.errno !== 0 ? Math.abs(err.errno) : GENERIC_SOCKET_ERROR;
}

export interface BrsSocket {
    readonly socket?: net.Socket;
    readonly identity: number;
    address?: RoSocketAddress;
    sendToAddress?: RoSocketAddress;
    ttl: number;
    reuseAddr: boolean;
    inline: boolean;
    sendBufferSize: number;
    recvBufferSize: number;
    sendTimeout: number;
    recvTimeout: number;
    errorCode: number;
}

/**
 * BrightScript Interface ifSocketStatus
 * https://developer.roku.com/docs/references/brightscript/interfaces/ifsocketstatus.md
 */

export class IfSocketStatus {
    private readonly component: BrsSocket;

    constructor(value: BrsSocket) {
        this.component = value;
    }
    /** Returns the EAGAIN status */
    readonly eAgain = new Callable("eAgain", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.component.errorCode === 11); // EAGAIN error code
        },
    });

    /** Returns the EALREADY status */
    readonly eAlready = new Callable("eAlready", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.component.errorCode === 114); // EALREADY error code
        },
    });

    /** Returns the EBADADDR status */
    readonly eBadAddr = new Callable("eBadAddr", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.component.errorCode === 14); // EBADADDR error code
        },
    });

    /** Returns the EDESTADDRREQ status */
    readonly eDestAddrReq = new Callable("eDestAddrReq", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.component.errorCode === 39); // EDESTADDRREQ error code
        },
    });

    /** Returns the EHOSTUNREACH status */
    readonly eHostUnreach = new Callable("eHostUnreach", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.component.errorCode === 65); // EHOSTUNREACH error code
        },
    });

    /** Returns the EINVALID status */
    readonly eInvalid = new Callable("eInvalid", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.component.errorCode === 22); // EINVALID error code
        },
    });

    /** Returns the EINPROGRESS status */
    readonly eInProgress = new Callable("eInProgress", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.component.errorCode === 36); // EINPROGRESS error code
        },
    });

    /** Returns the EWOULDBLOCK status */
    readonly eWouldBlock = new Callable("eWouldBlock", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.component.errorCode === 35); // EWOULDBLOCK error code
        },
    });

    /** Checks whether there are no errors (the error number is 0). */
    readonly eSuccess = new Callable("eSuccess", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            // Implementation of eSuccess method
            return BrsBoolean.from(this.component.errorCode === 0);
        },
    });

    /** Checks whether there is no hard error, but possibly one of the following async conditions: EAGAIN, EALREADY, EINPROGRESS, EWOULDBLOCK. */
    readonly eOK = new Callable("eOK", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            // Implementation of eOK method
            return BrsBoolean.from(this.component.errorCode === 0);
        },
    });
}

/**
 * BrightScript Interface ifSocketOption
 * https://developer.roku.com/docs/references/brightscript/interfaces/ifsocketoption.md
 */

export class IfSocketOption {
    private readonly component: BrsSocket;

    constructor(value: BrsSocket) {
        this.component = value;
    }
    /** Returns the TTL (Time To Live) value for all IP packets on the socket. */
    readonly getTTL = new Callable("getTTL", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            // mock implementation
            return new Int32(this.component.ttl);
        },
    });

    /** Enables broadcast messages to be sent or received. */
    readonly setTTL = new Callable("setTTL", {
        signature: {
            args: [new StdlibArgument("ttl", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, ttl: Int32) => {
            this.component.ttl = ttl.getValue();
            return BrsBoolean.True;
        },
    });

    /** Checks whether an address that has been previously assigned can be immediately reassigned. */
    readonly getReuseAddr = new Callable("getMulticastLoop", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.component.reuseAddr);
        },
    });

    /** Enables a previously assigned address to be immediately reassigned. */
    readonly setReuseAddr = new Callable("setReuseAddr", {
        signature: {
            args: [new StdlibArgument("reuse", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, reuse: BrsBoolean) => {
            this.component.reuseAddr = reuse.toBoolean();
            return BrsBoolean.True;
        },
    });

    /** Checks whether Out Of Bounds (OOB) data is read inline with regular data. */
    readonly getOOBInline = new Callable("setOOBInline", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.component.inline);
        },
    });

    /** Enables Out Of Bounds (OOB) data to be read inline with regular data. */
    readonly setOOBInline = new Callable("setOOBInline", {
        signature: {
            args: [new StdlibArgument("inline", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, inline: BrsBoolean) => {
            this.component.inline = inline.toBoolean();
            return BrsBoolean.True;
        },
    });

    /** Returns the current send buffer size. */
    readonly getSendBuf = new Callable("getSendBuf", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.component.sendBufferSize);
        },
    });

    /** A flag indicating whether the send buffer size was successfully set. */
    readonly setSendBuf = new Callable("setSendBuf", {
        signature: {
            args: [new StdlibArgument("size", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, size: Int32) => {
            this.component.sendBufferSize = size.getValue();
            return BrsBoolean.True;
        },
    });
    /** Returns the current receive buffer size. */
    readonly getRcvBuf = new Callable("getRcvBuf", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.component.recvBufferSize);
        },
    });

    /** A flag indicating whether the receive buffer size was successfully set. */
    readonly setRcvBuf = new Callable("setRcvBuf", {
        signature: {
            args: [new StdlibArgument("size", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, size: Int32) => {
            this.component.recvBufferSize = size.getValue();
            return BrsBoolean.True;
        },
    });
    /** Returns the current send timeout. */
    readonly getSendTimeout = new Callable("getSendTimeout", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.component.sendTimeout);
        },
    });

    /** A flag indicating whether the send timeout was successfully set. */
    readonly setSendTimeout = new Callable("setSendTimeout", {
        signature: {
            args: [new StdlibArgument("timeout", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, timeout: Int32) => {
            this.component.sendTimeout = timeout.getValue();
            return BrsBoolean.True;
        },
    });
    /** Returns the current receive timeout. */
    readonly getReceiveTimeout = new Callable("getReceiveTimeout", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.component.recvTimeout);
        },
    });

    /** A flag indicating whether the receive timeout was successfully set. */
    readonly setReceiveTimeout = new Callable("setReceiveTimeout", {
        signature: {
            args: [new StdlibArgument("timeout", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, timeout: Int32) => {
            this.component.recvTimeout = timeout.getValue();
            return BrsBoolean.True;
        },
    });
}
