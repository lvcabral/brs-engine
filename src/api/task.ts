/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
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
import { setAppCaptionStyle, setCaptionMode, setDisplayState } from "./display";
import { SubscribeCallback } from "./util";

const MAX_TASKS = 10;

// Active Tasks
const tasks: Map<number, Worker> = new Map();
const threadSyncToTask: Map<number, SharedObject> = new Map();
const threadSyncToMain: Map<number, SharedObject> = new Map();
let sharedBuffer: ArrayBufferLike;
let brsWrkLib: string;
let inDebugLib: boolean = false;
/// #if DEBUG
inDebugLib = true;
/// #endif

/**
 * Initializes the task module with shared buffer and worker library path.
 * @param buffer Shared ArrayBuffer for inter-thread communication
 * @param libPath Path to the BrightScript worker library
 */
export function initTaskModule(buffer: ArrayBufferLike, libPath: string) {
    sharedBuffer = buffer;
    brsWrkLib = libPath;
}

// Observers Handling
const observers: Map<string, SubscribeCallback> = new Map();
/**
 * Subscribes an observer to task events.
 * @param observerId Unique identifier for the observer
 * @param observerCallback Callback function to receive events
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
/**
 * Notifies all subscribed observers of a task event.
 * @param eventName Name of the event
 * @param eventData Optional data associated with the event
 */
function notifyAll(eventName: string, eventData?: any) {
    for (const [_id, callback] of observers) {
        callback(eventName, eventData);
    }
}

/**
 * Handles task data events from the engine.
 * Starts or stops tasks based on the task state.
 * @param taskData Task data containing state and configuration
 * @param currentPayload Current application payload with manifest and packages
 */
export function handleTaskData(taskData: TaskData, currentPayload: AppPayload) {
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
 * Starts a new task in a Web Worker.
 * Creates worker, sets up communication buffers, and posts task payload.
 * @param taskData Task configuration and function name
 * @param currentPayload Current application payload to pass to task
 */
function runTask(taskData: TaskData, currentPayload: AppPayload) {
    if (tasks.has(taskData.id) || !taskData.m?.top?.functionname) {
        notifyAll("debug", `[task:api] Task already running or invalid task data: ${taskData.id}, ${taskData.name}`);
        return;
    } else if (tasks.size === MAX_TASKS) {
        notifyAll("warning", `[task:api] Maximum number of tasks reached: ${tasks.size}`);
        return;
    }
    const taskWorker = new Worker(brsWrkLib);
    taskWorker.addEventListener("message", taskCallback);
    tasks.set(taskData.id, taskWorker);
    if (!threadSyncToTask.has(taskData.id)) {
        threadSyncToTask.set(taskData.id, new SharedObject());
    }
    taskData.buffer = threadSyncToTask.get(taskData.id)?.getBuffer();
    const taskPayload: TaskPayload = {
        device: currentPayload.device,
        manifest: currentPayload.manifest,
        taskData: taskData,
        extensions: currentPayload.extensions,
        paths: currentPayload.paths,
        pkgZip: currentPayload.pkgZip,
        extZip: currentPayload.extZip,
    };
    notifyAll("debug", `[task:api] Calling Task worker: ${taskData.id}, ${taskData.name}`);
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
        taskWorker.removeEventListener("message", taskCallback);
        taskWorker.terminate();
        tasks.delete(taskId);
        threadSyncToTask.delete(taskId);
        threadSyncToMain.delete(taskId);
        notifyAll("debug", `[task:api] Task worker stopped: ${taskId}`);
    }
}

/**
 * Resets all tasks by terminating workers and clearing state.
 */
export function resetTasks() {
    for (const [_id, worker] of tasks) {
        worker?.removeEventListener("message", taskCallback);
        worker?.terminate();
    }
    tasks.clear();
    threadSyncToTask.clear();
    threadSyncToMain.clear();
}

/**
 * Handles messages received from task Web Workers.
 * Routes registry updates, display settings, and task state changes.
 * @param event MessageEvent from the task worker
 */
function taskCallback(event: MessageEvent) {
    if (isRegistryData(event.data)) {
        notifyAll("registry", event.data);
    } else if (isExtensionInfo(event.data)) {
        notifyAll(
            "debug",
            `[task:api] Loaded Extension: ${event.data.name} (v${event.data.version}) from ${event.data.library}\r\n`
        );
    } else if (typeof event.data.displayEnabled === "boolean") {
        setDisplayState(event.data.displayEnabled);
    } else if (typeof event.data.captionMode === "string") {
        if (setCaptionMode(event.data.captionMode)) {
            notifyAll("captionMode", event.data.captionMode);
        }
    } else if (Array.isArray(event.data.captionStyle)) {
        setAppCaptionStyle(event.data.captionStyle);
    } else if (isTaskData(event.data)) {
        notifyAll(
            "debug",
            `[task:api] Task data received from Task Thread: ${event.data.name}, ${TaskState[event.data.state]}`
        );
        if (event.data.state === TaskState.STOP) {
            endTask(event.data.id);
        }
    } else if (isThreadUpdate(event.data)) {
        notifyAll(
            "debug",
            `[task:api] Update received from Task thread: ${event.data.id}, "${event.data.action}" ${event.data.type}.${event.data.key}`
        );
        handleThreadUpdate(event.data, true);
    } else if (isNDKStart(event.data)) {
        notifyAll("ndkStart", event.data);
    } else if (typeof event.data === "string") {
        notifyAll("message", event.data);
    } else if (inDebugLib) {
        notifyAll("warning", `[task:api] Invalid task message: ${JSON.stringify(event.data, null, 2)}`);
    }
}

/**
 * Handles thread update events for field synchronization.
 * Propagates updates between main thread and task threads.
 * @param threadUpdate Thread update data with field changes
 * @param fromTask Whether the update is from a task thread (defaults to false)
 */
export function handleThreadUpdate(threadUpdate: ThreadUpdate, fromTask: boolean = false) {
    if (fromTask) {
        // Update main thread buffer
        threadSyncToMain.get(threadUpdate.id)?.waitStore(threadUpdate, 1);
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
    if (!threadSyncToTask.has(targetId)) {
        threadSyncToTask.set(targetId, new SharedObject());
    }
    threadSyncToTask.get(targetId)?.waitStore(data, 1);
}
