/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import path from "node:path";
import { Worker } from "node:worker_threads";
import {
    AppPayload,
    isExtensionInfo,
    isNDKStart,
    isRegistryData,
    isTaskData,
    isThreadUpdate,
    TaskData,
    TaskPayload,
    TaskState,
    ThreadUpdate,
} from "../core/common";
import SharedObject from "../core/SharedObject";
import { SubscribeCallback } from "../api/util";

const MAX_TASKS = 10;

const tasks: Map<number, Worker> = new Map();
const taskListeners: Map<number, {
    onMessage: (data: any) => void;
    onError: (error: Error) => void;
    onExit: (code: number) => void;
}> = new Map();
const threadSyncToTask: Map<number, SharedObject> = new Map();
const threadSyncToMain: Map<number, SharedObject> = new Map();
let sharedBuffer: ArrayBufferLike | undefined;
let workerScript: string | undefined;

// Observers Handling
const observers: Map<string, SubscribeCallback> = new Map();

/**
 * Initializes the task module with shared buffer and worker script path.
 * @param buffer Shared ArrayBuffer for inter-thread communication
 * @param workerPath Absolute path to the compiled task worker script
 */
export function initTaskModule(buffer: ArrayBufferLike, workerPath?: string) {
    sharedBuffer = buffer;
    workerScript = workerPath ?? path.resolve(__dirname, "brs.task.js");
}

/**
 * Subscribes an observer to task events.
 * @param observerId Unique identifier for the observer
 * @param observerCallback Callback invoked for task events
 */
export function subscribeTask(observerId: string, observerCallback: SubscribeCallback) {
    observers.set(observerId, observerCallback);
}

/**
 * Unsubscribes an observer from task events.
 * @param observerId Unique identifier of the observer to remove
 */
export function unsubscribeTask(observerId: string) {
    observers.delete(observerId);
}

function notifyAll(eventName: string, eventData?: any) {
    for (const [_id, callback] of observers) {
        callback(eventName, eventData);
    }
}

function pipeWorkerStream(stream: NodeJS.ReadableStream | null | undefined, level: "debug" | "error") {
    if (!stream) {
        return false;
    }
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => {
        for (const line of chunk.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (trimmed.length === 0) {
                continue;
            }
            console.log(`[cli-task] ${level} stream> ${trimmed}`);
            notifyAll(level, trimmed);
        }
    });
    return true;
}

function runTask(taskData: TaskData, currentPayload: AppPayload) {
    if (!sharedBuffer || !workerScript) {
        notifyAll("error", "[cli-task] Task module not initialized with worker script and buffer.");
        return;
    }
    if (tasks.has(taskData.id) || !taskData.m?.top?.functionname) {
        notifyAll("warning", `[cli-task] Task already running or invalid data: ${taskData.id}, ${taskData.name}`);
        return;
    } else if (tasks.size === MAX_TASKS) {
        notifyAll("warning", `[cli-task] Maximum number of tasks reached: ${tasks.size}`);
        return;
    }

    if (!threadSyncToTask.has(taskData.id)) {
        threadSyncToTask.set(taskData.id, new SharedObject());
    }
    taskData.buffer = threadSyncToTask.get(taskData.id)?.getBuffer();

    const taskPayload: TaskPayload = {
        device: currentPayload.device,
        manifest: currentPayload.manifest,
        taskData: taskData,
        extensions: currentPayload.extensions,
        pkgZip: currentPayload.pkgZip,
        extZip: currentPayload.extZip,
        root: currentPayload.root,
        ext: currentPayload.ext,
    };

    try {
        const worker = new Worker(workerScript, { stdout: true, stderr: true });
        const stdoutAttached = pipeWorkerStream(worker.stdout, "debug");
        const stderrAttached = pipeWorkerStream(worker.stderr, "error");
        if (!stdoutAttached) {
            notifyAll("warning", `[cli-task] Worker stdout stream unavailable for task ${taskData.id}`);
        }
        if (!stderrAttached) {
            notifyAll("warning", `[cli-task] Worker stderr stream unavailable for task ${taskData.id}`);
        }
        const onMessage = (data: any) => {
            taskCallback(taskData.id, data);
        };
        const onError = (error: Error) => {
            notifyAll("error", `[cli-task] Worker error for ${taskData.name}: ${error.message}`);
            endTask(taskData.id);
        };
        const onExit = (code: number) => {
            notifyAll("debug", `[cli-task] Task worker exited (${taskData.id}) with code ${code}`);
            cleanupTask(taskData.id);
        };

        worker.on("message", onMessage);
        worker.on("error", onError);
        worker.on("exit", onExit);
        tasks.set(taskData.id, worker);
        taskListeners.set(taskData.id, { onMessage, onError, onExit });
        notifyAll("debug", `[cli-task] Task worker started: ${taskData.id}, ${taskData.name}`);
        worker.postMessage(sharedBuffer);
        worker.postMessage(taskPayload);
    } catch (error: any) {
        notifyAll("error", `[cli-task] Failed to start task worker ${taskData.name}: ${error.message}`);
    }
}

function cleanupTask(taskId: number) {
    tasks.delete(taskId);
    taskListeners.delete(taskId);
    threadSyncToTask.delete(taskId);
    threadSyncToMain.delete(taskId);
}

function endTask(taskId: number) {
    const worker = tasks.get(taskId);
    const listeners = taskListeners.get(taskId);
    if (worker && listeners) {
        worker.removeListener("message", listeners.onMessage);
        worker.removeListener("error", listeners.onError);
        worker.removeListener("exit", listeners.onExit);
        worker.terminate().catch(() => {
            // ignore termination errors
        });
    }
    cleanupTask(taskId);
}

/**
 * Resets all running tasks.
 */
export function resetTasks() {
    for (const taskId of tasks.keys()) {
        endTask(taskId);
    }
    tasks.clear();
    taskListeners.clear();
    threadSyncToTask.clear();
    threadSyncToMain.clear();
}

function taskCallback(taskId: number, data: any) {
    if (isRegistryData(data)) {
        notifyAll("registry", data);
    } else if (isExtensionInfo(data)) {
        notifyAll("debug", `[cli-task] Loaded Extension: ${data.name} (v${data.version}) from ${data.library}`);
    } else if (typeof data === "string") {
        notifyAll("message", data);
    } else if (isTaskData(data)) {
        notifyAll("debug", `[cli-task] Task data received: ${data.name}, ${TaskState[data.state]}`);
        if (data.state === TaskState.STOP) {
            endTask(data.id);
        }
    } else if (isThreadUpdate(data)) {
        notifyAll("debug", `[cli-task] Thread update from task ${data.id}: ${data.field}`);
        handleThreadUpdate(data, true);
    } else if (isNDKStart(data)) {
        notifyAll("ndkStart", data);
    } else {
        notifyAll("warning", `[cli-task] Invalid task message: ${JSON.stringify(data)}`);
    }
}

/**
 * Handles task data events from the interpreter.
 * @param taskData Task data object with state and configuration
 * @param currentPayload Current app payload to clone data from
 */
export function handleTaskData(taskData: TaskData, currentPayload?: AppPayload) {
    if (!currentPayload) {
        notifyAll("warning", `[cli-task] Ignoring task event ${taskData.name}: payload unavailable.`);
        return;
    }
    if (taskData.state === TaskState.RUN) {
        if (taskData.buffer instanceof SharedArrayBuffer) {
            const taskBuffer = new SharedObject();
            taskBuffer.setBuffer(taskData.buffer);
            threadSyncToMain.set(taskData.id, taskBuffer);
        }
        runTask(taskData, currentPayload);
    } else if (taskData.state === TaskState.STOP) {
        endTask(taskData.id);
    }
}

/**
 * Handles thread update propagation between main interpreter and tasks.
 * @param threadUpdate Thread update data structure
 * @param fromTask Whether the update originated from a task thread
 */
export function handleThreadUpdate(threadUpdate: ThreadUpdate, fromTask: boolean = false) {
    if (fromTask) {
        threadSyncToMain.get(threadUpdate.id)?.waitStore(threadUpdate, 1);
    }
    if (threadUpdate.id > 0 && !fromTask) {
        if (!threadSyncToTask.has(threadUpdate.id)) {
            threadSyncToTask.set(threadUpdate.id, new SharedObject());
        }
        threadSyncToTask.get(threadUpdate.id)?.waitStore(threadUpdate, 1);
    } else if (threadUpdate.type !== "task") {
        for (const taskId of tasks.keys()) {
            if (!fromTask || taskId !== threadUpdate.id) {
                const data = { ...threadUpdate, id: taskId };
                if (!threadSyncToTask.has(data.id)) {
                    threadSyncToTask.set(data.id, new SharedObject());
                }
                threadSyncToTask.get(data.id)?.waitStore(data, 1);
            }
        }
    }
}
