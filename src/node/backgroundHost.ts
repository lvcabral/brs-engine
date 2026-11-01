/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Hosts the background worker (`src/core/device/BackgroundWorker.ts`) on the Node host thread: one
 * helper per app run, started on first use, with every interpreter thread (the app and each Task)
 * connected to it through its own `MessageChannel` port, sent before the thread's payload. Node port
 * of `src/api/backgroundHost.ts`.
 *
 * Like the app and Task workers, the helper's output is piped and surfaced as host events, and it's
 * terminated when the app ends: a piped stream that has been written to (e.g. a Node deprecation
 * warning) keeps the host process alive until the worker is gone.
 */
import { MessageChannel, Worker } from "node:worker_threads";

/** Receives the helper's console output, like the host's other workers' `stdout`/`stderr` events. */
export type BackgroundOutput = (stream: "stdout" | "stderr", text: string) => void;

let helper: Worker | undefined;
let heartbeat: SharedArrayBuffer | undefined;
let nextThread = 1;

/**
 * Connects an interpreter thread to the background worker, starting it on first use; call before
 * posting the thread's payload. Returns the id to release the thread with when it ends.
 */
export function connectBackground(worker: Worker, workerEntry: string, output?: BackgroundOutput): number {
    if (!helper || !heartbeat) {
        heartbeat = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
        const started = new Worker(workerEntry, { stdout: true, stderr: true });
        started.stdout.on("data", (chunk: Buffer) => output?.("stdout", chunk.toString()));
        started.stderr.on("data", (chunk: Buffer) => output?.("stderr", chunk.toString()));
        started.on("error", () => {});
        // A helper that exits is replaced on the next connect; threads connected to it go synchronous
        started.on("exit", () => {
            if (helper === started) {
                helper = undefined;
            }
        });
        started.unref();
        started.postMessage({ bg: "init", heartbeat });
        helper = started;
    }
    const thread = nextThread++;
    const channel = new MessageChannel();
    helper.postMessage({ bg: "port", thread, port: channel.port1 }, [channel.port1]);
    worker.postMessage({ bg: "connect", port: channel.port2, heartbeat }, [channel.port2]);
    return thread;
}

/** Drops an ended interpreter thread's jobs on the background worker. */
export function releaseBackground(thread: number | undefined) {
    if (thread !== undefined) {
        helper?.postMessage({ bg: "release", thread });
    }
}

/** Terminates the background worker when the app run ends. */
export async function stopBackground() {
    const stopping = helper;
    helper = undefined;
    heartbeat = undefined;
    await stopping?.terminate().catch(() => {});
}
