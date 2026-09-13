import {
    BrsType,
    BrsValue,
    ValueKind,
    BrsString,
    BrsBoolean,
    BrsInvalid,
    Int32,
    Uninitialized,
    RoByteArray,
    FlexObject,
    toAssociativeArray,
} from "..";
import { BrsComponent } from "./BrsComponent";
import { RoMessagePort } from "./RoMessagePort";
import { Interpreter } from "../../interpreter";
import { Callable, StdlibArgument } from "../Callable";
import { BrsEvent } from "../events/BrsEvent";
import { RoWebSocketEvent, WebSocketEventType } from "../events/RoWebSocketEvent";
import { IfSetMessagePort, IfGetMessagePort } from "../interfaces/IfMessagePort";
import { BrsHttpAgent, IfHttpAgent } from "../interfaces/IfHttpAgent";
import { generateUniqueId } from "../interfaces/IfSocket";
import { BrsDevice } from "../../device/BrsDevice";
import { WebSocketBridge } from "../../device/WebSocketBridge";
import { WebSocketBrowserBridge } from "../../device/WebSocketBrowserBridge";
import { WebSocketEventPayload, WebSocketTransport, WS_GENERIC_ERROR } from "../../device/WebSocketTransport";
import { DefaultCertificatesFile } from "../../common";

interface TimerState {
    timeoutMs: number;
    oneShot: boolean;
    nextFire: number;
    occur: number;
}

/** Reported by `GetMsgSendBufferSize()`/`GetMsgRecvBufferSize()`. Not tracked — neither platform's
 *  transport models real send/receive buffering, so this is a fixed, informational value. */
const DEFAULT_MSG_BUFFER_SIZE = 32 * 1024;

/**
 * Establishes and manages a WebSocket connection (RFC 6455), delivering asynchronous
 * `roWebSocketEvent`s via a message port, same as `roUrlTransfer`'s HTTP handshake methods.
 * https://developer.roku.com/docs/references/brightscript/components/rowebsocket.md
 *
 * Real I/O is delegated to a platform transport (`WebSocketTransport`) because the interpreter's
 * `Wait()` loop is a synchronous busy-spin that can never let a same-thread WebSocket's own
 * callbacks fire — see `WebSocketBridge.ts` (Node/CLI, a helper process) and
 * `WebSocketBrowserBridge.ts` (browser, the main thread) for the two platform implementations and
 * their respective fidelity gaps (Node: full protocol including Ping/Pong; browser: no custom
 * headers/auth/cert verification and no script-visible Ping/Pong, all platform limitations).
 */
export class RoWebSocket extends BrsComponent implements BrsValue, BrsHttpAgent {
    readonly kind = ValueKind.Object;
    private readonly identity: number;
    private readonly callbackKey: string;
    private port?: RoMessagePort;
    private url: string;
    private socketData?: BrsType;
    private user?: string;
    private password?: string;
    private protocols: string;
    private selectedProtocol: string;
    private peerVerification: boolean;
    private hostVerification: boolean;
    private autoPingReply: boolean;
    private fragmentSize: number;
    private errorCode: number;
    private connected: boolean;
    private openInfo?: FlexObject;
    private transport?: WebSocketTransport;
    private pendingEvents: RoWebSocketEvent[];
    private readonly timers: Map<string, TimerState>;
    // ifHttpAgent interface
    readonly customHeaders: Map<string, string>;
    cookiesEnabled: boolean;
    certificatesFile: string;

    constructor() {
        super("roWebSocket");
        this.identity = generateUniqueId();
        this.callbackKey = `roWebSocket:${this.identity}`;
        this.url = "";
        this.protocols = "";
        this.selectedProtocol = "";
        this.peerVerification = true;
        this.hostVerification = true;
        this.autoPingReply = true;
        this.fragmentSize = 0;
        this.errorCode = 0;
        this.connected = false;
        this.pendingEvents = [];
        this.timers = new Map();
        this.cookiesEnabled = false;
        this.customHeaders = new Map();
        this.certificatesFile = DefaultCertificatesFile;
        const ifHttpAgent = new IfHttpAgent(this);
        const setPortIface = new IfSetMessagePort(this, this.getNewEvents.bind(this), this.callbackKey);
        const getPortIface = new IfGetMessagePort(this);
        this.registerMethods({
            ifWebSocket: [
                this.getSocketId,
                this.setUrl,
                this.getUrl,
                this.setData,
                this.getData,
                this.setUserAndPassword,
                this.enablePeerVerification,
                this.enableHostVerification,
                this.open,
                this.getOpenInfo,
                this.close,
                this.setProtocols,
                this.getSelectedProtocol,
                this.send,
                this.sendPing,
                this.sendPong,
                this.getBuffered,
                this.pingTest,
                this.setTimer,
                this.setAutoPingReply,
                this.getAutoPingReply,
                this.setFragmentSize,
                this.getFragmentSize,
                this.getMsgSendBufferSize,
                this.getMsgRecvBufferSize,
            ],
            ifHttpAgent: [
                ifHttpAgent.addHeader,
                ifHttpAgent.setHeaders,
                ifHttpAgent.initClientCertificates,
                ifHttpAgent.setCertificatesFile,
                ifHttpAgent.setCertificatesDepth,
                ifHttpAgent.enableCookies,
                ifHttpAgent.getCookies,
                ifHttpAgent.addCookies,
                ifHttpAgent.clearCookies,
            ],
            ifSetMessagePort: [setPortIface.setMessagePort, setPortIface.setPort],
            ifGetMessagePort: [getPortIface.getMessagePort, getPortIface.getPort],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roWebSocket>";
    }

    equalTo(other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }

    dispose() {
        this.port?.unregisterCallback(this.getComponentName(), this.callbackKey);
        this.transport?.dispose();
    }

    /** Lazily creates this socket's transport, shared by `Open()`. */
    private ensureTransport(): WebSocketTransport {
        this.transport ??= createTransport((message) => BrsDevice.stderr.write(`warning,${message}`));
        return this.transport;
    }

    /** Drains the transport and any due timers, turning results into pending `roWebSocketEvent`s. */
    private tick(): void {
        if (this.transport) {
            for (const payload of this.transport.poll()) {
                this.applyPayload(payload);
            }
        }
        this.checkTimers();
    }

    /** Polled once per `Wait()`/message-port iteration. */
    private getNewEvents(): BrsEvent[] {
        this.tick();
        if (this.pendingEvents.length === 0) {
            return [];
        }
        const events = this.pendingEvents;
        this.pendingEvents = [];
        return events;
    }

    private applyPayload(payload: WebSocketEventPayload): void {
        switch (payload.type) {
            case "opened": {
                this.connected = true;
                this.errorCode = 0;
                this.selectedProtocol = payload.protocol;
                this.openInfo = {
                    Protocol: payload.protocol,
                    // Left empty unless a transport supplies it directly: neither `ws` (Node) nor
                    // the browser's native `WebSocket` exposes the connection's real remote
                    // address on their public API, and re-deriving it via a fresh DNS lookup would
                    // be both inaccurate (may not match the address actually connected to) and a
                    // synchronous external network call on every single connect.
                    TargetIPAddr: payload.targetIp ?? "",
                    EffectiveUrl: payload.effectiveUrl,
                };
                this.pushEvent(WebSocketEventType.Opened, this.openInfo);
                break;
            }
            case "closed": {
                this.connected = false;
                this.errorCode = payload.error;
                this.pushEvent(WebSocketEventType.Closed, {
                    Code: payload.code,
                    Reason: payload.reason,
                    Error: payload.error,
                    ErrorMsg: payload.errorMsg,
                });
                break;
            }
            case "error": {
                this.errorCode = payload.error;
                this.pushEvent(WebSocketEventType.Error, { Error: payload.error, ErrorMsg: payload.errorMsg });
                break;
            }
            case "msgSent": {
                this.pushEvent(WebSocketEventType.MsgSent, {
                    Opcode: payload.opcode,
                    Msg: payload.msgId,
                    Size: payload.size,
                });
                break;
            }
            case "text": {
                this.pushEvent(WebSocketEventType.TextReceived, { Text: payload.text });
                break;
            }
            case "data": {
                this.pushEvent(WebSocketEventType.DataReceived, { Data: bytesFromBase64(payload.dataBase64) });
                break;
            }
            case "ping": {
                this.pushEvent(WebSocketEventType.PingReceived, controlFrameInfo(payload.dataBase64));
                break;
            }
            case "pong": {
                this.pushEvent(WebSocketEventType.PongReceived, controlFrameInfo(payload.dataBase64));
                break;
            }
        }
    }

    private checkTimers(): void {
        const now = performance.now();
        for (const [timerId, timer] of this.timers) {
            if (now < timer.nextFire) {
                continue;
            }
            timer.occur += 1;
            this.pushEvent(WebSocketEventType.Timer, { TimerId: timerId, Occur: timer.occur });
            if (timer.oneShot) {
                this.timers.delete(timerId);
            } else {
                timer.nextFire = now + timer.timeoutMs;
            }
        }
    }

    private pushEvent(type: WebSocketEventType, info: FlexObject): void {
        this.pendingEvents.push(new RoWebSocketEvent(this.identity, type, this.socketData, info));
    }

    // ifWebSocket ---------------------------------------------------------------------------------

    /** Returns a unique identifier for this WebSocket instance. */
    private readonly getSocketId = new Callable("getSocketId", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(this.identity);
        },
    });

    /** Sets the WebSocket server URL to connect to. */
    private readonly setUrl = new Callable("setUrl", {
        signature: { args: [new StdlibArgument("url", ValueKind.String)], returns: ValueKind.Boolean },
        impl: (_: Interpreter, url: BrsString) => {
            if (url.value.length === 0) {
                return BrsBoolean.False;
            }
            this.url = url.value;
            return BrsBoolean.True;
        },
    });

    /** Returns the WebSocket server URL currently set. */
    private readonly getUrl = new Callable("getUrl", {
        signature: { args: [], returns: ValueKind.String },
        impl: (_: Interpreter) => {
            return new BrsString(this.url);
        },
    });

    /** Stores an arbitrary "socket data" object, delivered with every event. */
    private readonly setData = new Callable("setData", {
        signature: { args: [new StdlibArgument("data", ValueKind.Dynamic)], returns: ValueKind.Void },
        impl: (_: Interpreter, data: BrsType) => {
            this.socketData = data;
            return Uninitialized.Instance;
        },
    });

    /** Returns the socket data previously set with `SetData()`. */
    private readonly getData = new Callable("getData", {
        signature: { args: [], returns: ValueKind.Dynamic },
        impl: (_: Interpreter) => {
            return this.socketData ?? BrsInvalid.Instance;
        },
    });

    /** Sets the credentials used for HTTP basic authentication during the opening handshake.
     *  Node/CLI only — browsers give script no way to set handshake credentials. */
    private readonly setUserAndPassword = new Callable("setUserAndPassword", {
        signature: {
            args: [new StdlibArgument("user", ValueKind.String), new StdlibArgument("password", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, user: BrsString, password: BrsString) => {
            this.user = user.value;
            this.password = password.value;
            return BrsBoolean.True;
        },
    });

    /** Enables/disables verification of the server's TLS certificate chain.
     *  Node/CLI only — browsers always enforce full certificate verification. */
    private readonly enablePeerVerification = new Callable("enablePeerVerification", {
        signature: { args: [new StdlibArgument("enable", ValueKind.Boolean)], returns: ValueKind.Boolean },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            this.peerVerification = enable.toBoolean();
            return BrsBoolean.True;
        },
    });

    /** Enables/disables verification that the server's TLS certificate matches the host name.
     *  Node/CLI only — browsers always enforce host name verification. */
    private readonly enableHostVerification = new Callable("enableHostVerification", {
        signature: { args: [new StdlibArgument("enable", ValueKind.Boolean)], returns: ValueKind.Boolean },
        impl: (_: Interpreter, enable: BrsBoolean) => {
            this.hostVerification = enable.toBoolean();
            return BrsBoolean.True;
        },
    });

    /** Initiates the WebSocket opening handshake, optionally blocking for it to complete. */
    private readonly open = new Callable("open", {
        signature: {
            args: [new StdlibArgument("wait_time", ValueKind.Int32, new Int32(0))],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, waitTime: Int32) => {
            if (this.url.length === 0) {
                return BrsBoolean.False;
            }
            const transport = this.ensureTransport();
            const started = transport.open({
                url: this.url,
                protocols: this.protocols || undefined,
                user: this.user,
                password: this.password,
                headers: this.customHeaders.size > 0 ? Object.fromEntries(this.customHeaders) : undefined,
                peerVerification: this.peerVerification,
                hostVerification: this.hostVerification,
            });
            if (!started) {
                // Nothing will ever poll true from this transport — surface it now instead of
                // reporting success and leaving a Wait()-based app blocked forever.
                this.errorCode = WS_GENERIC_ERROR;
                this.pushEvent(WebSocketEventType.Error, {
                    Error: WS_GENERIC_ERROR,
                    ErrorMsg: "Failed to start the WebSocket transport",
                });
                return BrsBoolean.False;
            }
            transport.setAutoPingReply(this.autoPingReply);
            const ms = waitTime.getValue();
            if (ms <= 0) {
                return BrsBoolean.True;
            }
            const deadline = performance.now() + ms;
            while (performance.now() < deadline) {
                this.tick();
                if (this.connected) {
                    return BrsBoolean.True;
                }
                if (this.errorCode !== 0) {
                    return BrsBoolean.False;
                }
                pollDelay();
            }
            return BrsBoolean.False;
        },
    });

    /** Returns information about the open connection (Protocol, TargetIPAddr, EffectiveUrl). */
    private readonly getOpenInfo = new Callable("getOpenInfo", {
        signature: { args: [], returns: ValueKind.Object },
        impl: (_: Interpreter) => {
            return this.openInfo ? toAssociativeArray(this.openInfo) : BrsInvalid.Instance;
        },
    });

    /** Closes the WebSocket connection. */
    private readonly close = new Callable("close", {
        signature: {
            args: [
                new StdlibArgument("code", ValueKind.Int32, new Int32(1000)),
                new StdlibArgument("reason", ValueKind.String, new BrsString("")),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, code: Int32, reason: BrsString) => {
            this.connected = false;
            this.transport?.close(code.getValue(), reason.value);
            return Uninitialized.Instance;
        },
    });

    /** Sets the list of WebSocket subprotocols to request during the opening handshake. */
    private readonly setProtocols = new Callable("setProtocols", {
        signature: { args: [new StdlibArgument("protocols", ValueKind.String)], returns: ValueKind.Boolean },
        impl: (_: Interpreter, protocols: BrsString) => {
            this.protocols = protocols.value;
            return BrsBoolean.True;
        },
    });

    /** Returns the subprotocol that the server selected during the opening handshake. */
    private readonly getSelectedProtocol = new Callable("getSelectedProtocol", {
        signature: { args: [], returns: ValueKind.String },
        impl: (_: Interpreter) => {
            return new BrsString(this.selectedProtocol);
        },
    });

    /** Sends a text or binary message to the server. */
    private readonly send = new Callable("send", {
        signature: {
            args: [
                new StdlibArgument("data", ValueKind.Dynamic),
                new StdlibArgument("wait_time", ValueKind.Int32, new Int32(0)),
            ],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, data: BrsType) => {
            if (!this.transport) {
                return BrsInvalid.Instance;
            }
            const msgId = sendPayload(this.transport, data);
            return msgId === undefined ? BrsInvalid.Instance : toAssociativeArray({ ID: msgId });
        },
    });

    /** Sends a WebSocket Ping control frame. Node/CLI only — browsers expose no script API for it. */
    private readonly sendPing = new Callable("sendPing", {
        signature: {
            args: [
                new StdlibArgument("data", ValueKind.Dynamic),
                new StdlibArgument("wait_time", ValueKind.Int32, new Int32(0)),
            ],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, data: BrsType) => {
            const transport = this.transport;
            if (!transport) {
                return BrsInvalid.Instance;
            }
            return sendControlFrame(data, (text, bytes) => transport.sendPing(text, bytes));
        },
    });

    /** Sends a WebSocket Pong control frame. Node/CLI only — browsers expose no script API for it. */
    private readonly sendPong = new Callable("sendPong", {
        signature: {
            args: [
                new StdlibArgument("data", ValueKind.Dynamic),
                new StdlibArgument("wait_time", ValueKind.Int32, new Int32(0)),
            ],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, data: BrsType) => {
            const transport = this.transport;
            if (!transport) {
                return BrsInvalid.Instance;
            }
            return sendControlFrame(data, (text, bytes) => transport.sendPong(text, bytes));
        },
    });

    /** Bytes queued for sending but not yet sent. Not modeled — sends are handed off immediately. */
    private readonly getBuffered = new Callable("getBuffered", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(0);
        },
    });

    /** Sends a Ping frame and waits for the matching Pong reply. Node/CLI only. */
    private readonly pingTest = new Callable("pingTest", {
        signature: {
            args: [
                new StdlibArgument("timeout", ValueKind.Int32, new Int32(0)),
                new StdlibArgument("text", ValueKind.String, new BrsString("")),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, timeout: Int32, text: BrsString) => {
            if (!this.transport) {
                return BrsBoolean.False;
            }
            let checkedIndex = this.pendingEvents.length;
            this.transport.sendPing(text.value.length > 0 ? text.value : undefined);
            const ms = timeout.getValue();
            const deadline = performance.now() + Math.max(ms, 0);
            do {
                this.tick();
                for (; checkedIndex < this.pendingEvents.length; checkedIndex++) {
                    if (this.pendingEvents[checkedIndex].type === WebSocketEventType.PongReceived) {
                        return BrsBoolean.True;
                    }
                }
                pollDelay();
            } while (performance.now() < deadline);
            return BrsBoolean.False;
        },
    });

    /** Schedules a timer that fires a Timer event after the specified interval. */
    private readonly setTimer = new Callable("setTimer", {
        signature: {
            args: [
                new StdlibArgument("timer_id", ValueKind.String),
                new StdlibArgument("timeout", ValueKind.Int32),
                new StdlibArgument("one_shot", ValueKind.Boolean, BrsBoolean.False),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, timerId: BrsString, timeout: Int32, oneShot: BrsBoolean) => {
            const timeoutMs = timeout.getValue();
            this.timers.set(timerId.value, {
                timeoutMs,
                oneShot: oneShot.toBoolean(),
                nextFire: performance.now() + timeoutMs,
                occur: 0,
            });
            return Uninitialized.Instance;
        },
    });

    /** Sets whether the WebSocket automatically replies to incoming Ping frames with a Pong.
     *  Browsers always auto-reply regardless of this setting — see `WebSocketBrowserBridge.ts`. */
    private readonly setAutoPingReply = new Callable("setAutoPingReply", {
        signature: { args: [new StdlibArgument("auto_reply", ValueKind.Boolean)], returns: ValueKind.Void },
        impl: (_: Interpreter, autoReply: BrsBoolean) => {
            this.autoPingReply = autoReply.toBoolean();
            this.transport?.setAutoPingReply(this.autoPingReply);
            return Uninitialized.Instance;
        },
    });

    /** Returns whether automatic Pong replies to incoming Ping frames are enabled. */
    private readonly getAutoPingReply = new Callable("getAutoPingReply", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(this.autoPingReply ? 1 : 0);
        },
    });

    /** Sets the maximum size of an outgoing message fragment. Stored, not enforced — neither
     *  platform's transport exposes manual WebSocket frame fragmentation. */
    private readonly setFragmentSize = new Callable("setFragmentSize", {
        signature: { args: [new StdlibArgument("size", ValueKind.Int32)], returns: ValueKind.Void },
        impl: (_: Interpreter, size: Int32) => {
            this.fragmentSize = size.getValue();
            return Uninitialized.Instance;
        },
    });

    /** Returns the current maximum outgoing fragment size, in bytes. */
    private readonly getFragmentSize = new Callable("getFragmentSize", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(this.fragmentSize);
        },
    });

    /** Returns the size of the send message buffer, in bytes. Not tracked — a fixed value. */
    private readonly getMsgSendBufferSize = new Callable("getMsgSendBufferSize", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(DEFAULT_MSG_BUFFER_SIZE);
        },
    });

    /** Returns the size of the receive message buffer, in bytes. Not tracked — a fixed value. */
    private readonly getMsgRecvBufferSize = new Callable("getMsgRecvBufferSize", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(DEFAULT_MSG_BUFFER_SIZE);
        },
    });
}

/** Chooses the platform transport: a real Web Worker (has `importScripts`) means the browser
 *  build, where the real `WebSocket` must live on the main thread; anything else (Node worker
 *  thread or in-process CLI/REPL) uses the Node helper-process bridge. */
function createTransport(onError?: (message: string) => void): WebSocketTransport {
    if (typeof importScripts === "function") {
        return new WebSocketBrowserBridge(onError);
    }
    return new WebSocketBridge(onError);
}

function bytesFromBase64(base64: string): RoByteArray {
    return new RoByteArray(Buffer.from(base64, "base64"));
}

/** Builds a PingReceived/PongReceived `GetInfo()` payload with both Text and Data views. */
function controlFrameInfo(dataBase64?: string): FlexObject {
    const bytes = dataBase64 ? Buffer.from(dataBase64, "base64") : Buffer.alloc(0);
    return { Text: bytes.toString("utf8"), Data: new RoByteArray(bytes) };
}

/** Extracts the (text, bytes) pair `SendPing`/`SendPong` accept as a String or `roByteArray`. */
function controlFramePayload(data: BrsType): [string | undefined, Uint8Array | undefined] {
    if (data instanceof BrsString) {
        return [data.value, undefined];
    }
    if (data instanceof RoByteArray) {
        return [undefined, data.getByteArray()];
    }
    return [undefined, undefined];
}

/** Shared by `SendPing`/`SendPong`: extracts the (text, bytes) payload, hands it to whichever
 *  transport method the caller supplies, and wraps the assigned message id the same way both do. */
function sendControlFrame(data: BrsType, send: (text?: string, bytes?: Uint8Array) => number): BrsType {
    const [text, bytes] = controlFramePayload(data);
    return toAssociativeArray({ ID: send(text, bytes) });
}

/** Sends a String or `roByteArray` payload via the transport, returning the assigned message id. */
function sendPayload(transport: WebSocketTransport, data: BrsType): number | undefined {
    if (data instanceof BrsString) {
        return transport.send(data.value);
    }
    if (data instanceof RoByteArray) {
        return transport.sendData(data.getByteArray());
    }
    return undefined;
}

/** A throwaway buffer reused across calls purely as an `Atomics.wait` target — its value never
 *  changes, so every wait always runs the full `ms` before timing out. */
const pollDelayBuffer = new Int32Array(new SharedArrayBuffer(4));

/** Real blocking sleep between polls of `Open(wait_time)`/`PingTest()`'s busy-wait. A pure spin
 *  loop making only non-blocking `fs.statSync` calls would otherwise pin a full CPU core for the
 *  whole wait; this caps that to a short, real sleep between checks instead. */
function pollDelay(): void {
    Atomics.wait(pollDelayBuffer, 0, 0, 10);
}
