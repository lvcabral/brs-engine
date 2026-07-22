/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Worker } from "node:worker_threads";
import {
    AppPayload,
    isExtensionInfo,
    isNDKStart,
    isRegistryData,
    isTaskData,
    isThreadUpdate,
    isTypeOf,
    TaskData,
    TaskPayload,
    TaskState,
    ThreadUpdate,
} from "../core/common";
import SharedObject from "../core/SharedObject";

// NOTE: Keep in sync with `src/api/task.ts` (the browser task broker). Both implement the same
// task-spawn protocol and thread-update relay; only the Worker API and event routing differ.

const MAX_TASKS = 10;

// Active Tasks
const tasks: Map<number, Worker> = new Map();
const threadSyncToTask: Map<number, SharedObject> = new Map();
const threadSyncToMain: Map<number, SharedObject> = new Map();
let sharedBuffer: ArrayBufferLike;
let workerEntry: string;
// Phase 3b: when a task is started with a dedicated fan-out buffer, the render thread delivers
// fan-out and cross-task propagation directly, so the broker stops relaying those.
let directMode: boolean = false;
let inDebugLib: boolean = false;
/// #if DEBUG
inDebugLib = true;
/// #endif

type NotifyCallback = (eventName: string, eventData?: any) => void;
let notifyHost: NotifyCallback = () => {};

/**
 * Initializes the task module with shared buffer and worker entry path.
 * @param buffer Shared ArrayBuffer for inter-thread communication
 * @param entryPath Absolute path to the engine bundle used as the worker entry
 * @param notify Callback used to surface task events to the host
 */
export function initTaskModule(buffer: ArrayBufferLike, entryPath: string, notify: NotifyCallback) {
    sharedBuffer = buffer;
    workerEntry = entryPath;
    notifyHost = notify;
}

/**
 * Creates a SharedObject whose failures (overflow / dropped updates) are surfaced as app-visible
 * errors instead of being silently lost.
 * @returns A new SharedObject wired to report errors through the host notifier.
 */
function createSharedObject(label: string = ""): SharedObject {
    const sharedObject = new SharedObject();
    sharedObject.onError = (message: string) =>
        notifyHost("error", `[task:host]${label ? ` ${label}` : ""} ${message}`);
    return sharedObject;
}

/**
 * Handles task data events from the engine.
 * Starts or stops tasks based on the task state.
 * @param taskData Task data containing state and configuration
 * @param currentPayload Current application payload with manifest and packages
 */
export function handleTaskData(taskData: TaskData, currentPayload: AppPayload) {
    if (taskData.state === TaskState.RUN) {
        // instanceof is realm-sensitive (fails for worker messages under jest's VM sandbox).
        if (taskData.buffer && isTypeOf(taskData.buffer, "SharedArrayBuffer")) {
            const taskBuffer = createSharedObject(`toMain[${taskData.id}]`);
            taskBuffer.setBuffer(taskData.buffer);
            threadSyncToMain.set(taskData.id, taskBuffer);
        }
        runTask(taskData, currentPayload);
    } else if (taskData.state === TaskState.STOP) {
        endTask(taskData.id);
    }
}

/**
 * Starts a new task in a Node worker thread.
 * Creates worker, sets up communication buffers, and posts task payload.
 * @param taskData Task configuration and function name
 * @param currentPayload Current application payload to pass to task
 */
function runTask(taskData: TaskData, currentPayload: AppPayload) {
    if (tasks.has(taskData.id) || !taskData.m?.top?.functionname) {
        notifyHost("debug", `[task:host] Task already running or invalid task data: ${taskData.id}, ${taskData.name}`);
        return;
    } else if (tasks.size === MAX_TASKS) {
        notifyHost("warning", `[task:host] Maximum number of tasks reached: ${tasks.size}`);
        return;
    }
    // Pipe stdout/stderr so console output from inside the task worker becomes a host
    // event instead of writing straight to the terminal (see the app worker in host.ts).
    const taskWorker = new Worker(workerEntry, { stdout: true, stderr: true });
    taskWorker.stdout.on("data", (chunk: Buffer) => notifyHost("stdout", chunk.toString()));
    taskWorker.stderr.on("data", (chunk: Buffer) => notifyHost("stderr", chunk.toString()));
    // A leaked task worker must never keep the host process alive after the app ends.
    taskWorker.unref();
    taskWorker.on("message", taskCallback);
    tasks.set(taskData.id, taskWorker);
    if (isTypeOf(taskData.fanout, "SharedArrayBuffer")) {
        // Phase 3b (direct mode): the render thread owns the render→task fan-out buffer; forward it
        // to the task as its read buffer. The broker does not relay fan-out or cross-task updates.
        directMode = true;
        taskData.buffer = taskData.fanout;
    } else {
        if (!threadSyncToTask.has(taskData.id)) {
            threadSyncToTask.set(taskData.id, createSharedObject(`toTask[${taskData.id}]`));
        }
        taskData.buffer = threadSyncToTask.get(taskData.id)?.getBuffer();
    }
    const taskPayload: TaskPayload = {
        device: currentPayload.device,
        manifest: currentPayload.manifest,
        taskData: taskData,
        extensions: currentPayload.extensions,
        paths: currentPayload.paths,
        pkgZip: currentPayload.pkgZip,
        extZip: currentPayload.extZip,
        password: currentPayload.password,
        // Unlike the browser (always pkgZip), Node apps may mount pkg:/ from a directory.
        root: currentPayload.root,
        ext: currentPayload.ext,
    };
    notifyHost("debug", `[task:host] Calling Task worker: ${taskData.id}, ${taskData.name}`);
    taskWorker.postMessage(sharedBuffer);
    taskWorker.postMessage(taskPayload);
}

/**
 * Terminates a running task worker and cleans up resources.
 * @param taskId ID of the task to terminate
 */
function endTask(taskId: number) {
    const taskWorker = tasks.get(taskId);
    if (taskWorker) {
        taskWorker.removeAllListeners("message");
        taskWorker.terminate().catch(() => {});
        tasks.delete(taskId);
        // Cancel any pending queued writes so an in-flight wait that resolves after the worker is
        // gone can't surface a stale "dropped update" error against the next app to run.
        threadSyncToTask.get(taskId)?.dispose();
        threadSyncToMain.get(taskId)?.dispose();
        threadSyncToTask.delete(taskId);
        threadSyncToMain.delete(taskId);
        notifyHost("debug", `[task:host] Task worker stopped: ${taskId}`);
    }
}

/**
 * Resets all tasks by terminating workers and clearing state.
 */
export function resetTasks() {
    for (const [_id, worker] of tasks) {
        worker.removeAllListeners("message");
        worker.terminate().catch(() => {});
    }
    for (const shared of threadSyncToTask.values()) {
        shared.dispose();
    }
    for (const shared of threadSyncToMain.values()) {
        shared.dispose();
    }
    tasks.clear();
    threadSyncToTask.clear();
    threadSyncToMain.clear();
    directMode = false;
}

/**
 * Handles messages received from task worker threads.
 * Routes registry updates, task state changes and thread updates.
 * @param data Message posted by the task worker
 */
function taskCallback(data: any) {
    if (isRegistryData(data)) {
        notifyHost("registry", data);
    } else if (isExtensionInfo(data)) {
        notifyHost("debug", `[task:host] Loaded Extension: ${data.name} (v${data.version}) from ${data.library}\r\n`);
    } else if (isTaskData(data)) {
        notifyHost("debug", `[task:host] Task data received from Task Thread: ${data.name}, ${TaskState[data.state]}`);
        if (data.state === TaskState.STOP) {
            endTask(data.id);
        }
    } else if (isThreadUpdate(data)) {
        notifyHost(
            "debug",
            `[task:host] Update received from Task thread: ${data.id}, "${data.action}" ${data.type}.${data.key}`
        );
        handleThreadUpdate(data, true);
    } else if (isNDKStart(data)) {
        notifyHost("ndkStart", data);
    } else if (typeof data === "string") {
        notifyHost("message", data);
    } else if (typeof data === "object" && data !== null) {
        // Display/caption state and other component messages are host-level events in Node.
        notifyHost("component", data);
    } else if (inDebugLib) {
        notifyHost("warning", `[task:host] Invalid task message: ${JSON.stringify(data, null, 2)}`);
    }
}

/**
 * Handles thread update events for field synchronization.
 * Propagates updates between the render thread and task threads.
 * @param threadUpdate Thread update data with field changes
 * @param fromTask Whether the update is from a task thread (defaults to false)
 */
export function handleThreadUpdate(threadUpdate: ThreadUpdate, fromTask: boolean = false) {
    if (fromTask) {
        // Update main thread buffer (relay the request/post to the render thread).
        threadSyncToMain.get(threadUpdate.id)?.waitStore(threadUpdate, 1);
        // Phase 3b: in direct mode the render thread performs cross-task propagation itself, so the
        // broker must not also fan a task's set out to the other tasks (which would double-deliver).
        if (directMode) {
            return;
        }
    }
    if (threadUpdate.id > 0 && !fromTask) {
        updateTask(threadUpdate.id, threadUpdate);
    } else if (threadUpdate.type !== "task") {
        // Propagate to other tasks
        for (const taskId of tasks.keys()) {
            if (!fromTask || (taskId !== threadUpdate.id && threadUpdate.action === "set")) {
                updateTask(taskId, threadUpdate);
            }
        }
    }
}

/**
 * Updates a task's shared buffer with thread update data.
 * @param targetId Id of the target task thread to send the update
 * @param data Thread update data with field changes
 */
function updateTask(targetId: number, data: ThreadUpdate) {
    if (directMode) {
        // In direct mode the render thread owns the render→task channel; the broker has no buffer the
        // task actually reads. Routing here means a render-side fan-out escaped the direct path and
        // will be dropped — surface it loudly so the offending update is identifiable.
        notifyHost(
            "warning",
            `[task:host] Direct-mode fan-out leaked to broker for task ${targetId}: {${data.action} ${data.type}.${data.key}} — update will not reach the task`
        );
    }
    if (!threadSyncToTask.has(targetId)) {
        threadSyncToTask.set(targetId, createSharedObject(`toTask[${targetId}]`));
    }
    threadSyncToTask.get(targetId)?.waitStore(data, 1);
}
