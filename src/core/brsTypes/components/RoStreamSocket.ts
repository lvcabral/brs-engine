import {
    Callable,
    ValueKind,
    BrsString,
    StdlibArgument,
    BrsBoolean,
    BrsType,
    BrsComponent,
    BrsValue,
    Int32,
    RoSocketAddress,
    BrsInvalid,
    Uninitialized,
    RoByteArray,
} from "..";
import { Interpreter } from "../../interpreter";
import { IfGetMessagePort, IfSetMessagePort } from "../interfaces/IfMessagePort";
import * as net from "net";

export class RoStreamSocket extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly interpreter: Interpreter;
    private identity: number;
    private socket?: net.Socket;
    private address?: RoSocketAddress;
    private sendToAddress?: RoSocketAddress;
    private errorCode: number;

    constructor(interpreter: Interpreter) {
        super("roStreamSocket");
        this.interpreter = interpreter;
        try {
            this.socket = new net.Socket();
            this.errorCode = 0;
        } catch (err: any) {
            interpreter.stderr.write(
                `warning,[roStreamSocket] Sockets are not supported in this environment.`
            );
            this.errorCode = 3474;
        }
        this.identity = generateUniqueId();
        const setPortIface = new IfSetMessagePort(this);
        const getPortIface = new IfGetMessagePort(this);
        this.registerMethods({
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
            ifSocketConnection: [
                this.listen,
                this.isListening,
                this.connect,
                this.accept,
                this.isConnected,
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
                this.eAgain,
                this.eAlready,
                this.eBadAddr,
                this.eDestAddrReq,
                this.eHostUnreach,
                this.eInvalid,
                this.eInProgress,
                this.eWouldBlock,
                this.eSuccess,
                this.eOK,
            ],
            ifSetMessagePort: [setPortIface.setMessagePort],
            ifGetMessagePort: [getPortIface.getMessagePort],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roStreamSocket  >";
    }

    equalTo(other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }

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
            try {
                const sent = this.socket?.write(data.getByteArray());
                return new Int32(sent ? data.getElements().length : 0);
            } catch (err) {
                return new Int32(0);
            }
        },
    });

    /** Sends the whole string to the socket, if possible. */
    private readonly sendStr = new Callable("sendStr", {
        signature: {
            args: [new StdlibArgument("data", ValueKind.String)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, data: BrsString) => {
            try {
                const sent = this.socket?.write(data.value);
                return new Int32(sent ? data.value.length : 0);
            } catch (err) {
                return new Int32(0);
            }
        },
    });

    /** Reads data from the socket. */
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
            let buffer = Buffer.alloc(length.getValue());
            try {
                buffer = this.socket?.read(length.getValue()) ?? Buffer.alloc(0);
                return new Int32(buffer.length);
            } catch (err) {
                return new Int32(0);
            }
        },
    });

    /** Reads data from the socket and stores the result in a string. */
    private readonly receiveStr = new Callable("receiveStr", {
        signature: {
            args: [new StdlibArgument("length", ValueKind.Int32)],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, length: Int32) => {
            const str = this.socket?.read(length.getValue()) ?? "";
            return new Int32(str.length);
        },
    });

    /** Closes the socket */
    private readonly close = new Callable("close", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.socket?.end();
            return Uninitialized.Instance;
        },
    });

    /** Sets the address for the socket */
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

    /** Returns the port. */
    private readonly getAddress = new Callable("getAddress", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.address ?? BrsInvalid.Instance;
        },
    });

    /** Sets the send-to address for the socket */
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

    /** Gets the send-to address of the socket */
    private readonly getSendToAddress = new Callable("getSendToAddress", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.sendToAddress ?? BrsInvalid.Instance;
        },
    });

    /** Returns the roSocketAddress for the remote address of the last message received via the receive() method. */
    private readonly getReceivedFromAddress = new Callable("getReceivedFromAddress", {
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
    private readonly getCountRcvBuf = new Callable("getCountRcvBuf", {
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
    private readonly getCountSendBuf = new Callable("getCountSendBuf", {
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
    private readonly status = new Callable("status", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.errorCode);
        },
    });

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
            // Implementation of connect method
            return BrsBoolean.False;
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
    /** Checks if the socket is readable */
    private readonly isReadable = new Callable("isReadable", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.socket?.readable ?? false);
        },
    });

    /** Checks if the socket is writable */
    private readonly isWritable = new Callable("isWritable", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.socket?.writable ?? false);
        },
    });

    /** Checks if the socket has an exception */
    private readonly isException = new Callable("isException", {
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
    private readonly notifyReadable = new Callable("notifyReadable", {
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
    private readonly notifyWritable = new Callable("notifyWritable", {
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
    private readonly notifyException = new Callable("notifyException", {
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
    private readonly getID = new Callable("getID", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.identity);
        },
    });
    /** Returns the EAGAIN status */
    private readonly eAgain = new Callable("eAgain", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.errorCode === 11); // EAGAIN error code
        },
    });

    /** Returns the EALREADY status */
    private readonly eAlready = new Callable("eAlready", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.errorCode === 114); // EALREADY error code
        },
    });

    /** Returns the EBADADDR status */
    private readonly eBadAddr = new Callable("eBadAddr", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.errorCode === 14); // EBADADDR error code
        },
    });

    /** Returns the EDESTADDRREQ status */
    private readonly eDestAddrReq = new Callable("eDestAddrReq", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.errorCode === 39); // EDESTADDRREQ error code
        },
    });

    /** Returns the EHOSTUNREACH status */
    private readonly eHostUnreach = new Callable("eHostUnreach", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.errorCode === 65); // EHOSTUNREACH error code
        },
    });

    /** Returns the EINVALID status */
    private readonly eInvalid = new Callable("eInvalid", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.errorCode === 22); // EINVALID error code
        },
    });

    /** Returns the EINPROGRESS status */
    private readonly eInProgress = new Callable("eInProgress", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.errorCode === 36); // EINPROGRESS error code
        },
    });

    /** Returns the EWOULDBLOCK status */
    private readonly eWouldBlock = new Callable("eWouldBlock", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.errorCode === 35); // EWOULDBLOCK error code
        },
    });

    /** Checks whether there are no errors (the error number is 0). */
    private readonly eSuccess = new Callable("eSuccess", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            // Implementation of eSuccess method
            return BrsBoolean.from(this.errorCode === 0);
        },
    });

    /** Checks whether there is no hard error, but possibly one of the following async conditions: EAGAIN, EALREADY, EINPROGRESS, EWOULDBLOCK. */
    private readonly eOK = new Callable("eOK", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            // Implementation of eOK method
            return BrsBoolean.from(this.errorCode === 0);
        },
    });
}

function generateUniqueId(): number {
    const min = 10000000;
    const max = 99999999;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
