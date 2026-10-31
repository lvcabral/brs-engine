/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Background worker: runs the work a device does off the BrightScript thread (asynchronous HTTP
 * transfers, texture downloads and image decoding) on a helper worker. The host starts the helper
 * (`src/api/backgroundHost.ts` in the browser, `src/node/backgroundHost.ts` in Node), running the
 * same engine bundle, and connects every interpreter thread (the app and each Task) to it through
 * its own `MessagePort`, sent before the thread's payload. The host does it because a browser only
 * starts a nested worker once its parent turns its event loop, which an interpreter thread never
 * does while an app runs.
 *
 * For the same reason, the interpreter thread can't receive `postMessage` replies. Everything
 * flowing back to it goes through shared memory, polled with `Atomics`:
 *
 * 1. The interpreter posts a job with a small shared control block and keeps polling it.
 * 2. The helper runs the job, holds the result, and publishes its size (`Ready`).
 * 3. The interpreter allocates a shared buffer of exactly that size and posts it to the helper.
 * 4. The helper copies the result into it (`Delivered`).
 *
 * Helper liveness is a heartbeat counter in shared memory: while it doesn't move (the helper hasn't
 * booted, is stuck on a huge decode, or is gone), jobs run on the synchronous path instead.
 */
import { isTypeOf } from "../common";
import { decodeImage, toBytes } from "./ImageDecoder";
/// #if !BROWSER
import { XMLHttpRequest } from "../polyfill/XMLHttpRequest";
/// #endif

/** An HTTP request run by the background worker, mirroring `XMLHttpRequest`'s inputs. */
export interface HttpJobParams {
    method: string;
    /** Final URL (CORS proxy already applied). */
    url: string;
    user?: string;
    password?: string;
    headers: [string, string][];
    withCredentials: boolean;
    responseType: "text" | "arraybuffer";
    body?: string | Uint8Array;
}

/** Result metadata of an `http` job; the payload is the response body. */
export interface HttpJobResult {
    status: number;
    statusText: string;
    headers: string;
    /** Set when the request failed before an HTTP response (network error). */
    error?: string;
}

/** Result metadata of an `image` job; the payload is `width * height * 4` RGBA8 bytes. */
export interface ImageJobResult {
    width: number;
    height: number;
    /** Set when the download or the decode failed. */
    error?: string;
}

/** Binary inputs (`image`, an `http` body) are transferred to the helper: pass copies nothing else uses. */
export type BackgroundJobParams =
    | { kind: "http"; http: HttpJobParams }
    /** Decode `image`, or download it first from `http` (a GET that must return 200). */
    | { kind: "image"; image?: Uint8Array; http?: HttpJobParams };

/**
 * A settled job's result: its metadata and payload (a view on shared memory: copy it before keeping
 * it), or a `failure` when the thread couldn't receive the result (e.g. too large to allocate).
 */
export type BackgroundJobResult<T = any> =
    | { meta: T; payload: Uint8Array; failure?: undefined }
    | { failure: string; meta?: undefined; payload?: undefined };

enum JobState {
    Running = 0,
    /** The helper holds the result; `length` is its encoded size. */
    Ready = 1,
    /** The result was copied into the buffer the interpreter sent. */
    Delivered = 2,
}

const StateIdx = 0;
const LengthIdx = 1;
const ControlInts = 2;
const HeartbeatMs = 250;
/** Heartbeat silence after which jobs run synchronously: the helper hasn't booted, is busy or is gone. */
const StallTimeoutMs = 15000;
/** Liveness is checked at most this often, not once per pending job on every poll. */
const AliveCheckMs = 100;
/** Largest result accepted (the biggest decoded bitmaps are 8192x8192 RGBA8). */
const MaxResultBytes = 512 * 1024 * 1024;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const Empty: Uint8Array = new Uint8Array(0);

/** The `MessagePort` surface shared by the browser and Node `worker_threads`. */
interface Port {
    postMessage(message: BackgroundMessage, transfer?: any[]): void;
    close(): void;
    onmessage: ((event: MessageEvent) => void) | null;
}

// Interpreter side ------------------------------------------------------------------------------

let helper: Port | undefined;
/** The helper's heartbeat counter: 0 until it boots, then bumped every `HeartbeatMs`. */
let heartbeat: Int32Array | undefined;
let lastBeat = 0;
let lastBeatTime = 0;
let lastAliveCheck = 0;
let stalled = false;
let nextJobId = 1;
const activeJobs = new Map<number, BackgroundJob>();

/** A job running on the background worker. */
export class BackgroundJob<T = any> {
    private buffer?: SharedArrayBuffer;
    private settled = false;
    /** The job's result, once settled; `undefined` if it has to run synchronously instead. */
    result?: BackgroundJobResult<T>;

    constructor(readonly id: number, private readonly control: Int32Array) {}

    /** Advances the job without blocking; returns `true` once it's settled. */
    poll(): boolean {
        if (this.settled) {
            return true;
        }
        const state = Atomics.load(this.control, StateIdx);
        if (state === JobState.Delivered && this.buffer) {
            this.settle(decodeResult<T>(this.buffer));
        } else if (state === JobState.Ready && !this.buffer) {
            this.sendBuffer();
        } else {
            helperResponsive();
        }
        return this.settled;
    }

    /** Blocks until the job settles or `timeoutMs` elapses; returns `true` if it settled. */
    wait(timeoutMs: number): boolean {
        const deadline = performance.now() + timeoutMs;
        while (!this.poll()) {
            if (performance.now() >= deadline) {
                return false;
            }
            try {
                Atomics.wait(this.control, StateIdx, Atomics.load(this.control, StateIdx), 20);
            } catch {
                // Atomics.wait isn't allowed on this thread; keep polling
            }
        }
        return true;
    }

    /** Stops the job and releases its result on the helper; the caller runs it synchronously if needed. */
    cancel() {
        if (!this.settled) {
            this.settle();
            helper?.postMessage({ bg: "cancel", id: this.id });
        }
    }

    private settle(result?: BackgroundJobResult<T>) {
        this.result = result;
        this.settled = true;
        activeJobs.delete(this.id);
    }

    private sendBuffer() {
        const length = this.control[LengthIdx];
        try {
            if (length > MaxResultBytes) {
                throw new RangeError(`result too large (${length} bytes)`);
            }
            this.buffer = new SharedArrayBuffer(length);
        } catch (err: any) {
            helper?.postMessage({ bg: "cancel", id: this.id });
            this.settle({ failure: err.message });
            return;
        }
        helper?.postMessage({ bg: "buffer", id: this.id, buffer: this.buffer });
    }
}

/**
 * Whether this thread has jobs in flight. A port callback that blocks while idle (a SceneGraph
 * Task waiting for field updates) must wake regularly while it's true, or nothing polls the jobs.
 */
export function backgroundJobsPending(): boolean {
    return activeJobs.size > 0;
}

/** Whether jobs can run in the background: the host connected this thread and the helper responds. */
export function backgroundAvailable(): boolean {
    return helperResponsive();
}

/** Starts a job, or returns `undefined` if it has to run synchronously instead. */
export function startBackgroundJob<T = any>(params: BackgroundJobParams): BackgroundJob<T> | undefined {
    if (!helper || !helperResponsive()) {
        return undefined;
    }
    const control = new SharedArrayBuffer(ControlInts * Int32Array.BYTES_PER_ELEMENT);
    const job = new BackgroundJob<T>(nextJobId++, new Int32Array(control));
    activeJobs.set(job.id, job);
    const input = params.kind === "http" ? params.http.body : params.image;
    const transfer = input instanceof Uint8Array ? [input.buffer] : [];
    helper.postMessage({ bg: "job", id: job.id, control, params }, transfer);
    return job;
}

/** Connects this interpreter thread to the helper the host started (see the module docs). */
function connectHelper(port: Port, heartbeatBuffer: SharedArrayBuffer) {
    helper = port;
    heartbeat = new Int32Array(heartbeatBuffer);
    lastBeat = Atomics.load(heartbeat, 0);
    lastBeatTime = performance.now();
    stalled = false;
}

/**
 * Whether the helper is connected and its heartbeat moved recently. When it stops, the jobs in
 * flight run synchronously (they're cancelled), and new ones start again once it moves.
 */
function helperResponsive(): boolean {
    if (!heartbeat) {
        return false;
    }
    const now = performance.now();
    if (now - lastAliveCheck >= AliveCheckMs) {
        lastAliveCheck = now;
        const beat = Atomics.load(heartbeat, 0);
        if (beat !== lastBeat) {
            lastBeat = beat;
            lastBeatTime = now;
            stalled = false;
        } else if (!stalled && now - lastBeatTime > StallTimeoutMs) {
            stalled = true;
            for (const job of activeJobs.values()) {
                job.cancel();
            }
        }
    }
    return !stalled;
}

function decodeResult<T>(buffer: SharedArrayBuffer): BackgroundJobResult<T> {
    const metaLength = new DataView(buffer).getUint32(0);
    // TextDecoder rejects views on shared memory, so decode a copy
    const meta = JSON.parse(textDecoder.decode(new Uint8Array(buffer, 4, metaLength).slice()));
    return { meta, payload: new Uint8Array(buffer, 4 + metaLength) };
}

// Helper worker side ----------------------------------------------------------------------------

type BackgroundMessage =
    /** From the host to the helper: start the heartbeat. */
    | { bg: "init"; heartbeat: SharedArrayBuffer }
    /** From the host to the helper: the port of one more interpreter thread. */
    | { bg: "port"; thread: number; port: Port }
    /** From the host to the helper: an interpreter thread ended, drop its jobs. */
    | { bg: "release"; thread: number }
    /** From the host to an interpreter thread: its port to the helper. */
    | { bg: "connect"; port: Port; heartbeat: SharedArrayBuffer }
    | { bg: "job"; id: number; control: SharedArrayBuffer; params: BackgroundJobParams }
    | { bg: "buffer"; id: number; buffer: SharedArrayBuffer }
    | { bg: "cancel"; id: number };

interface HeldJob {
    control: Int32Array;
    /** Set once the job finished: its encoded metadata and payload. */
    result?: { meta: Uint8Array; payload: Uint8Array };
    xhr?: XMLHttpRequest;
}

/** Jobs of one interpreter thread, keyed by their id (unique per thread). */
type HeldJobs = Map<number, HeldJob>;

/** The interpreter threads connected to this helper, by the host's thread id. */
const threads = new Map<number, { port: Port; jobs: HeldJobs }>();

export function isBackgroundMessage(value: any): value is BackgroundMessage {
    return value !== null && typeof value === "object" && typeof value.bg === "string";
}

/** Handles a background message on the helper (from the host) or an interpreter thread (`connect`). */
export function handleBackgroundMessage(message: BackgroundMessage) {
    if (message.bg === "init" && isTypeOf(message.heartbeat, "SharedArrayBuffer")) {
        const beat = new Int32Array(message.heartbeat);
        Atomics.add(beat, 0, 1);
        setInterval(() => Atomics.add(beat, 0, 1), HeartbeatMs);
    } else if (message.bg === "port") {
        const jobs: HeldJobs = new Map();
        threads.set(message.thread, { port: message.port, jobs });
        message.port.onmessage = (event: MessageEvent) => {
            if (isBackgroundMessage(event.data)) {
                handleThreadMessage(event.data, jobs);
            }
        };
    } else if (message.bg === "release") {
        const thread = threads.get(message.thread);
        threads.delete(message.thread);
        for (const held of thread?.jobs.values() ?? []) {
            held.xhr?.abort();
        }
        thread?.jobs.clear();
        thread?.port.close();
    } else if (message.bg === "connect") {
        connectHelper(message.port, message.heartbeat);
    }
}

/** Runs on the helper: handles a message from one interpreter thread. */
function handleThreadMessage(message: BackgroundMessage, jobs: HeldJobs) {
    if (message.bg === "job") {
        runJob(jobs, message.id, new Int32Array(message.control), message.params);
    } else if (message.bg === "buffer") {
        deliverJob(jobs, message.id, message.buffer);
    } else if (message.bg === "cancel") {
        jobs.get(message.id)?.xhr?.abort();
        jobs.delete(message.id);
    }
}

async function runJob(jobs: HeldJobs, id: number, control: Int32Array, params: BackgroundJobParams) {
    const held: HeldJob = { control };
    jobs.set(id, held);
    let meta: HttpJobResult | ImageJobResult;
    let payload = Empty;
    try {
        // `httpRequest` reports its own errors, so only an image job can throw (a corrupt image)
        if (params.kind === "http") {
            ({ meta, payload } = await httpRequest(params.http, held));
        } else {
            ({ meta, payload } = await imageJob(params, held));
        }
    } catch (err: any) {
        ({ meta, payload } = imageFailure(err?.message ?? String(err)));
    }
    if (jobs.get(id) !== held) {
        return; // cancelled
    }
    const encoded = textEncoder.encode(JSON.stringify(meta));
    held.result = { meta: encoded, payload };
    held.xhr = undefined;
    control[LengthIdx] = 4 + encoded.length + payload.length;
    Atomics.store(control, StateIdx, JobState.Ready);
    Atomics.notify(control, StateIdx);
}

async function imageJob(params: { image?: Uint8Array; http?: HttpJobParams }, held: HeldJob) {
    let image = params.image;
    if (params.http) {
        const response = await httpRequest(params.http, held);
        if (response.meta.error || response.meta.status !== 200) {
            const reason = response.meta.error ?? `${response.meta.statusText} (${response.meta.status})`;
            return imageFailure(`HTTP Error downloading: ${reason}`);
        }
        image = response.payload;
    }
    const decoded = image ? decodeImage(image) : undefined;
    const length = decoded ? decoded.width * decoded.height * 4 : 0;
    if (!decoded || decoded.data.length < length) {
        return imageFailure("Invalid image format");
    }
    return { meta: { width: decoded.width, height: decoded.height }, payload: decoded.data.subarray(0, length) };
}

function imageFailure(error: string): { meta: ImageJobResult; payload: Uint8Array } {
    return { meta: { width: 0, height: 0, error }, payload: Empty };
}

async function httpRequest(
    params: HttpJobParams,
    held: HeldJob
): Promise<{ meta: HttpJobResult; payload: Uint8Array }> {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        held.xhr = xhr;
        let error: string | undefined;
        xhr.addEventListener("error", () => {
            error = xhr.statusText || "Network error";
        });
        xhr.addEventListener("loadend", () => {
            let payload = Empty;
            if (!error && xhr.response && typeof xhr.response !== "string") {
                // The raw body (the Node polyfill keeps it for any response type), decoded by the receiver
                payload = toBytes(xhr.response);
            } else if (!error && params.responseType === "text") {
                payload = textEncoder.encode(xhr.responseText ?? "");
            }
            const headers = xhr.getAllResponseHeaders();
            resolve({
                meta: {
                    status: error && !xhr.status ? networkErrorStatus() : xhr.status,
                    statusText: error ?? xhr.statusText ?? "",
                    headers: typeof headers === "string" ? headers : "",
                    error,
                },
                payload,
            });
        });
        try {
            xhr.open(params.method, params.url, true, params.user, params.password);
            xhr.responseType = helperResponseType(params.responseType);
            for (const [key, value] of params.headers) {
                xhr.setRequestHeader(key, value);
            }
            xhr.withCredentials = params.withCredentials;
            // Bodies are posted as exact copies, so a binary one is always backed by a plain ArrayBuffer
            const body = params.body;
            const data =
                typeof body === "string" || !body
                    ? body
                    : Buffer.from(body.buffer as ArrayBuffer, body.byteOffset, body.byteLength);
            xhr.send(data);
        } catch (err: any) {
            resolve({
                meta: { status: networkErrorStatus(), statusText: err.message, headers: "", error: err.message },
                payload: Empty,
            });
        }
    });
}

/**
 * The response type the helper requests. Node's polyfill keeps the raw body for any type, so it
 * asks for binary and skips decoding text the receiver decodes anyway; a browser decodes text by
 * the response's charset, which raw bytes would lose.
 */
function helperResponseType(type: "text" | "arraybuffer"): "text" | "arraybuffer" {
    /// #if BROWSER
    return type;
    /// #else
    return "arraybuffer"; // NOSONAR - ifdef-selected branch, not truly unreachable
    /// #endif
}

/** Status a network failure reports, matching each platform's synchronous transfer. */
function networkErrorStatus() {
    /// #if BROWSER
    return 0;
    /// #else
    return 503; // NOSONAR - ifdef-selected branch, not truly unreachable
    /// #endif
}

function deliverJob(jobs: HeldJobs, id: number, buffer: SharedArrayBuffer) {
    const held = jobs.get(id);
    if (!held?.result) {
        return;
    }
    jobs.delete(id);
    const { meta, payload } = held.result;
    const bytes = new Uint8Array(buffer);
    new DataView(buffer).setUint32(0, meta.length);
    bytes.set(meta, 4);
    bytes.set(payload, 4 + meta.length);
    Atomics.store(held.control, StateIdx, JobState.Delivered);
    Atomics.notify(held.control, StateIdx);
}
