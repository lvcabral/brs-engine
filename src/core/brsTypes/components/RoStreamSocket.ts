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

export class RoStreamSocket extends BrsComponent implements BrsValue, BrsSocket {
    readonly kind = ValueKind.Object;
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

    constructor() {
        super("roStreamSocket");
        this.ttl = 0;
        this.reuseAddr = false;
        this.inline = false;
        this.sendBufferSize = 0;
        this.recvBufferSize = 0;
        this.sendTimeout = 0;
        this.recvTimeout = 0;
        try {
            this.socket = new net.Socket();
            this.errorCode = 0;
        } catch (err: any) {
            BrsDevice.stderr.write(`warning,[roStreamSocket] Sockets are not supported in this environment.`);
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
            ifSocketConnection: [this.listen, this.isListening, this.connect, this.accept, this.isConnected],
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
        return "<Component: roStreamSocket>";
    }

    equalTo(other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }

    /** Puts the socket into the listen state. */
    private readonly listen = new Callable("listen", {
        signature: {
            args: [new StdlibArgument("backlog", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, backlog: Int32) => {
            // Implementation of listen method
            return BrsBoolean.True;
        },
    });

    /** Checks whether if the listen() method has been successfully called on this socket. */
    private readonly isListening = new Callable("isListening", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            // Implementation of isListening method
            return BrsBoolean.False;
        },
    });

    /** Establishes a connection. */
    private readonly connect = new Callable("connect", {
        signature: {
            args: [new StdlibArgument("address", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, address: RoSocketAddress) => {
            this.address = address;
            return BrsBoolean.True;
        },
    });

    /** Accepts an incoming connection */
    private readonly accept = new Callable("accept", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            // Implementation of accept method
            return BrsInvalid.Instance;
        },
    });

    /** Checks if the socket is connected */
    private readonly isConnected = new Callable("isConnected", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            const connected = !this.socket?.connecting && !this.socket?.destroyed;
            return BrsBoolean.from(connected);
        },
    });
}

function generateUniqueId(): number {
    const min = 10000000;
    const max = 99999999;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
