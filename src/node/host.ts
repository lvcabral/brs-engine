/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from "node:path";
import { Worker } from "node:worker_threads";
import { ImageData as NodeImageData } from "canvas";
import {
    AppExitReason,
    AppPayload,
    DataBufferIndex,
    DataBufferSize,
    DataType,
    DebugCommand,
    isAppData,
    isExtensionInfo,
    isFrameData,
    isGraphicsData,
    isNDKStart,
    isRegistryData,
    isTaskData,
    isThreadUpdate,
    RegistryInitialSize,
    RegistryMaxSize,
    TaskState,
} from "../core/common";
import SharedObject from "../core/SharedObject";
import { handleTaskData, handleThreadUpdate, initTaskModule, resetTasks } from "./task";

/**
 * Node worker host: runs a BrightScript app on a dedicated `worker_threads` thread (the render
 * thread) and spawns additional worker threads for SceneGraph Tasks, mirroring the browser
 * architecture (`src/api/index.ts` + `src/api/task.ts`). The calling (main) thread stays free
 * to broker task rendezvous, relay input via the shared control array, and drive the debugger.
 */

export interface ExecuteAppOptions {
    /** Control SharedArrayBuffer (keys, sounds, debug commands). Created when not provided. */
    sharedBuffer?: SharedArrayBuffer;
    /** Absolute path to the engine bundle used as the worker entry. Defaults to this bundle. */
    workerEntry?: string;
}

export interface AppResult {
    exitReason: AppExitReason;
}

type SubscribeCallback = (event: string, data?: any) => void;

// Observers Handling
const observers: Map<string, SubscribeCallback> = new Map();

/**
 * Subscribes an observer to host events (message, frame, registry, graphics, end, ...).
 * @param observerId Unique identifier for the observer
 * @param observerCallback Callback function to receive events
 */
export function subscribeHost(observerId: string, observerCallback: SubscribeCallback) {
    observers.set(observerId, observerCallback);
}

/**
 * Unsubscribes an observer from host events.
 * @param observerId Unique identifier of the observer to remove
 */
export function unsubscribeHost(observerId: string) {
    observers.delete(observerId);
}

/**
 * Notifies all subscribed observers of a host event.
 * @param eventName Name of the event
 * @param eventData Optional data associated with the event
 */
function notifyAll(eventName: string, eventData?: any) {
    for (const [_id, callback] of observers) {
        callback(eventName, eventData);
    }
}

// App worker state
let appWorker: Worker | undefined;
let currentPayload: AppPayload | undefined;
let controlArray: Int32Array | undefined;
let finishApp: ((result: AppResult) => void) | undefined;
// Reason for a host-initiated termination (home key, Ctrl+C, terminateApp caller): it
// overrides the reason the worker posts, mirroring the browser API's terminate(reason) —
// the worker only knows it was told to EXIT, not that the user pressed home.
let terminateReason: AppExitReason | undefined;

/**
 * Executes a BrightScript app on a dedicated worker thread, with SceneGraph Task support.
 * The returned promise resolves when the app finishes (the worker posts `end,<reason>`).
 * Note: package encryption (`--pack`) is not supported here — its result is a function return
 * value, not a message; use the synchronous `executeFile` for packaging.
 * @param payload Application payload with source code, manifest and device configuration
 * @param options Optional host configuration (control buffer, worker entry path)
 * @returns Promise resolving to the app result with the exit reason
 */
export async function executeApp(payload: AppPayload, options?: ExecuteAppOptions): Promise<AppResult> {
    if (appWorker) {
        throw new Error("An app is already running on the worker host.");
    }
    const workerEntry = options?.workerEntry ?? path.join(__dirname, "brs.node.js");
    let sharedBuffer = options?.sharedBuffer;
    if (!sharedBuffer) {
        const arrayLength = DataBufferIndex + DataBufferSize;
        sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * arrayLength);
        new Int32Array(sharedBuffer).fill(-1);
    }
    controlArray = new Int32Array(sharedBuffer);
    // Share the registry across all threads (render + tasks), mirroring the browser API.
    if (!payload.device.registryBuffer) {
        const registryBuffer = new SharedObject(RegistryInitialSize, RegistryMaxSize);
        registryBuffer.store(Object.fromEntries(payload.device.registry ?? new Map()));
        payload.device.registryBuffer = registryBuffer.getBuffer();
    }
    initTaskModule(sharedBuffer, workerEntry, notifyAll);
    currentPayload = payload;
    return new Promise<AppResult>((resolve) => {
        finishApp = (result: AppResult) => {
            finishApp = undefined;
            cleanupApp().finally(() => resolve(result));
        };
        // Pipe the worker's stdout/stderr instead of inheriting the process streams: any
        // console output from inside the worker (engine diagnostics, third-party libraries)
        // must reach the host as an event, never the terminal directly — in frame-rendering
        // modes a stray write lands inside the frame region and flickers the screen.
        appWorker = new Worker(workerEntry, { stdout: true, stderr: true });
        appWorker.stdout.on("data", (chunk: Buffer) => notifyAll("stdout", chunk.toString()));
        appWorker.stderr.on("data", (chunk: Buffer) => notifyAll("stderr", chunk.toString()));
        appWorker.on("message", mainCallback);
        appWorker.on("error", (err: Error) => {
            notifyAll("error", `[host] App worker error: ${err.message}`);
            finishApp?.({ exitReason: AppExitReason.Crashed });
        });
        appWorker.postMessage(sharedBuffer);
        appWorker.postMessage(payload);
    });
}

/**
 * Requests the running app to terminate gracefully (same as the ECP `exit-app` command).
 * Falls back to hard-terminating the worker if it does not finish within the timeout.
 * @param reason Exit reason reported for this termination (default: user navigation/home)
 * @param timeoutMs How long to wait for a graceful exit before force-terminating
 */
export function terminateApp(reason: AppExitReason = AppExitReason.UserNav, timeoutMs: number = 3000) {
    if (!appWorker || !controlArray) {
        return;
    }
    terminateReason = reason;
    Atomics.store(controlArray, DataType.DBG, DebugCommand.EXIT);
    Atomics.notify(controlArray, DataType.DBG);
    const timer = setTimeout(() => {
        finishApp?.({ exitReason: reason });
    }, timeoutMs);
    timer.unref();
}

/**
 * Stops all task workers and the app worker, releasing host state.
 */
async function cleanupApp() {
    resetTasks();
    const worker = appWorker;
    appWorker = undefined;
    currentPayload = undefined;
    controlArray = undefined;
    terminateReason = undefined;
    if (worker) {
        worker.removeAllListeners();
        await worker.terminate().catch(() => {});
    }
}

/**
 * Handles messages received from the app (render thread) worker.
 * Routes frames, registry, task spawn requests and thread updates; everything else is
 * surfaced to host subscribers.
 * @param data Message posted by the app worker
 */
function mainCallback(data: any) {
    if (isFrameData(data)) {
        // Revive the flattened frame into a real node-canvas ImageData instance. The pixels may
        // come from another JS realm (jest VM sandbox), where instanceof-based native checks
        // fail — rewrap them in a local Uint8ClampedArray view over the same buffer.
        let pixels: Uint8ClampedArray = data.frameData;
        if (!(pixels instanceof Uint8ClampedArray)) {
            const foreign = pixels as Uint8ClampedArray;
            pixels = new Uint8ClampedArray(foreign.buffer, foreign.byteOffset, foreign.byteLength);
        }
        notifyAll("frame", new NodeImageData(pixels, data.frameWidth, data.frameHeight));
    } else if (isRegistryData(data)) {
        notifyAll("registry", data);
    } else if (isGraphicsData(data)) {
        notifyAll("graphics", data);
    } else if (isExtensionInfo(data)) {
        notifyAll("debug", `[host] Loaded Extension: ${data.name} (v${data.version}) from ${data.library}`);
    } else if (isAppData(data)) {
        notifyAll("launch", { app: data.id, params: data.params ?? new Map() });
    } else if (isTaskData(data)) {
        notifyAll("debug", `[host] Task data received from Render Thread: ${data.name}, ${TaskState[data.state]}`);
        if (currentPayload) {
            handleTaskData(data, currentPayload);
        }
    } else if (isThreadUpdate(data)) {
        notifyAll(
            "debug",
            `[host] Update received from Render thread: ${data.id}, "${data.action}" ${data.type}.${data.key}`
        );
        handleThreadUpdate(data);
    } else if (isNDKStart(data)) {
        notifyAll("ndkStart", data);
    } else if (typeof data === "string") {
        if (data.startsWith("end,")) {
            // A host-initiated termination (home key, terminateApp) reports its own reason:
            // the worker unwinds via the debugger EXIT path and would report Stopped.
            const reason = terminateReason ?? getExitReason(data.slice(4).trimEnd());
            notifyAll("message", `end,${reason}`);
            finishApp?.({ exitReason: reason });
            return;
        }
        notifyAll("message", data);
    } else if (typeof data === "object" && data !== null) {
        // Display/caption state and other component messages are host-level events in Node.
        notifyAll("component", data);
    }
}

/**
 * Converts an exit reason string posted by the worker into an AppExitReason value.
 * @param reason Exit reason text from the `end,<reason>` message
 * @returns Matching AppExitReason (or Unknown)
 */
function getExitReason(reason: string): AppExitReason {
    if (Object.values(AppExitReason).includes(reason as AppExitReason)) {
        return reason as AppExitReason;
    }
    return AppExitReason.Unknown;
}
