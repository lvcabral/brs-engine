/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Hosts the background worker (`src/core/device/BackgroundWorker.ts`) on the page's main thread:
 * one helper for the page, started on first use, with every interpreter thread (the app and each
 * Task) connected to it through its own `MessageChannel` port, sent before the thread's payload.
 * Mirrored for Node by `src/node/backgroundHost.ts`.
 */

let helper: Worker | undefined;
let heartbeat: SharedArrayBuffer | undefined;
let nextThread = 1;

/**
 * Connects an interpreter thread to the background worker; call before posting its payload.
 * Returns the id to release it with when the thread ends, or `undefined` if it'll run synchronously.
 */
export function connectBackground(worker: Worker, workerUrl: string): number | undefined {
    if (typeof SharedArrayBuffer !== "function" || globalThis.crossOriginIsolated === false) {
        return undefined;
    }
    if (!helper || !heartbeat) {
        heartbeat = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
        helper = new Worker(workerUrl);
        helper.postMessage({ bg: "init", heartbeat });
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
