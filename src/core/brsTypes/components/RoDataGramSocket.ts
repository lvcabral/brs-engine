import {
    Callable,
    ValueKind,
    StdlibArgument,
    BrsBoolean,
    BrsType,
    BrsValue,
    Int32,
    RoSocketAddress,
    BrsInvalid,
} from "..";
import { BrsComponent } from "./BrsComponent";
import { Interpreter } from "../../interpreter";
import { BrsSocket, IfSocket, IfSocketAsync, IfSocketOption, IfSocketStatus } from "../interfaces/IfSocket";
import { IfGetMessagePort, IfSetMessagePort } from "../interfaces/IfMessagePort";
import * as net from "net";
import { BrsDevice } from "../../device/BrsDevice";

export class RoDataGramSocket extends BrsComponent implements BrsValue, BrsSocket {
    readonly kind = ValueKind.Object;
    readonly socket?: net.Socket;
    readonly identity: number;
    private broadcast: boolean;
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
        this.multicastLoop = false;
        this.multicastTTL = 0;
        this.ttl = 0;
        this.reuseAddr = false;
        this.inline = false;
        this.sendBufferSize = 0;
        this.recvBufferSize = 0;
        this.sendTimeout = 0;
        this.recvTimeout = 0;
        try {
            this.socket = new net.Socket();
        } catch (err: any) {
            BrsDevice.stderr.write(`warning,[roDataGramSocket] Sockets are not supported in this environment.`);
            this.errorCode = 3474;
        }
        this.identity = generateUniqueId();
        const ifSocket = new IfSocket(this);
        const ifSocketAsync = new IfSocketAsync(this);
        const ifSocketStatus = new IfSocketStatus(this);
        const ifSocketOption = new IfSocketOption(this);
        const setPortIface = new IfSetMessagePort(this);
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
                ifSocket.send,
                ifSocket.sendStr,
                ifSocket.receive,
                ifSocket.receiveStr,
                ifSocket.close,
                ifSocket.setAddress,
                ifSocket.getAddress,
                ifSocket.setSendToAddress,
                ifSocket.getSendToAddress,
                ifSocket.getReceivedFromAddress,
                ifSocket.getCountRcvBuf,
                ifSocket.getCountSendBuf,
                ifSocket.status,
            ],
            ifSocketAsync: [
                ifSocketAsync.isReadable,
                ifSocketAsync.isWritable,
                ifSocketAsync.isException,
                ifSocketAsync.notifyReadable,
                ifSocketAsync.notifyWritable,
                ifSocketAsync.notifyException,
                ifSocketAsync.getID,
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

    /** Checks whether broadcast messages may be sent or received. */
    private readonly getBroadcast = new Callable("getBroadcast", {
        signature: { args: [], returns: ValueKind.Boolean },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.broadcast);
        },
    });

    /** Enables broadcast messages to be sent or received. */
    private readonly setBroadcast = new Callable("setBroadcast", {
        signature: {
            args: [new StdlibArgument("enable", ValueKind.Boolean)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            this.broadcast = enable.toBoolean();
            return BrsBoolean.True;
        },
    });

    /** Joins a specific multicast group. */
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

    /** Drops out of a specific multicast group. */
    private readonly dropGroup = new Callable("dropGroup", {
        signature: {
            args: [new StdlibArgument("ipAddress", ValueKind.Object)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, ipAddress: RoSocketAddress) => {
            // Implementation of dropGroup method
            return BrsInvalid.Instance;
        },
    });

    /** Checks whether multicast messages are enabled for local loopback. */
    private readonly getMulticastLoop = new Callable("getMulticastLoop", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
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
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.multicastTTL);
        },
    });

    /** Enables local loopback of multicast messages. */
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
