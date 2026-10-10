import { SharedEventQueue } from "../SharedEventQueue";
import { SseEventPayload, SseRequestParams, SseTransport } from "./SseTransport";
import { BrsDevice } from "./BrsDevice";

/**
 * Streams `roUrlTransfer.AsyncGetSSEvents()` responses on the browser build. The interpreter's
 * worker busy-spins inside `Wait()`, so the real `fetch()` runs on the main thread
 * (`src/api/sseHost.ts`), same as `WebSocketBridge.ts`: commands go out via `postMessage`, payloads
 * come back through a `SharedEventQueue` this side polls synchronously.
 *
 * A fresh id and queue are minted per request, so payloads of an aborted request land in a queue
 * nobody drains anymore.
 */
export class SseBridge implements SseTransport {
    private id = "";
    private queue?: SharedEventQueue;
    private disposed = false;

    constructor(private readonly onError?: (message: string) => void) {}

    start(params: SseRequestParams): boolean {
        if (this.disposed) {
            return false;
        }
        this.abort();
        this.id = crypto.randomUUID();
        this.queue = new SharedEventQueue();
        this.queue.onError = this.onError;
        postMessage({
            sseCommand: "start",
            id: this.id,
            realm: BrsDevice.threadId,
            buffer: this.queue.getBuffer(),
            ...params,
        });
        return true;
    }

    poll(): SseEventPayload[] {
        if (!this.queue) {
            return [];
        }
        const payloads: SseEventPayload[] = this.queue.drain();
        if (payloads.some((p) => p.type === "end" || p.type === "error")) {
            this.queue = undefined;
        }
        return payloads;
    }

    abort(): void {
        if (this.queue) {
            postMessage({ sseCommand: "abort", id: this.id });
            this.queue = undefined;
        }
    }

    dispose(): void {
        if (!this.disposed) {
            this.abort();
            this.disposed = true;
        }
    }
}
