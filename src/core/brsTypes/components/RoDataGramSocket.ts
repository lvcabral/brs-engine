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
import { BrsSocket, IfSocketOption, IfSocketStatus } from "../interfaces/IfSocket";
import { IfGetMessagePort, IfSetMessagePort } from "../interfaces/IfMessagePort";
import { DatagramBridge, DatagramReceived } from "../../device/DatagramBridge";
import { BrsDevice } from "../../device/BrsDevice";
import type * as net from "net";

/** One popped-or-pending inbound datagram, kept around so GetReceivedFromAddress() can report its sender. */
interface QueuedDatagram {
    data: Uint8Array;
    fromHost: string;
    fromPort: number;
}

export class RoDataGramSocket extends BrsComponent implements BrsValue, BrsSocket {
    readonly kind = ValueKind.Object;
    /** Unused on Node — kept only to satisfy the shared `BrsSocket` shape used by `IfSocketStatus`/`IfSocketOption`. */
    readonly socket?: net.Socket;
    readonly identity: number;
    private readonly bridge: DatagramBridge;
    private readonly port?: RoMessagePort;
    private broadcast: boolean;
    private notifyReadableEnabled: boolean;
    private readonly recvQueue: QueuedDatagram[];
    private lastReceivedFrom?: { host: string; port: number };
    private multicastLoop: boolean;
    private multicastTTL: number;
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

    constructor() {
        super("roDataGramSocket");
        this.errorCode = 0;
        this.broadcast = false;
        this.notifyReadableEnabled = false;
        this.recvQueue = [];
        this.multicastLoop = false;
        this.multicastTTL = 0;
        this.ttl = 0;
        this.reuseAddr = false;
        this.inline = false;
        this.sendBufferSize = 0;
        this.recvBufferSize = 0;
        this.sendTimeout = 0;
        this.recvTimeout = 0;
        this.identity = generateUniqueId();
        this.bridge = new DatagramBridge((message: string) => BrsDevice.stderr.write(`warning,${message}`));
        const ifSocketStatus = new IfSocketStatus(this);
        const ifSocketOption = new IfSocketOption(this);
        const setPortIface = new IfSetMessagePort(this, this.getNewEvents.bind(this));
        const getPortIface = new IfGetMessagePort(this);
        this.registerMethods({
            ifSocketCastOption: [
                this.getBroadcast,
                this.setBroadcast,
                this.joinGroup,
                this.dropGroup,
                this.getMulticastLoop,
                this.setMulticastLoop,
                this.getMulticastTTL,
                this.setMulticastTTL,
            ],
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
            ifSetMessagePort: [setPortIface.setMessagePort],
            ifGetMessagePort: [getPortIface.getMessagePort],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roDataGramSocket>";
    }

    equalTo(other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }

    dispose() {
        this.port?.unregisterCallback(this.getComponentName());
        this.bridge.close();
    }

    /** Polled once per `Wait()`/message-port iteration; only produces events once NotifyReadable(true). */
    private getNewEvents(): BrsEvent[] {
        if (!this.notifyReadableEnabled) {
            return [];
        }
        const received: DatagramReceived[] = this.bridge.poll();
        if (received.length === 0) {
            return [];
        }
        for (const entry of received) {
            this.recvQueue.push({
                data: new Uint8Array(entry.data),
                fromHost: entry.fromHost,
                fromPort: entry.fromPort,
            });
        }
        return [new RoSocketEvent(this.identity)];
    }

    // ifSocket ------------------------------------------------------------------------------------

    /** Sends up to length bytes of data to the socket's SendToAddress. */
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
            const start = startIndex.getValue();
            const len = Math.max(0, length.getValue());
            const bytes = data.getByteArray().subarray(start, start + len);
            return new Int32(this.sendBytes(Buffer.from(bytes)));
        },
    });

    /** Sends the whole string to the socket's SendToAddress. */
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
        const to = this.sendToAddress?.getResolved();
        if (!to?.valid) {
            this.errorCode = 39; // EDESTADDRREQ
            return 0;
        }
        const result = this.bridge.send(buffer, to.host, to.port);
        this.errorCode = result.errorCode;
        return result.bytesSent;
    }

    /** Reads one queued datagram into the given byte array, starting at startIndex. */
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
            const bytes = this.popDatagram(length.getValue());
            if (bytes.length === 0) {
                return new Int32(0);
            }
            const start = startIndex.getValue();
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

    /** Reads one queued datagram and stores the result in a string. */
    private readonly receiveStr = new Callable("receiveStr", {
        signature: {
            args: [new StdlibArgument("length", ValueKind.Int32)],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, length: Int32) => {
            const bytes = this.popDatagram(length.getValue());
            return new BrsString(Buffer.from(bytes).toString("utf8"));
        },
    });

    /** Pops the oldest queued datagram (UDP is message-oriented — one receive = one datagram), truncated to maxLength. */
    private popDatagram(maxLength: number): Uint8Array {
        const entry = this.recvQueue.shift();
        if (!entry) {
            return new Uint8Array(0);
        }
        this.lastReceivedFrom = { host: entry.fromHost, port: entry.fromPort };
        return entry.data.subarray(0, Math.max(0, maxLength));
    }

    /** Closes the socket. After a close, most operations return invalid. */
    private readonly close = new Callable("close", {
        signature: { args: [], returns: ValueKind.Void },
        impl: (_: Interpreter) => {
            this.bridge.close();
            return Uninitialized.Instance;
        },
    });

    /** Binds the socket via a BSD bind() call, matching ifSocket.SetAddress. */
    private readonly setAddress = new Callable("setAddress", {
        signature: {
            args: [new StdlibArgument("sockAddr", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, sockAddr: RoSocketAddress) => {
            this.address = sockAddr;
            const resolved = sockAddr.getResolved();
            const bindHost = resolved.host === "0.0.0.0" ? undefined : resolved.host;
            const result = this.bridge.bind(resolved.port, bindHost);
            this.errorCode = result.errorCode;
            if (result.ok && result.boundPort !== undefined) {
                // Reflect the OS-assigned port back onto the address (e.g. after binding port 0).
                sockAddr.setFromResolved(resolved.host, result.boundPort);
            }
            return BrsBoolean.from(result.ok);
        },
    });

    /** Returns the roSocketAddress bound to this socket. */
    private readonly getAddress = new Callable("getAddress", {
        signature: { args: [], returns: ValueKind.Object },
        impl: (_: Interpreter) => {
            return this.address ?? BrsInvalid.Instance;
        },
    });

    /** Sets the remote address for the next message(s) sent. */
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

    /** Gets the remote address for the next message(s) sent. */
    private readonly getSendToAddress = new Callable("getSendToAddress", {
        signature: { args: [], returns: ValueKind.Object },
        impl: (_: Interpreter) => {
            return this.sendToAddress ?? BrsInvalid.Instance;
        },
    });

    /** Returns the roSocketAddress for the sender of the last message popped via Receive()/ReceiveStr(). */
    private readonly getReceivedFromAddress = new Callable("getReceivedFromAddress", {
        signature: { args: [], returns: ValueKind.Object },
        impl: (_: Interpreter) => {
            if (!this.lastReceivedFrom) {
                return BrsInvalid.Instance;
            }
            const address = new RoSocketAddress();
            address.setFromResolved(this.lastReceivedFrom.host, this.lastReceivedFrom.port);
            return address;
        },
    });

    /** Best-effort count of bytes waiting to be received (sum of queued datagrams). */
    private readonly getCountRcvBuf = new Callable("getCountRcvBuf", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            const total = this.recvQueue.reduce((sum, entry) => sum + entry.data.length, 0);
            return new Int32(total);
        },
    });

    /** Not tracked for a UDP socket (no send buffering). */
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

    /** True once a full datagram is queued and waiting to be Receive()d. */
    private readonly isReadable = new Callable("isReadable", {
        signature: { args: [], returns: ValueKind.Boolean },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.recvQueue.length > 0);
        },
    });

    /** A UDP socket has no streaming backpressure — always writable once created. */
    private readonly isWritable = new Callable("isWritable", {
        signature: { args: [], returns: ValueKind.Boolean },
        impl: (_: Interpreter) => {
            return BrsBoolean.True;
        },
    });

    /** Out-of-band data doesn't apply to UDP. */
    private readonly isException = new Callable("isException", {
        signature: { args: [], returns: ValueKind.Boolean },
        impl: (_: Interpreter) => {
            return BrsBoolean.False;
        },
    });

    /** Enables/disables roSocketEvent delivery via the message port when a datagram is queued. */
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

    /** Not implemented — a UDP socket has no writable-notification concept worth modeling. */
    private readonly notifyWritable = new Callable("notifyWritable", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            return Uninitialized.Instance;
        },
    });

    /** Not implemented — out-of-band data doesn't apply to UDP. */
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

    // ifSocketCastOption ----------------------------------------------------------------------------

    /** Checks whether broadcast messages may be sent or received. */
    private readonly getBroadcast = new Callable("getBroadcast", {
        signature: { args: [], returns: ValueKind.Boolean },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.broadcast);
        },
    });

    /** Enables SO_BROADCAST, auto-binding an ephemeral port first if the socket isn't bound yet. */
    private readonly setBroadcast = new Callable("setBroadcast", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            const result = this.bridge.setBroadcast(enable.toBoolean());
            this.errorCode = result.errorCode;
            this.broadcast = result.ok ? enable.toBoolean() : this.broadcast;
            return BrsBoolean.from(result.ok);
        },
    });

    /** Joins a specific multicast group. Not implemented for real multicast membership — mock. */
    private readonly joinGroup = new Callable("joinGroup", {
        signature: {
            args: [new StdlibArgument("ipAddress", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, ipAddress: RoSocketAddress) => {
            this.address = ipAddress;
            return BrsBoolean.True;
        },
    });

    /** Drops out of a specific multicast group. Not implemented for real multicast membership — mock. */
    private readonly dropGroup = new Callable("dropGroup", {
        signature: {
            args: [new StdlibArgument("ipAddress", ValueKind.Object)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, ipAddress: RoSocketAddress) => {
            return BrsInvalid.Instance;
        },
    });

    /** Checks whether multicast messages are enabled for local loopback. */
    private readonly getMulticastLoop = new Callable("getMulticastLoop", {
        signature: { args: [], returns: ValueKind.Boolean },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.multicastLoop);
        },
    });

    /** Enables local loopback of multicast messages. */
    private readonly setMulticastLoop = new Callable("setMulticastLoop", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            this.multicastLoop = enable.toBoolean();
            return BrsBoolean.True;
        },
    });

    /** Returns the TTL integer value for multicast messages. */
    private readonly getMulticastTTL = new Callable("getMulticastTTL", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(this.multicastTTL);
        },
    });

    /** Sets the TTL integer value for multicast messages. */
    private readonly setMulticastTTL = new Callable("setMulticastTTL", {
        signature: {
            args: [new StdlibArgument("ttl", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, ttl: Int32) => {
            this.multicastTTL = ttl.getValue();
            return BrsBoolean.True;
        },
    });
}

function generateUniqueId(): number {
    const min = 10000000;
    const max = 99999999;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
