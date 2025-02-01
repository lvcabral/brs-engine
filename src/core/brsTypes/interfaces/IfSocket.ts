import {
    BrsBoolean,
    BrsInvalid,
    BrsString,
    Callable,
    Int32,
    RoByteArray,
    RoSocketAddress,
    StdlibArgument,
    Uninitialized,
    ValueKind,
} from "..";
import { Interpreter } from "../../interpreter";
import * as net from "net";

/**
 * BrightScript Interface ifSocket
 * https://developer.roku.com/docs/references/brightscript/interfaces/ifsocket.md
 */

export class IfSocket {
    private readonly component: BrsSocket;

    constructor(value: BrsSocket) {
        this.component = value;
    }

    /** Sends up to length bytes of data to the socket. */
    readonly send = new Callable("send", {
        signature: {
            args: [
                new StdlibArgument("data", ValueKind.Object),
                new StdlibArgument("startIndex", ValueKind.Int32),
                new StdlibArgument("length", ValueKind.Int32),
            ],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, data: RoByteArray, startIndex: Int32, length: Int32) => {
            try {
                const sent = this.component.socket?.write(data.getByteArray());
                return new Int32(sent ? data.getElements().length : 0);
            } catch (err: any) {
                this.component.errorCode = err.code;
                return new Int32(0);
            }
        },
    });

    /** Sends the whole string to the socket, if possible. */
    readonly sendStr = new Callable("sendStr", {
        signature: {
            args: [new StdlibArgument("data", ValueKind.String)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, data: BrsString) => {
            try {
                const sent = this.component.socket?.write(data.value);
                return new Int32(sent ? data.value.length : 0);
            } catch (err: any) {
                this.component.errorCode = err.code ?? 3474;
                return new Int32(0);
            }
        },
    });

    /** Reads data from the socket. */
    readonly receive = new Callable("receive", {
        signature: {
            args: [
                new StdlibArgument("data", ValueKind.Object),
                new StdlibArgument("startIndex", ValueKind.Int32),
                new StdlibArgument("length", ValueKind.Int32),
            ],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, data: RoByteArray, startIndex: Int32, length: Int32) => {
            let buffer = Buffer.alloc(length.getValue());
            try {
                buffer = this.component.socket?.read(length.getValue()) ?? Buffer.alloc(0);
                return new Int32(buffer.length);
            } catch (err: any) {
                this.component.errorCode = err.code ?? 3474;
                return new Int32(0);
            }
        },
    });

    /** Reads data from the socket and stores the result in a string. */
    readonly receiveStr = new Callable("receiveStr", {
        signature: {
            args: [new StdlibArgument("length", ValueKind.Int32)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, length: Int32) => {
            try {
                const str = this.component.socket?.read(length.getValue()) ?? "";
                return new Int32(str.length);
            } catch (err: any) {
                this.component.errorCode = err.code ?? 3474;
                return new Int32(0);
            }
        },
    });

    /** Closes the socket */
    readonly close = new Callable("close", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.component.socket?.end();
            return Uninitialized.Instance;
        },
    });

    /** Sets the address for the socket */
    readonly setAddress = new Callable("setAddress", {
        signature: {
            args: [new StdlibArgument("sockAddr", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, sockAddr: RoSocketAddress) => {
            this.component.address = sockAddr;
            return BrsBoolean.True;
        },
    });

    /** Returns the port. */
    readonly getAddress = new Callable("getAddress", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.component.address ?? BrsInvalid.Instance;
        },
    });

    /** Sets the send-to address for the socket */
    readonly setSendToAddress = new Callable("setSendToAddress", {
        signature: {
            args: [new StdlibArgument("sockAddr", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, sockAddr: RoSocketAddress) => {
            this.component.sendToAddress = sockAddr;
            return BrsInvalid.Instance;
        },
    });

    /** Gets the send-to address of the socket */
    readonly getSendToAddress = new Callable("getSendToAddress", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.component.sendToAddress ?? BrsInvalid.Instance;
        },
    });

    /** Returns the roSocketAddress for the remote address of the last message received via the receive() method. */
    readonly getReceivedFromAddress = new Callable("getReceivedFromAddress", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            // Implementation of getReceivedFromAddress method
            return BrsInvalid.Instance;
        },
    });

    /** Gets the count of the receive buffer */
    readonly getCountRcvBuf = new Callable("getCountRcvBuf", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            // Implementation of getCountRcvBuf method
            return new Int32(0);
        },
    });

    /** Gets the count of the send buffer */
    readonly getCountSendBuf = new Callable("getCountSendBuf", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            // Implementation of getCountSendBuf method
            return new Int32(0);
        },
    });

    /** Gets the status of the socket */
    readonly status = new Callable("status", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.component.errorCode);
        },
    });
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
 * BrightScript Interface ifSocketAsync
 * https://developer.roku.com/docs/references/brightscript/interfaces/ifsocketasync.md
 */

export class IfSocketAsync {
    private readonly component: BrsSocket;

    constructor(value: BrsSocket) {
        this.component = value;
    }

    /** Checks if the socket is readable */
    readonly isReadable = new Callable("isReadable", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.component.socket?.readable ?? false);
        },
    });

    /** Checks if the socket is writable */
    readonly isWritable = new Callable("isWritable", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.component.socket?.writable ?? false);
        },
    });

    /** Checks if the socket has an exception */
    readonly isException = new Callable("isException", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            // Implementation of isException method
            return BrsBoolean.False;
        },
    });

    /** Notifies when the socket is readable */
    readonly notifyReadable = new Callable("notifyReadable", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // Implementation of notifyReadable method
            return Uninitialized.Instance;
        },
    });

    /** Notifies when the socket is writable */
    readonly notifyWritable = new Callable("notifyWritable", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // Implementation of notifyWritable method
            return Uninitialized.Instance;
        },
    });

    /** Notifies when the socket has an exception */
    readonly notifyException = new Callable("notifyException", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            // Implementation of notifyException method
            return Uninitialized.Instance;
        },
    });

    /** Gets the ID of the socket */
    readonly getID = new Callable("getID", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.component.identity);
        },
    });
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
