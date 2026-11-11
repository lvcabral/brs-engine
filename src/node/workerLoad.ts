/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Tracks when a Node worker thread running the engine bundle has finished loading, so the host
 * never terminates one mid-load.
 *
 * The bundle loads node-canvas, a native module, as it starts. `worker.terminate()` stops the
 * worker's JavaScript at once, so if it lands while canvas's module initializer is still
 * registering its classes, the next N-API call there fails; node-canvas (node-addon-api built
 * without C++ exceptions) then calls `napi_throw`, which also fails in a terminating worker, and
 * node-addon-api treats that as fatal: `FATAL ERROR: Error::ThrowAsJavaScriptException napi_throw`
 * aborts the whole process, not just the worker. Loading takes tens of milliseconds to a couple of
 * seconds, so it's hit by apps (and test suites) that stop a Task soon after starting it.
 *
 * The worker posts a `WorkerReady` message once loaded (`src/core/index.ts`); the hosts call
 * `trackWorkerLoad` when they create a worker and await `waitForWorkerLoad` before terminating it.
 * The task host also holds a task's payload until then (see `task.ts`), since a worker handles the
 * messages queued during its load as soon as it's ready.
 */
import { Worker } from "node:worker_threads";
import { isWorkerReady } from "../core/common";

/**
 * Upper bound on the wait, so a worker that hangs or dies while loading can't stall teardown.
 * Well above a normal load, which on a slow CI host can take a couple of seconds.
 */
const MAX_LOAD_WAIT_MS = 10000;

const loads: WeakMap<Worker, Promise<void>> = new WeakMap();

/**
 * Starts tracking a new worker's load. Call right after creating it, before it can post anything.
 * @param worker Worker running the engine bundle
 */
export function trackWorkerLoad(worker: Worker) {
    const loaded = new Promise<void>((resolve) => {
        const finish = () => {
            worker.off("message", onMessage);
            worker.off("exit", finish);
            resolve();
        };
        const onMessage = (data: any) => {
            if (isWorkerReady(data)) {
                finish();
            }
        };
        worker.on("message", onMessage);
        // A worker that exits (or fails to start) has nothing left to wait for
        worker.once("exit", finish);
    });
    loads.set(worker, loaded);
}

/**
 * Waits until a worker has finished loading (or exited), so it can be terminated safely.
 * Resolves at once for a worker that isn't tracked or has already loaded.
 * @param worker Worker about to be terminated
 * @param maxWaitMs Upper bound on the wait
 * @returns false if the wait gave up after `maxWaitMs` with the worker still loading
 */
export async function waitForWorkerLoad(worker: Worker, maxWaitMs = MAX_LOAD_WAIT_MS): Promise<boolean> {
    const loaded = loads.get(worker);
    if (!loaded) {
        return true;
    }
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), maxWaitMs);
        timer.unref();
    });
    const finished = await Promise.race([loaded.then(() => true), timeout]);
    clearTimeout(timer);
    return finished;
}
