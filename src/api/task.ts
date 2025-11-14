/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import {
    AppPayload,
    isNDKStart,
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

const tasks: Map<number, Worker> = new Map();
const threadSyncToTask: Map<number, SharedObject> = new Map();
const threadSyncToMain: Map<number, SharedObject> = new Map();
let sharedBuffer: ArrayBufferLike;
let brsWrkLib: string;

// Initialize Task Module
export function initTaskModule(buffer: ArrayBufferLike, libPath: string) {
    sharedBuffer = buffer;
    brsWrkLib = libPath;
}

// Observers Handling
const observers: Map<string, SubscribeCallback> = new Map();
export function subscribeTask(observerId: string, observerCallback: SubscribeCallback) {
    observers.set(observerId, observerCallback);
}
export function unsubscribeTask(observerId: string) {
    observers.delete(observerId);
}
function notifyAll(eventName: string, eventData?: any) {
    for (const [_id, callback] of observers) {
        callback(eventName, eventData);
    }
}

// Task Handling
function runTask(taskData: TaskData, currentPayload: AppPayload) {
    if (tasks.has(taskData.id) || !taskData.m?.top?.functionname) {
        return;
    } else if (tasks.size === 10) {
        notifyAll("warning", `[api] Maximum number of tasks reached: ${tasks.size}`);
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
        pkgZip: currentPayload.pkgZip,
        extZip: currentPayload.extZip,
    };
    console.debug("[API] Calling Task worker: ", taskData.id, taskData.name);
    taskWorker.postMessage(sharedBuffer);
    taskWorker.postMessage(taskPayload);
}

function endTask(taskId: number) {
    const taskWorker = tasks.get(taskId);
    if (taskWorker) {
        taskWorker.removeEventListener("message", taskCallback);
        taskWorker.terminate();
        tasks.delete(taskId);
        threadSyncToTask.delete(taskId);
        threadSyncToMain.delete(taskId);
        console.debug("[API] Task worker stopped: ", taskId);
    }
}

export function resetTasks() {
    for (const [_id, worker] of tasks) {
        worker?.removeEventListener("message", taskCallback);
        worker?.terminate();
    }
    tasks.clear();
    threadSyncToTask.clear();
    threadSyncToMain.clear();
}

// Receive Messages from the Task Interpreter (Web Worker)
function taskCallback(event: MessageEvent) {
    if (event.data instanceof Map) {
        notifyAll("registry", event.data);
    } else if (typeof event.data.displayEnabled === "boolean") {
        setDisplayState(event.data.displayEnabled);
    } else if (typeof event.data.captionMode === "string") {
        if (setCaptionMode(event.data.captionMode)) {
            notifyAll("captionMode", event.data.captionMode);
        }
    } else if (Array.isArray(event.data.captionStyle)) {
        setAppCaptionStyle(event.data.captionStyle);
    } else if (isTaskData(event.data)) {
        console.debug("[API] Task data received from Task Thread: ", event.data.name, TaskState[event.data.state]);
        if (event.data.state === TaskState.STOP) {
            endTask(event.data.id);
        }
    } else if (isThreadUpdate(event.data)) {
        console.debug("[API] Update received from Task thread: ", event.data.id, event.data.field);
        handleThreadUpdate(event.data, true);
    } else if (isNDKStart(event.data)) {
        notifyAll("ndkStart", event.data);
    } else if (typeof event.data === "string") {
        notifyAll("message", event.data);
    } else {
        notifyAll("warning", `[api] Invalid task message: ${JSON.stringify(event.data, null, 2)}`);
    }
}

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
    } else {
        console.debug("[API] Thread update with invalid data!", JSON.stringify(threadUpdate, null, 2));
    }
}
