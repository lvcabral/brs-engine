import { SharedEventQueue } from "../core/SharedEventQueue";

/**
 * Owns the real `WebSocket` connections behind `roWebSocket` on the browser build. Runs on the
 * main thread (shared by `src/api/index.ts` for the app worker and `src/api/task.ts` for each
 * Task worker) because the interpreter's own thread busy-spins inside `Wait()` with no yielding,
 * so a `WebSocket` created there could never have its callbacks fire — see
 * `src/core/device/WebSocketBrowserBridge.ts` for the full rationale and the worker-side half of
 * this bridge.
 *
 * Browsers give script no way to set custom handshake headers, HTTP Basic-Auth credentials, or
 * certificate-verification behavior on `WebSocket`, and no way to observe or originate raw
 * Ping/Pong control frames — unlike the Node/CLI build (`WebSocketBridge.ts`, backed by the `ws`
 * package), those parts of `ifWebSocket` are unsupported here by platform limitation, not by
 * choice: `SetUserAndPassword`/custom headers/peer-and-host verification are accepted but have no
 * effect, and `SendPing`/`SendPong` are no-ops (browsers auto-reply to a Ping invisibly to JS).
 */

interface WebSocketCommandBase {
    webSocketCommand: "open" | "send" | "sendData" | "sendPing" | "sendPong" | "close" | "dispose";
    id: string;
}

interface OpenCommand extends WebSocketCommandBase {
    webSocketCommand: "open";
    /** Owning worker's thread id (0 = app/render thread, >0 = a Task) — see `disposeSocketsForRealm`. */
    realm: number;
    buffer: SharedArrayBuffer;
    url: string;
    protocols?: string;
}

interface SendCommand extends WebSocketCommandBase {
    webSocketCommand: "send";
    text: string;
    msgId: number;
}

interface SendDataCommand extends WebSocketCommandBase {
    webSocketCommand: "sendData";
    dataBase64: string;
    msgId: number;
}

interface CloseCommand extends WebSocketCommandBase {
    webSocketCommand: "close";
    code: number;
    reason: string;
}

type WebSocketCommand = OpenCommand | SendCommand | SendDataCommand | CloseCommand | WebSocketCommandBase;

/** Type guard for the worker→main WebSocket command channel (see `WebSocketBrowserBridge.ts`). */
export function isWebSocketCommand(data: any): data is WebSocketCommand {
    return (
        data !== null &&
        typeof data === "object" &&
        typeof data.webSocketCommand === "string" &&
        typeof data.id === "string"
    );
}

interface OwnedSocket {
    ws: WebSocket;
    queue: SharedEventQueue;
    realm: number;
}

const sockets = new Map<string, OwnedSocket>();

/** Closes and forgets every socket opened by the given worker realm (0 = app/render thread, >0 =
 *  a Task's thread id). Call when that worker is torn down, so its connections don't leak past it —
 *  a killed worker can never post its own `dispose` command. */
export function disposeSocketsForRealm(realm: number): void {
    for (const [id, entry] of sockets) {
        if (entry.realm !== realm) {
            continue;
        }
        try {
            entry.ws.close();
        } catch {
            // Already closing/closed.
        }
        sockets.delete(id);
    }
}

/** Dispatches one worker→main WebSocket command. Call from each host's own worker message handler. */
export function handleWebSocketCommand(cmd: WebSocketCommand): void {
    switch (cmd.webSocketCommand) {
        case "open":
            handleOpen(cmd as OpenCommand);
            break;
        case "send":
            handleSend(cmd as SendCommand);
            break;
        case "sendData":
            handleSendData(cmd as SendDataCommand);
            break;
        case "sendPing":
        case "sendPong":
            // Real Ping/Pong control frames are not reachable from browser script — see file header.
            break;
        case "close":
            handleClose(cmd as CloseCommand);
            break;
        case "dispose":
            handleDispose(cmd.id);
            break;
    }
}

function handleOpen(cmd: OpenCommand): void {
    // Destructured rather than closed over via `cmd`: these listeners live as long as the
    // connection (potentially the app's whole lifetime), and closing over the full `OpenCommand`
    // would keep it — and its now-superseded `buffer`/`protocols`/`realm` fields — reachable for
    // that whole time instead of just the two primitives actually needed.
    const { id, url } = cmd;
    const queue = SharedEventQueue.fromBuffer(cmd.buffer);
    const protocols = cmd.protocols
        ?.split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    let ws: WebSocket;
    try {
        ws = new WebSocket(url, protocols?.length ? protocols : undefined);
        ws.binaryType = "arraybuffer";
    } catch (err: any) {
        queue.push({ type: "error", error: 1, errorMsg: err?.message ?? String(err) });
        return;
    }
    sockets.set(id, { ws, queue, realm: cmd.realm });
    ws.addEventListener("open", () => {
        queue.push({ type: "opened", protocol: ws.protocol || "", effectiveUrl: ws.url || url });
    });
    ws.addEventListener("message", (ev: MessageEvent) => {
        if (typeof ev.data === "string") {
            queue.push({ type: "text", text: ev.data });
        } else if (ev.data instanceof ArrayBuffer) {
            queue.push({ type: "data", dataBase64: bytesToBase64(new Uint8Array(ev.data)) });
        }
    });
    ws.addEventListener("close", (ev: CloseEvent) => {
        queue.push({ type: "closed", code: ev.code, reason: ev.reason, error: ev.wasClean ? 0 : 1, errorMsg: "" });
        sockets.delete(id);
    });
    ws.addEventListener("error", () => {
        queue.push({ type: "error", error: 1, errorMsg: "WebSocket connection error" });
    });
}

function handleSend(cmd: SendCommand): void {
    const entry = sockets.get(cmd.id);
    if (!entry) {
        return;
    }
    try {
        entry.ws.send(cmd.text);
        entry.queue.push({
            type: "msgSent",
            opcode: 1,
            msgId: cmd.msgId,
            size: new TextEncoder().encode(cmd.text).length,
        });
    } catch (err: any) {
        entry.queue.push({ type: "error", error: 1, errorMsg: err?.message ?? String(err) });
    }
}

function handleSendData(cmd: SendDataCommand): void {
    const entry = sockets.get(cmd.id);
    if (!entry) {
        return;
    }
    const bytes = base64ToBytes(cmd.dataBase64);
    try {
        entry.ws.send(bytes);
        entry.queue.push({ type: "msgSent", opcode: 2, msgId: cmd.msgId, size: bytes.length });
    } catch (err: any) {
        entry.queue.push({ type: "error", error: 1, errorMsg: err?.message ?? String(err) });
    }
}

function handleClose(cmd: CloseCommand): void {
    const entry = sockets.get(cmd.id);
    if (!entry) {
        return;
    }
    try {
        // Browsers only accept 1000 or 3000-4999 from script; any other (protocol-reserved) code
        // throws InvalidAccessError, so fall back to the default rather than let it escape.
        entry.ws.close(cmd.code, cmd.reason);
    } catch {
        try {
            entry.ws.close();
        } catch {
            // Already closing/closed.
        }
    }
}

function handleDispose(id: string): void {
    const entry = sockets.get(id);
    if (!entry) {
        return;
    }
    try {
        entry.ws.close();
    } catch {
        // Already closing/closed.
    }
    sockets.delete(id);
}

/** Chunked (not one `String.fromCharCode(...bytes)` spread, which can blow the call stack on a
 *  large message, nor a per-byte `+=` concat, which is quadratic) — 8KB per chunk keeps both the
 *  argument count and the number of intermediate strings small. */
function bytesToBase64(bytes: Uint8Array): string {
    const chunkSize = 8192;
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCodePoint(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.codePointAt(i) ?? 0;
    }
    return bytes;
}
