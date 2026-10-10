import { SharedEventQueue } from "../core/SharedEventQueue";
import { SSE_CONNECT_ERROR, SSE_RECV_ERROR } from "../core/device/SseTransport";

/**
 * Runs the streaming `fetch()` requests behind `roUrlTransfer.AsyncGetSSEvents()` on the browser
 * build. Lives on the main thread (shared by `src/api/index.ts` and `src/api/task.ts`) because the
 * interpreter's worker busy-spins inside `Wait()` and could never service the response stream
 * itself — see `src/core/device/SseBridge.ts` for the worker-side half.
 */

interface SseCommandBase {
    sseCommand: "start" | "abort";
    id: string;
}

interface StartCommand extends SseCommandBase {
    sseCommand: "start";
    /** Owning worker's thread id (0 = app/render thread, >0 = a Task) — see `disposeSseForRealm`. */
    realm: number;
    buffer: SharedArrayBuffer;
    url: string;
    method: string;
    headers: Record<string, string>;
}

type SseCommand = StartCommand | SseCommandBase;

/** Type guard for the worker→main SSE command channel (see `SseBridge.ts`). */
export function isSseCommand(data: any): data is SseCommand {
    return (
        data !== null && typeof data === "object" && typeof data.sseCommand === "string" && typeof data.id === "string"
    );
}

interface ActiveRequest {
    controller: AbortController;
    realm: number;
}

const requests = new Map<string, ActiveRequest>();

/** Queue bytes kept free for the terminal `end`/`error` payload. */
const TERMINAL_RESERVE = 64 * 1024;
/** Longest text per `chunk` payload, so even a fully escaped one fits the queue. */
const MAX_CHUNK_CHARS = 256 * 1024;
const DRAIN_POLL_MS = 10;

/** Aborts every request started by the given worker realm, so a terminated worker's streams don't
 *  outlive it. */
export function disposeSseForRealm(realm: number): void {
    for (const [id, entry] of requests) {
        if (entry.realm === realm) {
            entry.controller.abort();
            requests.delete(id);
        }
    }
}

/** Dispatches one worker→main SSE command. Call from each host's own worker message handler. */
export function handleSseCommand(cmd: SseCommand): void {
    if (cmd.sseCommand === "start") {
        startRequest(cmd as StartCommand);
    } else if (cmd.sseCommand === "abort") {
        requests.get(cmd.id)?.controller.abort();
        requests.delete(cmd.id);
    }
}

function startRequest(cmd: StartCommand): void {
    const { id, url, method, headers } = cmd;
    const queue = SharedEventQueue.fromBuffer(cmd.buffer);
    const controller = new AbortController();
    requests.set(id, { controller, realm: cmd.realm });
    streamResponse(url, method, headers, queue, controller.signal)
        .catch(() => {
            // Errors are reported through the queue.
        })
        .finally(() => {
            if (requests.get(id)?.controller === controller) {
                requests.delete(id);
            }
        });
}

/** Performs the request, pushing `SseEventPayload`s (`SseTransport.ts`) to the queue as they arrive. */
async function streamResponse(
    url: string,
    method: string,
    headers: Record<string, string>,
    queue: SharedEventQueue,
    signal: AbortSignal
): Promise<void> {
    let response: Response;
    try {
        response = await fetch(url, { method, headers, signal, cache: "no-store" });
    } catch (err: any) {
        if (!signal.aborted) {
            queue.push({ type: "error", code: SSE_CONNECT_ERROR, message: err?.message ?? String(err) });
        }
        return;
    }
    const headerLines: string[] = [];
    for (const [key, value] of response.headers) {
        headerLines.push(`${key}: ${value}`);
    }
    queue.push({
        type: "response",
        status: response.status,
        statusText: response.statusText,
        headers: headerLines.join("\r\n"),
        contentType: response.headers.get("content-type") ?? "",
    });
    if (!response.body) {
        queue.push({ type: "end" });
        return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            if (!(await pushChunk(queue, decoder.decode(value, { stream: true }), signal))) {
                return;
            }
        }
        if (await pushChunk(queue, decoder.decode(), signal)) {
            queue.push({ type: "end" });
        }
    } catch (err: any) {
        if (!signal.aborted) {
            queue.push({ type: "error", code: SSE_RECV_ERROR, message: err?.message ?? String(err) });
        }
    }
}

/** Pushes text as `chunk` payloads, waiting for the worker to drain the queue rather than dropping
 *  data when it is full. Returns `false` if the request was aborted while waiting. */
async function pushChunk(queue: SharedEventQueue, text: string, signal: AbortSignal): Promise<boolean> {
    for (let offset = 0; offset < text.length; offset += MAX_CHUNK_CHARS) {
        const frame = SharedEventQueue.encode({ type: "chunk", text: text.slice(offset, offset + MAX_CHUNK_CHARS) });
        while (!queue.tryPush(frame, TERMINAL_RESERVE)) {
            if (signal.aborted) {
                return false;
            }
            await new Promise((resolve) => setTimeout(resolve, DRAIN_POLL_MS));
        }
    }
    return !signal.aborted;
}
