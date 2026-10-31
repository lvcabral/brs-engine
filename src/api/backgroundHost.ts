/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Hosts the background worker (`src/core/device/BackgroundWorker.ts`) on the page's main thread.
 * A browser only starts a nested worker when its parent turns its event loop, which an interpreter
 * thread never does while an app runs, so the page starts one helper per app run and connects every
 * interpreter thread (the app and each Task) to it through its own `MessageChannel` port, sent
 * before the thread's payload.
 */

let helper: Worker | undefined;
let alive: SharedArrayBuffer | undefined;

/** Starts the app run's background worker; without `SharedArrayBuffer` threads work synchronously. */
export function startBackgroundHost(workerUrl: string) {
    stopBackgroundHost();
    if (typeof SharedArrayBuffer !== "function" || globalThis.crossOriginIsolated === false) {
        return;
    }
    try {
        helper = new Worker(workerUrl);
        alive = new SharedArrayBuffer(2 * Int32Array.BYTES_PER_ELEMENT);
        helper.postMessage({ bg: "init", alive });
    } catch {
        stopBackgroundHost();
    }
}

/** Connects an interpreter thread to the background worker; call before posting its payload. */
export function connectBackground(worker: Worker) {
    if (!helper || !alive) {
        return;
    }
    const channel = new MessageChannel();
    helper.postMessage({ bg: "port", port: channel.port1 }, [channel.port1]);
    worker.postMessage({ bg: "connect", port: channel.port2, alive }, [channel.port2]);
}

/** Stops the background worker when the app run ends. */
export function stopBackgroundHost() {
    helper?.terminate();
    helper = undefined;
    alive = undefined;
}
