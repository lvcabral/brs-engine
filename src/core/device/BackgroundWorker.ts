/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Background worker: runs the work a device does off the BrightScript thread (asynchronous HTTP
 * transfers, texture downloads and image decoding) on a helper worker, one per interpreter thread.
 * The helper runs the same engine bundle, so no extra deployment file is needed.
 *
 * The interpreter thread busy-spins in `RoMessagePort.wait()` and never turns its event loop, so it
 * can't receive `postMessage` replies or worker `error` events. Everything flowing back to it goes
 * through shared memory, polled with `Atomics`:
 *
 * 1. The interpreter posts a job with a small shared control block and keeps polling it.
 * 2. The helper runs the job, holds the result, and publishes its size (`Ready`).
 * 3. The interpreter allocates a shared buffer of exactly that size and posts it to the helper.
 * 4. The helper copies the result into it (`Delivered`).
 *
 * Helper liveness is tracked the same way: it sets a boot flag and bumps a heartbeat counter, so
 * a helper that never starts, or stops responding, fails its jobs over to the synchronous path.
 */
import { BrsDevice } from "./BrsDevice";
import { isTypeOf } from "../common";
import { decodeImage, toBytes } from "./ImageDecoder";
/// #if !BROWSER
import fs from "node:fs";
import path from "node:path";
import { Worker as NodeWorker } from "node:worker_threads";
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

/** A settled job's result. `payload` is a view on shared memory: copy it before keeping it. */
export interface BackgroundJobResult<T = any> {
    meta: T;
    payload: Uint8Array;
}

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
const AliveInts = 2;
const BootedIdx = 0;
const BeatIdx = 1;
const HeartbeatMs = 250;
/** Time for a new helper to load the engine bundle and boot. */
const BootTimeoutMs = 15000;
/** Heartbeat silence after which the helper counts as dead (a decode runs on its event loop). */
const StallTimeoutMs = 15000;
/** Liveness is checked at most this often, not once per pending job on every poll. */
const AliveCheckMs = 100;
/** Largest result accepted (the biggest decoded bitmaps are 8192x8192 RGBA8). */
const MaxResultBytes = 512 * 1024 * 1024;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const Empty: Uint8Array = new Uint8Array(0);

// Interpreter side ------------------------------------------------------------------------------

interface HelperWorker {
    postMessage(message: BackgroundMessage, transfer?: any): void;
    terminate(): unknown;
}

let helper: HelperWorker | undefined;
let helperUnavailable = false;
let alive: Int32Array | undefined;
let spawnTime = 0;
let lastBeat = -1;
let lastBeatTime = 0;
let lastAliveCheck = 0;
/** Heartbeat value when the helper stalled; it's used again once the heartbeat moves on. */
let stalledBeat: number | undefined;
let nextJobId = 1;
let workerEntry: string | undefined;
const activeJobs = new Map<number, BackgroundJob>();

/** A job running on the background worker. */
export class BackgroundJob<T = any> {
    private buffer?: SharedArrayBuffer;
    private settled = false;
    /** The job's result, once settled; `undefined` if the helper was lost (run it synchronously). */
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
            checkHelperAlive();
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

    /** Stops the job and releases its result on the helper. */
    cancel() {
        if (!this.settled) {
            this.settle();
            helper?.postMessage({ bg: "cancel", id: this.id });
        }
    }

    /** Settles the job; without a result, the caller runs it synchronously. */
    settle(result?: BackgroundJobResult<T>) {
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
            this.settle({ meta: { error: err.message } as T, payload: Empty });
            return;
        }
        helper?.postMessage({ bg: "buffer", id: this.id, buffer: this.buffer });
    }
}

/**
 * Connects this interpreter thread to the helper the page started (browser): a browser doesn't
 * start a nested worker while its parent busy-spins, so the thread can't spawn its own.
 */
function connectBackgroundPort(port: MessagePort, aliveBuffer: SharedArrayBuffer) {
    helper = {
        postMessage: (message: BackgroundMessage, transfer?: any) => port.postMessage(message, transfer ?? []),
        terminate: () => {
            port.postMessage({ bg: "close" });
            port.close();
        },
    };
    helperUnavailable = false;
    stalledBeat = undefined;
    alive = new Int32Array(aliveBuffer);
    spawnTime = performance.now();
    lastBeat = -1;
}

/**
 * Whether this thread has jobs in flight. A port callback that blocks while idle (a SceneGraph
 * Task waiting for field updates) must wake regularly while it's true, or nothing polls the jobs.
 */
export function backgroundJobsPending(): boolean {
    return activeJobs.size > 0;
}

/** Sets the engine bundle the Node helper worker runs (the host's configurable worker entry). */
export function setBackgroundWorkerEntry(entry: string | undefined) {
    workerEntry = entry;
}

/** Whether jobs can run in the background on this thread, spawning the helper on first call. */
export function backgroundAvailable(): boolean {
    if (!helper && !helperUnavailable) {
        helper = spawnHelper();
        helperUnavailable = !helper;
    }
    if (helper && alive && stalledBeat !== undefined) {
        const beat = Atomics.load(alive, BeatIdx);
        if (beat === stalledBeat) {
            return false;
        }
        stalledBeat = undefined;
        lastBeat = beat;
        lastBeatTime = performance.now();
    }
    return !!helper;
}

/** Starts a job, or returns `undefined` if it has to run synchronously instead. */
export function startBackgroundJob<T = any>(params: BackgroundJobParams): BackgroundJob<T> | undefined {
    if (!backgroundAvailable() || !helper) {
        return undefined;
    }
    const control = new SharedArrayBuffer(ControlInts * Int32Array.BYTES_PER_ELEMENT);
    const job = new BackgroundJob<T>(nextJobId++, new Int32Array(control));
    activeJobs.set(job.id, job);
    const input = params.kind === "http" ? params.http.body : params.image;
    const transfer = input instanceof Uint8Array ? [input.buffer as ArrayBuffer] : [];
    helper.postMessage({ bg: "job", id: job.id, control, params }, transfer);
    return job;
}

function spawnHelper(): HelperWorker | undefined {
    if (typeof SharedArrayBuffer !== "function" || (globalThis as any).crossOriginIsolated === false) {
        return undefined;
    }
    const aliveBuffer = new SharedArrayBuffer(AliveInts * Int32Array.BYTES_PER_ELEMENT);
    try {
        const worker = createHelperWorker();
        if (!worker) {
            return undefined;
        }
        alive = new Int32Array(aliveBuffer);
        spawnTime = performance.now();
        lastBeat = -1;
        worker.postMessage({ bg: "init", alive: aliveBuffer });
        return worker;
    } catch (err: any) {
        if (BrsDevice.isDevMode) {
            BrsDevice.stderr.write(`warning,[core] Unable to start the background worker: ${err.message}`);
        }
        return undefined;
    }
}

function createHelperWorker(): HelperWorker | undefined {
    /// #if BROWSER
    // The page starts the helper and connects it (`connectBackgroundPort`); without that, run synchronously
    return undefined;
    /// #else
    const entry = workerEntry ?? path.join(__dirname, "brs.node.js");
    if (!BrsDevice.isWorkerThread || !fs.existsSync(entry)) {
        return undefined; // NOSONAR - ifdef-selected branch, not truly unreachable
    }
    const nodeWorker = new NodeWorker(entry, { stdout: true, stderr: true });
    nodeWorker.stdout.resume();
    nodeWorker.stderr.resume();
    // Only seen once the interpreter thread turns its event loop; the heartbeat covers the rest.
    nodeWorker.on("error", () => loseHelper(false));
    nodeWorker.on("exit", () => {
        if (helper === nodeWorker) {
            loseHelper(false);
        }
    });
    nodeWorker.unref();
    return nodeWorker;
    /// #endif
}

/** Fails over all running jobs if the helper never booted or stopped responding. */
function checkHelperAlive() {
    const now = performance.now();
    if (!alive || now - lastAliveCheck < AliveCheckMs) {
        return;
    }
    lastAliveCheck = now;
    if (!Atomics.load(alive, BootedIdx)) {
        if (now - spawnTime > BootTimeoutMs) {
            loseHelper(true);
        }
        return;
    }
    const beat = Atomics.load(alive, BeatIdx);
    if (beat !== lastBeat) {
        lastBeat = beat;
        lastBeatTime = now;
    } else if (now - lastBeatTime > StallTimeoutMs && stalledBeat === undefined) {
        // Busy (e.g. a huge decode) or hung: run what's in flight synchronously, and send new
        // jobs again once the heartbeat moves (`backgroundAvailable`)
        stalledBeat = beat;
        for (const job of activeJobs.values()) {
            job.cancel();
        }
    }
}

/**
 * Drops the helper and settles its running jobs without a result. A helper that never booted
 * (e.g. its script can't load) is not respawned; one that crashed is, on next use (Node).
 */
function loseHelper(permanent: boolean) {
    const worker = helper;
    helper = undefined;
    alive = undefined;
    stalledBeat = undefined;
    helperUnavailable ||= permanent;
    for (const job of activeJobs.values()) {
        job.settle();
    }
    worker?.terminate();
}

function decodeResult<T>(buffer: SharedArrayBuffer): BackgroundJobResult<T> {
    const metaLength = new DataView(buffer).getUint32(0);
    // TextDecoder rejects views on shared memory, so decode a copy
    const meta = JSON.parse(textDecoder.decode(new Uint8Array(buffer, 4, metaLength).slice()));
    return { meta, payload: new Uint8Array(buffer, 4 + metaLength) };
}

// Helper worker side ----------------------------------------------------------------------------

type BackgroundMessage =
    | { bg: "init"; alive: SharedArrayBuffer }
    /** To the helper: a port connecting it to one more interpreter thread (browser). */
    | { bg: "port"; port: MessagePort }
    /** To an interpreter thread: its port to the helper the page started (browser). */
    | { bg: "connect"; port: MessagePort; alive: SharedArrayBuffer }
    | { bg: "job"; id: number; control: SharedArrayBuffer; params: BackgroundJobParams }
    | { bg: "buffer"; id: number; buffer: SharedArrayBuffer }
    | { bg: "cancel"; id: number }
    /** To the helper over a thread's port: the thread is done with it (browser). */
    | { bg: "close" };

interface HeldJob {
    control: Int32Array;
    meta?: Uint8Array;
    payload?: Uint8Array;
    xhr?: XMLHttpRequest;
}

/** Jobs of one interpreter thread, keyed by their id (unique per thread). */
type HeldJobs = Map<number, HeldJob>;

const heldJobs: HeldJobs = new Map();

export function isBackgroundMessage(value: any): value is BackgroundMessage {
    return value !== null && typeof value === "object" && typeof value.bg === "string";
}

/** Runs on the helper worker: handles a message from its interpreter thread. */
export function handleBackgroundMessage(message: BackgroundMessage, jobs: HeldJobs = heldJobs) {
    if (message.bg === "init" && isTypeOf(message.alive, "SharedArrayBuffer")) {
        const aliveView = new Int32Array(message.alive);
        Atomics.store(aliveView, BootedIdx, 1);
        setInterval(() => Atomics.add(aliveView, BeatIdx, 1), HeartbeatMs);
    } else if (message.bg === "port") {
        const port = message.port;
        const portJobs: HeldJobs = new Map();
        port.onmessage = (event: MessageEvent) => {
            if (!isBackgroundMessage(event.data)) {
                return;
            }
            if (event.data.bg === "close") {
                for (const held of portJobs.values()) {
                    held.xhr?.abort();
                }
                portJobs.clear();
                port.close();
            } else {
                handleBackgroundMessage(event.data, portJobs);
            }
        };
    } else if (message.bg === "connect") {
        connectBackgroundPort(message.port, message.alive);
    } else if (message.bg === "job") {
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
    held.meta = textEncoder.encode(JSON.stringify(meta));
    held.payload = payload;
    held.xhr = undefined;
    control[LengthIdx] = 4 + held.meta.length + payload.length;
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
            xhr.responseType = params.responseType;
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
    if (!held?.meta || !held.payload) {
        return;
    }
    jobs.delete(id);
    const bytes = new Uint8Array(buffer);
    new DataView(buffer).setUint32(0, held.meta.length);
    bytes.set(held.meta, 4);
    bytes.set(held.payload, 4 + held.meta.length);
    Atomics.store(held.control, StateIdx, JobState.Delivered);
    Atomics.notify(held.control, StateIdx);
}
