import { SharedEventQueue } from "../SharedEventQueue";
import { WebSocketEventPayload, WebSocketOpenParams, WebSocketTransport } from "./WebSocketTransport";
import { BrsDevice } from "./BrsDevice";

/**
 * Bridges `roWebSocket` to a real `WebSocket` on the browser build. The interpreter runs in a Web
 * Worker whose `Wait()` loop is a synchronous busy-spin with no yielding, so a `WebSocket` created
 * on that same thread could never have its own `onmessage`/`onclose` callbacks fire — nothing ever
 * lets the worker's event loop turn while a script is inside `Wait()`. The real `WebSocket`
 * instead lives on the **main thread** (`src/api/index.ts` / `src/api/task.ts`), which keeps
 * running its own event loop the whole time the worker is busy-spinning.
 *
 * Commands flow worker→main over the existing `postMessage` channel (the main thread's own loop
 * is never blocked, so it can react to a message immediately — no polling needed on that side).
 * Events flow main→worker over a `SharedEventQueue`: `Atomics`-backed shared memory the worker can
 * poll synchronously, with no event loop involved, exactly like `RoStreamSocket`'s `StreamBridge`
 * polls its queue file. `postMessage` only carries the *handle* to that `SharedArrayBuffer`, once,
 * at `open()` — after that every event is a pure memory read.
 */
export class WebSocketBrowserBridge implements WebSocketTransport {
    private id: string;
    private queue: SharedEventQueue;
    private msgSeq = 0;
    private disposed = false;

    constructor(private readonly onError?: (message: string) => void) {
        this.id = crypto.randomUUID();
        this.queue = new SharedEventQueue();
        this.queue.onError = onError;
    }

    open(params: WebSocketOpenParams): boolean {
        // A fresh id + queue per connection, not just once in the constructor: `RoWebSocket`
        // reuses the same transport instance across a reconnect (`Open()` called again after a
        // prior `Close()`), and a per-*instance* (rather than per-*connection*) id would let the
        // main thread's `sockets` map (`webSocketHost.ts`) conflate the old and new connections —
        // e.g. the old socket's `close` listener firing late and deleting the new socket's entry.
        // A per-realm counter would additionally collide across workers (the app worker and every
        // SceneGraph Task worker run this same module fresh, restarting any counter at 1, but all
        // post to the same main-thread map); `crypto.randomUUID()` is the real Web Crypto global
        // here (no `import "crypto"`, so webpack's browser-build fallback for the Node `crypto`
        // module never applies), giving a globally unique id with no cross-thread coordination.
        this.id = crypto.randomUUID();
        this.queue = new SharedEventQueue();
        this.queue.onError = this.onError;
        this.postCommand("open", {
            // Identifies which worker realm owns this socket (0 = app/render thread, >0 = a
            // Task's own thread id) so the main thread can close it when *that* worker ends,
            // without touching sockets any other worker still owns. See `webSocketHost.ts`.
            realm: BrsDevice.threadId,
            buffer: this.queue.getBuffer(),
            ...params,
        });
        // A `postMessage` to the main thread never itself "fails" — an actual connection failure
        // (bad URL, refused, etc.) still arrives later as a real "error" event via the queue.
        return true;
    }

    poll(): WebSocketEventPayload[] {
        return this.queue.drain();
    }

    send(text: string): number {
        return this.postSendCommand("send", { text });
    }

    sendData(bytes: Uint8Array): number {
        return this.postSendCommand("sendData", { dataBase64: Buffer.from(bytes).toString("base64") });
    }

    sendPing(text?: string, bytes?: Uint8Array): number {
        return this.postSendCommand("sendPing", {
            text,
            dataBase64: bytes ? Buffer.from(bytes).toString("base64") : undefined,
        });
    }

    sendPong(text?: string, bytes?: Uint8Array): number {
        return this.postSendCommand("sendPong", {
            text,
            dataBase64: bytes ? Buffer.from(bytes).toString("base64") : undefined,
        });
    }

    /** No-op: browsers give script no control over automatic Pong replies to an incoming Ping —
     *  the browser always auto-replies, invisibly to JS, regardless of this setting. */
    setAutoPingReply(_enable: boolean): void {}

    close(code: number, reason: string): void {
        this.postCommand("close", { code, reason });
    }

    dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.postCommand("dispose", {});
    }

    /** Assigns the message id every send-like command echoes back via a `msgSent` event, and
     *  posts the command with it merged in. */
    private postSendCommand(webSocketCommand: string, extra: Record<string, unknown>): number {
        this.msgSeq += 1;
        this.postCommand(webSocketCommand, { msgId: this.msgSeq, ...extra });
        return this.msgSeq;
    }

    private postCommand(webSocketCommand: string, extra: Record<string, unknown>): void {
        postMessage({ webSocketCommand, id: this.id, ...extra });
    }
}
