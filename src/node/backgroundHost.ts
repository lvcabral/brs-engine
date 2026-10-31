/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Hosts the background worker (`src/core/device/BackgroundWorker.ts`) on the Node host thread: one
 * helper for the host, started on first use, with every interpreter thread (the app and each Task)
 * connected to it through its own `MessageChannel` port, sent before the thread's payload. Node port
 * of `src/api/backgroundHost.ts`.
 */
import { MessageChannel, Worker } from "node:worker_threads";

let helper: Worker | undefined;
let heartbeat: SharedArrayBuffer | undefined;
let nextThread = 1;

/**
 * Connects an interpreter thread to the background worker; call before posting its payload.
 * Returns the id to release it with when the thread ends.
 */
export function connectBackground(worker: Worker, workerEntry: string): number {
    if (!helper || !heartbeat) {
        heartbeat = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
        // Piped like every worker so it never writes to the terminal (threading-and-rendezvous.md),
        // but never read: a consumed stream keeps the host process alive despite `unref()`. The
        // helper doesn't print.
        const started = new Worker(workerEntry, { stdout: true, stderr: true });
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
