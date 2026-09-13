/**
 * Platform-agnostic shape shared by `RoWebSocket`'s two transports: `WebSocketBridge` (Node/CLI,
 * a helper process with a real `ws` client) and `WebSocketBrowserBridge` (browser, a real
 * `WebSocket` owned by the main thread). Both convert their platform's real WebSocket
 * callbacks/events into this plain, JSON-serializable shape so `RoWebSocket.ts` has exactly one
 * code path for turning results into `RoWebSocketEvent`s, regardless of platform.
 */

export interface WebSocketOpenParams {
    url: string;
    /** Comma-separated subprotocol list, as accepted by `SetProtocols()`. */
    protocols?: string;
    user?: string;
    password?: string;
    headers?: Record<string, string>;
    peerVerification: boolean;
    hostVerification: boolean;
}

export type WebSocketEventPayload =
    | { type: "opened"; protocol: string; targetIp?: string; effectiveUrl: string }
    | { type: "closed"; code: number; reason: string; error: number; errorMsg: string }
    | { type: "error"; error: number; errorMsg: string }
    | { type: "msgSent"; opcode: number; msgId: number; size: number }
    | { type: "text"; text: string }
    | { type: "data"; dataBase64: string }
    | { type: "ping"; text?: string; dataBase64?: string }
    | { type: "pong"; text?: string; dataBase64?: string };

/** Real WebSocket I/O behind a common surface `RoWebSocket` drives without knowing the platform. */
export interface WebSocketTransport {
    /** Starts connecting. Handshake completion/failure arrive later via `poll()`; the return value
     *  only reports whether the transport itself could be started at all (e.g. the Node helper
     *  process spawned) — `false` means no event will ever follow, since nothing is listening. */
    open(params: WebSocketOpenParams): boolean;
    /** Drains every event that has arrived since the last call. Never blocks. */
    poll(): WebSocketEventPayload[];
    /** Returns the assigned message id, echoed back later by a `msgSent` event's `Msg` field. */
    send(text: string): number;
    sendData(bytes: Uint8Array): number;
    sendPing(text?: string, bytes?: Uint8Array): number;
    sendPong(text?: string, bytes?: Uint8Array): number;
    /** Best-effort: browsers give script no control over automatic Pong replies, so the browser
     *  transport's implementation is a no-op — the underlying platform always auto-replies. */
    setAutoPingReply(enable: boolean): void;
    close(code: number, reason: string): void;
    /** Tears down the connection/helper immediately. Safe to call more than once. */
    dispose(): void;
}

/** Generic, non-protocol-specific error code used when a platform gives no finer-grained reason. */
export const WS_GENERIC_ERROR = 1;
