import {
    Callable,
    ValueKind,
    StdlibArgument,
    BrsBoolean,
    BrsType,
    BrsValue,
    Int32,
    RoSocketAddress,
    RoSocketEvent,
    RoByteArray,
    BrsString,
    BrsInvalid,
    BrsEvent,
    Uninitialized,
} from "..";
import { BrsComponent } from "./BrsComponent";
import { RoMessagePort } from "./RoMessagePort";
import { Interpreter } from "../../interpreter";
import { BrsSocket, GENERIC_SOCKET_ERROR, IfSocketOption, IfSocketStatus } from "../interfaces/IfSocket";
import { IfGetMessagePort, IfSetMessagePort } from "../interfaces/IfMessagePort";
import { AcceptedConnection, StreamBridge } from "../../device/StreamBridge";
import { BrsDevice } from "../../device/BrsDevice";
import type * as net from "net";

// "connected" covers both an outbound Connect() and an Accept()ed connection — nothing in this
// file ever needs to tell those two apart once established (same close path, same event-polling
// path); `connId` (set only for an accepted connection) already carries the one distinction that
// does matter, which bridge calls it every connected socket makes.
type SocketRole = "unbound" | "listener" | "connected";

interface AcceptedInit {
    bridge: StreamBridge;
    connId: number;
    peerHost: string;
    peerPort: number;
}

export class RoStreamSocket extends BrsComponent implements BrsValue, BrsSocket {
    readonly kind = ValueKind.Object;
    /** Unused on Node — kept only to satisfy the shared `BrsSocket` shape used by `IfSocketStatus`/`IfSocketOption`. */
    readonly socket?: net.Socket;
    readonly identity: number;
    private readonly callbackKey: string;
    private readonly port?: RoMessagePort;
    private role: SocketRole;
    private bridge?: StreamBridge;
    private readonly connId?: number;
    private recvBuffer: Buffer;
    private peerClosed: boolean;
    private listening: boolean;
    private readonly pendingAccepts: AcceptedConnection[];
    private notifyReadableEnabled: boolean;
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
    connected: boolean;
    keepAlive: boolean;
    linger: number;
    maxSeg: number;
    noDelay: boolean;

    /** Only used by `Accept()` to wrap a connection born inside the listener's own helper process. */
    constructor(accepted?: AcceptedInit) {
        super("roStreamSocket");
        this.errorCode = 0;
        this.ttl = 0;
        this.reuseAddr = false;
        this.inline = false;
        this.sendBufferSize = 0;
        this.recvBufferSize = 0;
        this.sendTimeout = 0;
        this.recvTimeout = 0;
        this.recvBuffer = Buffer.alloc(0);
        this.peerClosed = false;
        this.listening = false;
        this.pendingAccepts = [];
        this.notifyReadableEnabled = false;
        this.connected = false;
        this.keepAlive = false;
        this.linger = 0;
        this.maxSeg = 0;
        this.noDelay = false;
        this.identity = generateUniqueId();
        this.callbackKey = `roStreamSocket:${this.identity}`;
        if (accepted) {
            this.role = "connected";
            this.bridge = accepted.bridge;
            this.connId = accepted.connId;
            this.connected = true;
            const peer = new RoSocketAddress();
            peer.setFromResolved(accepted.peerHost, accepted.peerPort);
            this.sendToAddress = peer;
        } else {
            this.role = "unbound";
        }
        const ifSocketStatus = new IfSocketStatus(this);
        const ifSocketOption = new IfSocketOption(this);
        const setPortIface = new IfSetMessagePort(this, this.getNewEvents.bind(this), this.callbackKey);
        const getPortIface = new IfGetMessagePort(this);
        this.registerMethods({
            ifSocketConnection: [this.listen, this.isListening, this.connect, this.accept, this.isConnected],
            ifSocket: [
                this.send,
                this.sendStr,
                this.receive,
                this.receiveStr,
                this.close,
                this.setAddress,
                this.getAddress,
                this.setSendToAddress,
                this.getSendToAddress,
                this.getReceivedFromAddress,
                this.getCountRcvBuf,
                this.getCountSendBuf,
                this.status,
            ],
            ifSocketAsync: [
                this.isReadable,
                this.isWritable,
                this.isException,
                this.notifyReadable,
                this.notifyWritable,
                this.notifyException,
                this.getID,
            ],
            ifSocketStatus: [
                ifSocketStatus.eAgain,
                ifSocketStatus.eAlready,
                ifSocketStatus.eBadAddr,
                ifSocketStatus.eDestAddrReq,
                ifSocketStatus.eHostUnreach,
                ifSocketStatus.eInvalid,
                ifSocketStatus.eInProgress,
                ifSocketStatus.eWouldBlock,
                ifSocketStatus.eSuccess,
                ifSocketStatus.eOK,
            ],
            ifSocketOption: [
                ifSocketOption.getTTL,
                ifSocketOption.setTTL,
                ifSocketOption.getReuseAddr,
                ifSocketOption.setReuseAddr,
                ifSocketOption.getOOBInline,
                ifSocketOption.setOOBInline,
                ifSocketOption.getSendBuf,
                ifSocketOption.setSendBuf,
                ifSocketOption.getRcvBuf,
                ifSocketOption.setRcvBuf,
                ifSocketOption.getSendTimeout,
                ifSocketOption.setSendTimeout,
                ifSocketOption.getReceiveTimeout,
                ifSocketOption.setReceiveTimeout,
            ],
            ifSocketConnectionStatus: [
                this.eConnAborted,
                this.eConnRefused,
                this.eConnReset,
                this.eIsConn,
                this.eNotConn,
            ],
            ifSocketConnectionOption: [
                this.getKeepAlive,
                this.setKeepAlive,
                this.getLinger,
                this.setLinger,
                this.getMaxSeg,
                this.setMaxSeg,
                this.getNoDelay,
                this.setNoDelay,
            ],
            ifSetMessagePort: [setPortIface.setMessagePort],
            ifGetMessagePort: [getPortIface.getMessagePort],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roStreamSocket>";
    }

    equalTo(other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }

    dispose() {
        this.port?.unregisterCallback(this.getComponentName(), this.callbackKey);
        this.bridge?.close(this.connId);
    }

    /** Lazily creates this socket's bridge, shared by `listen()`/`connect()`. */
    private ensureBridge(): StreamBridge {
        this.bridge ??= new StreamBridge((message: string) => BrsDevice.stderr.write(`warning,${message}`));
        return this.bridge;
    }

    /** Guards `listen()`/`connect()`: each socket supports exactly one bind-or-connect attempt. */
    private requireUnbound(): boolean {
        if (this.role !== "unbound") {
            this.errorCode = GENERIC_SOCKET_ERROR;
            return false;
        }
        return true;
    }

    /** Polled once per `Wait()`/message-port iteration; only produces events once NotifyReadable(true). */
    private getNewEvents(): BrsEvent[] {
        if (!this.bridge) {
            return [];
        }
        let changed = false;
        if (this.role === "listener") {
            const accepted = this.bridge.pollListener();
            if (accepted.length > 0) {
                this.pendingAccepts.push(...accepted);
                changed = true;
            }
        } else if (this.role === "connected" && !this.peerClosed) {
            // Once the peer has closed, nothing more will ever arrive on this connection's queue
            // file — skip the fs.statSync every tick instead of polling a channel that's done.
            const received = this.bridge.pollConnection(this.connId);
            const chunks: Buffer[] = [];
            for (const entry of received) {
                if (entry.errorCode !== undefined) {
                    this.errorCode = entry.errorCode;
                    changed = true;
                } else if (entry.ended) {
                    this.peerClosed = true;
                    changed = true;
                } else if (entry.data.length > 0) {
                    chunks.push(entry.data);
                    changed = true;
                }
            }
            if (chunks.length > 0) {
                // Concat once for the whole batch — concatenating inside the loop would re-copy
                // the already-accumulated buffer on every entry (quadratic in the batch size).
                this.recvBuffer = Buffer.concat([this.recvBuffer, ...chunks]);
            }
        }
        if (!changed || !this.notifyReadableEnabled) {
            return [];
        }
        return [new RoSocketEvent(this.identity)];
    }

    // ifSocketConnection -----------------------------------------------------------------------------

    /** Puts the socket into the listen state. */
    private readonly listen = new Callable("listen", {
        signature: {
            args: [new StdlibArgument("backlog", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, backlog: Int32) => {
            if (!this.requireUnbound()) {
                return BrsBoolean.False;
            }
            const bridge = this.ensureBridge();
            const resolved = this.address?.getResolved();
            const bindHost = !resolved || resolved.host === "0.0.0.0" ? undefined : resolved.host;
            const result = bridge.listen(bindHost, resolved?.port ?? 0, backlog.getValue());
            this.errorCode = result.errorCode;
            if (result.ok) {
                this.role = "listener";
                this.listening = true;
                if (result.boundPort !== undefined) {
                    this.address ??= new RoSocketAddress();
                    this.address.setFromResolved(resolved?.host ?? "0.0.0.0", result.boundPort);
                }
            }
            return BrsBoolean.from(result.ok);
        },
    });

    /** Checks whether the listen() method has been successfully called on this socket. */
    private readonly isListening = new Callable("isListening", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.listening);
        },
    });

    /** Establishes a connection to the peer set via SetSendToAddress(). */
    private readonly connect = new Callable("connect", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            if (!this.requireUnbound()) {
                return BrsBoolean.False;
            }
            const peer = this.sendToAddress?.getResolved();
            if (!peer?.valid) {
                this.errorCode = 39; // EDESTADDRREQ
                return BrsBoolean.False;
            }
            const bridge = this.ensureBridge();
            const result = bridge.connect(peer.host, peer.port);
            this.errorCode = result.errorCode;
            if (result.ok) {
                this.role = "connected";
                this.connected = true;
            }
            return BrsBoolean.from(result.ok);
        },
    });

    /** Accepts an incoming connection, returning a new roStreamSocket or invalid if none is pending. */
    private readonly accept = new Callable("accept", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            if (this.role !== "listener" || !this.bridge) {
                return BrsInvalid.Instance;
            }
            const entry = this.pendingAccepts.shift();
            if (!entry) {
                return BrsInvalid.Instance;
            }
            return new RoStreamSocket({
                bridge: this.bridge,
                connId: entry.connId,
                peerHost: entry.host,
                peerPort: entry.port,
            });
        },
    });

    /** Checks if the socket is connected */
    private readonly isConnected = new Callable("isConnected", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.connected);
        },
    });

    // ifSocket -----------------------------------------------------------------------------------------

    /** Sends up to length bytes of data to the socket. */
    private readonly send = new Callable("send", {
        signature: {
            args: [
                new StdlibArgument("data", ValueKind.Object),
                new StdlibArgument("startIndex", ValueKind.Int32),
                new StdlibArgument("length", ValueKind.Int32),
            ],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, data: RoByteArray, startIndex: Int32, length: Int32) => {
            // A negative index isn't rejected — clamped, since Uint8Array.subarray treats a
            // negative start as an offset from the END (like Array.slice), which would silently
            // send bytes from the tail of the array instead of failing.
            const start = Math.max(0, startIndex.getValue());
            const len = Math.max(0, length.getValue());
            const bytes = data.getByteArray().subarray(start, start + len);
            return new Int32(this.sendBytes(Buffer.from(bytes)));
        },
    });

    /** Sends the whole string to the socket, if possible. */
    private readonly sendStr = new Callable("sendStr", {
        signature: {
            args: [new StdlibArgument("data", ValueKind.String)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, data: BrsString) => {
            return new Int32(this.sendBytes(Buffer.from(data.value, "utf8")));
        },
    });

    private sendBytes(buffer: Buffer): number {
        if (!this.bridge || !this.connected) {
            this.errorCode = GENERIC_SOCKET_ERROR;
            return 0;
        }
        const result = this.bridge.send(buffer, this.connId);
        this.errorCode = result.errorCode;
        return result.bytesSent;
    }

    /** Reads up to length bytes from the stream buffer. */
    private readonly receive = new Callable("receive", {
        signature: {
            args: [
                new StdlibArgument("data", ValueKind.Object),
                new StdlibArgument("startIndex", ValueKind.Int32),
                new StdlibArgument("length", ValueKind.Int32),
            ],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, data: RoByteArray, startIndex: Int32, length: Int32) => {
            const bytes = this.popBytes(length.getValue());
            if (bytes.length === 0) {
                return new Int32(0);
            }
            // A negative index isn't rejected — clamped, since TypedArray.set() throws a
            // RangeError for a negative offset instead of failing gracefully.
            const start = Math.max(0, startIndex.getValue());
            const needed = start + bytes.length;
            if (needed > data.elements.length) {
                const expanded = new Uint8Array(needed);
                expanded.set(data.elements);
                data.elements = expanded;
            }
            data.elements.set(bytes, start);
            return new Int32(bytes.length);
        },
    });

    /** Reads up to length bytes from the stream buffer and stores the result in a string. */
    private readonly receiveStr = new Callable("receiveStr", {
        signature: {
            args: [new StdlibArgument("length", ValueKind.Int32)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, length: Int32) => {
            const bytes = this.popBytes(length.getValue());
            return new BrsString(Buffer.from(bytes).toString("utf8"));
        },
    });

    /** Drains up to maxLength bytes off the front of the stream buffer, leaving the remainder queued
     *  (TCP is a byte stream, unlike UDP's one-datagram-per-receive). */
    private popBytes(maxLength: number): Uint8Array {
        const take = Math.min(Math.max(0, maxLength), this.recvBuffer.length);
        if (take === 0) {
            return new Uint8Array(0);
        }
        const bytes = new Uint8Array(this.recvBuffer.subarray(0, take));
        this.recvBuffer = this.recvBuffer.subarray(take);
        return bytes;
    }

    /** Closes the socket. After a close, most operations return invalid. */
    private readonly close = new Callable("close", {
        signature: { args: [], returns: ValueKind.Void },
        impl: (_: Interpreter) => {
            this.bridge?.close(this.connId);
            this.connected = false;
            this.listening = false;
            return Uninitialized.Instance;
        },
    });

    /** Sets the local address to bind to on Listen(). */
    private readonly setAddress = new Callable("setAddress", {
        signature: {
            args: [new StdlibArgument("sockAddr", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, sockAddr: RoSocketAddress) => {
            this.address = sockAddr;
            return BrsBoolean.True;
        },
    });

    /** Returns the roSocketAddress bound to this socket. */
    private readonly getAddress = new Callable("getAddress", {
        signature: { args: [], returns: ValueKind.Object },
        impl: (_: Interpreter) => {
            return this.address ?? BrsInvalid.Instance;
        },
    });

    /** Sets the remote address for Connect(). */
    private readonly setSendToAddress = new Callable("setSendToAddress", {
        signature: {
            args: [new StdlibArgument("sockAddr", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, sockAddr: RoSocketAddress) => {
            this.sendToAddress = sockAddr;
            return BrsInvalid.Instance;
        },
    });

    /** Gets the remote address for Connect(), or the peer address on an accepted connection. */
    private readonly getSendToAddress = new Callable("getSendToAddress", {
        signature: { args: [], returns: ValueKind.Object },
        impl: (_: Interpreter) => {
            return this.sendToAddress ?? BrsInvalid.Instance;
        },
    });

    /** Returns the roSocketAddress for the connected peer (TCP has a single peer per connection). */
    private readonly getReceivedFromAddress = new Callable("getReceivedFromAddress", {
        signature: { args: [], returns: ValueKind.Object },
        impl: (_: Interpreter) => {
            return this.sendToAddress ?? BrsInvalid.Instance;
        },
    });

    /** Bytes currently queued and waiting to be Receive()d. */
    private readonly getCountRcvBuf = new Callable("getCountRcvBuf", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(this.recvBuffer.length);
        },
    });

    /** Not tracked — sends are handed to the OS/helper synchronously. */
    private readonly getCountSendBuf = new Callable("getCountSendBuf", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(0);
        },
    });

    /** Indicates whether the last operation was successful (0) or an error number if it failed. */
    private readonly status = new Callable("status", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(this.errorCode);
        },
    });

    // ifSocketAsync ---------------------------------------------------------------------------------

    /** True when a listener has a pending connection, or a connection has buffered/EOF data. */
    private readonly isReadable = new Callable("isReadable", {
        signature: { args: [], returns: ValueKind.Boolean },
        impl: (_: Interpreter) => {
            if (this.role === "listener") {
                return BrsBoolean.from(this.pendingAccepts.length > 0);
            }
            return BrsBoolean.from(this.recvBuffer.length > 0 || this.peerClosed);
        },
    });

    /** True once the connection has completed and the peer hasn't closed it. */
    private readonly isWritable = new Callable("isWritable", {
        signature: { args: [], returns: ValueKind.Boolean },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.connected && !this.peerClosed);
        },
    });

    /** Out-of-band data is not modeled. */
    private readonly isException = new Callable("isException", {
        signature: { args: [], returns: ValueKind.Boolean },
        impl: (_: Interpreter) => {
            return BrsBoolean.False;
        },
    });

    /** Enables/disables roSocketEvent delivery when a connection is pending or data/EOF arrives. */
    private readonly notifyReadable = new Callable("notifyReadable", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            this.notifyReadableEnabled = enable.toBoolean();
            return Uninitialized.Instance;
        },
    });

    /** Not implemented — writable-notification isn't modeled. */
    private readonly notifyWritable = new Callable("notifyWritable", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            return Uninitialized.Instance;
        },
    });

    /** Not implemented — out-of-band data isn't modeled. */
    private readonly notifyException = new Callable("notifyException", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            return Uninitialized.Instance;
        },
    });

    /** Returns a unique identifier matched against roSocketEvent.GetSocketID(). */
    private readonly getID = new Callable("getID", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(this.identity);
        },
    });

    // ifSocketConnectionStatus -----------------------------------------------------------------------

    /** Returns the ECONNABORTED status */
    private readonly eConnAborted = new Callable("eConnAborted", {
        signature: { args: [], returns: ValueKind.Boolean },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.errorCode === 103); // ECONNABORTED error code
        },
    });

    /** Returns the ECONNREFUSED status */
    private readonly eConnRefused = new Callable("eConnRefused", {
        signature: { args: [], returns: ValueKind.Boolean },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.errorCode === 111); // ECONNREFUSED error code
        },
    });

    /** Returns the ECONNRESET status */
    private readonly eConnReset = new Callable("eConnReset", {
        signature: { args: [], returns: ValueKind.Boolean },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.errorCode === 104); // ECONNRESET error code
        },
    });

    /** Checks whether the socket is currently connected. */
    private readonly eIsConn = new Callable("eIsConn", {
        signature: { args: [], returns: ValueKind.Boolean },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.connected);
        },
    });

    /** Checks whether the socket is currently not connected. */
    private readonly eNotConn = new Callable("eNotConn", {
        signature: { args: [], returns: ValueKind.Boolean },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(!this.connected);
        },
    });

    // ifSocketConnectionOption -------------------------------------------------------------------------

    /** Checks whether periodic keep-alive packets are enabled. */
    private readonly getKeepAlive = new Callable("getKeepAlive", {
        signature: { args: [], returns: ValueKind.Boolean },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.keepAlive);
        },
    });

    /** Real pass-through to net.Socket.setKeepAlive(). */
    private readonly setKeepAlive = new Callable("setKeepAlive", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            if (!this.bridge) {
                return BrsBoolean.False;
            }
            const result = this.bridge.setKeepAlive(enable.toBoolean(), this.connId);
            this.errorCode = result.errorCode;
            this.keepAlive = result.ok ? enable.toBoolean() : this.keepAlive;
            return BrsBoolean.from(result.ok);
        },
    });

    /** Returns the number of seconds Close() blocks trying to flush pending data (sync mode). */
    private readonly getLinger = new Callable("getLinger", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(this.linger);
        },
    });

    /** Sets the number of seconds Close() blocks trying to flush pending data. Stored, not enforced
     *  — Node's `net` module exposes no public SO_LINGER hook. */
    private readonly setLinger = new Callable("setLinger", {
        signature: {
            args: [new StdlibArgument("time", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, time: Int32) => {
            this.linger = time.getValue();
            return BrsBoolean.True;
        },
    });

    /** Returns the maximum TCP segment size. */
    private readonly getMaxSeg = new Callable("getMaxSeg", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(this.maxSeg);
        },
    });

    /** Sets the maximum TCP segment size. Stored, not enforced — Node's `net` module exposes no
     *  public TCP_MAXSEG hook. */
    private readonly setMaxSeg = new Callable("setMaxSeg", {
        signature: {
            args: [new StdlibArgument("time", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, time: Int32) => {
            this.maxSeg = time.getValue();
            return BrsBoolean.True;
        },
    });

    /** Checks whether TCP_NODELAY (immediate send, no Nagle batching) is enabled. */
    private readonly getNoDelay = new Callable("getNoDelay", {
        signature: { args: [], returns: ValueKind.Boolean },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.noDelay);
        },
    });

    /** Real pass-through to net.Socket.setNoDelay() (TCP_NODELAY). */
    private readonly setNoDelay = new Callable("setNoDelay", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            if (!this.bridge) {
                return BrsBoolean.False;
            }
            const result = this.bridge.setNoDelay(enable.toBoolean(), this.connId);
            this.errorCode = result.errorCode;
            this.noDelay = result.ok ? enable.toBoolean() : this.noDelay;
            return BrsBoolean.from(result.ok);
        },
    });
}

function generateUniqueId(): number {
    const min = 10000000;
    const max = 99999999;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
