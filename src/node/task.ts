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
    isChannelCredData,
    isRendezvousEvent,
    isTaskData,
    isThreadUpdate,
    isTypeOf,
    isWorkerReady,
    TaskData,
    TaskPayload,
    TaskState,
    ThreadUpdate,
} from "../core/common";
import SharedObject from "../core/SharedObject";
import { connectBackground, releaseBackground } from "./backgroundHost";
import { trackWorkerLoad, waitForWorkerLoad } from "./workerLoad";

// NOTE: Keep in sync with `src/api/task.ts` (the browser task broker). Both implement the same
// task-spawn protocol and thread-update relay; only the Worker API and event routing differ.

/**
 * Concurrent task workers allowed at once. This is purely a guardrail against a runaway app spawning
 * workers without end. Apps built around a persistent worker pool park several tasks in permanent loops
 * and still need headroom for the transient ones, so the ceiling has to sit well above the pool size.
 * Reaching it no longer drops the task: see `pendingTasks`.
 */
const MAX_TASKS = 30;

// Active Tasks
const tasks: Map<number, Worker> = new Map();
/** A stopped task's worker and the per-run resources it held, taken out of the maps for teardown. */
interface TaskThread {
    id: number;
    worker: Worker;
    background?: number;
    toTask?: SharedObject;
    toMain?: SharedObject;
}
/** Teardowns in progress (see `endTask`). Their workers still count against `MAX_TASKS`. */
const stoppingTasks: Set<Promise<void>> = new Set();
/** Set while `resetTasks` runs: a task launched during it belongs to the app being torn down. */
let resetting = false;
/** Each task thread's connection to the background worker (`backgroundHost.ts`). */
const backgroundThreads: Map<number, number> = new Map();
/** Task workers that have started running (see `drainWorkerOutput`). */
const onlineWorkers: WeakSet<Worker> = new WeakSet();
/**
 * Launches deferred because `MAX_TASKS` was reached, oldest first, started as slots free.
 *
 * The cap used to drop the launch outright, and the task node had already flipped to `started`, so
 * it never retried — leaving it in `state = "run"` with no thread behind it for the rest of the
 * session. A cap is a throttle, not a cliff: an app that fans out more sections than there are
 * slots should load them late, not lose them.
 */
const pendingTasks: { taskData: TaskData; payload: AppPayload }[] = [];
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
        // instanceof is realm-sensitive (fails for worker messages under a VM-sandboxed test runner pool).
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
    } else if (tasks.size + stoppingTasks.size >= MAX_TASKS) {
        if (!pendingTasks.some((pending) => pending.taskData.id === taskData.id)) {
            pendingTasks.push({ taskData, payload: currentPayload });
        }
        notifyHost(
            "warning",
            `[task:host] Maximum number of tasks reached (${tasks.size + stoppingTasks.size}), queued: ${
                taskData.id
            }, ${taskData.name}`
        );
        return;
    }
    // Pipe stdout/stderr so console output from inside the task worker becomes a host
    // event instead of writing straight to the terminal (see the app worker in host.ts).
    const taskWorker = new Worker(workerEntry, { stdout: true, stderr: true });
    trackWorkerLoad(taskWorker);
    taskWorker.stdout.on("data", (chunk: Buffer) => notifyHost("stdout", chunk.toString()));
    taskWorker.stderr.on("data", (chunk: Buffer) => notifyHost("stderr", chunk.toString()));
    // A leaked task worker must never keep the host process alive after the app ends.
    taskWorker.unref();
    taskWorker.once("online", () => onlineWorkers.add(taskWorker));
    taskWorker.on("message", (data: any) => taskCallback(data, taskWorker));
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
    backgroundThreads.set(taskData.id, connectBackground(taskWorker, workerEntry));
    postPayloadWhenLoaded(taskWorker, taskPayload);
}

/**
 * Posts a task's payload once its worker has loaded, unless the task was stopped (or all tasks are
 * being reset) in the meantime.
 * A worker handles the messages queued during its load as soon as it's ready, so a payload posted
 * up front would start a task that has already been stopped.
 * @param worker Task worker
 * @param payload Payload that starts the task
 */
async function postPayloadWhenLoaded(worker: Worker, payload: TaskPayload) {
    const { id, name } = payload.taskData;
    if (!(await waitForWorkerLoad(worker))) {
        notifyHost(
            "warning",
            `[task:host] Task worker did not report it had loaded, starting it anyway: ${id}, ${name}`
        );
    }
    if (tasks.get(id) === worker && !resetting) {
        worker.postMessage(payload);
    }
}

/**
 * Waits for a task worker to go quiet before it is force-terminated.
 *
 * `worker.terminate()` races the delivery of a message the worker already sent: a BrightScript
 * `print` reaches the host via `OutputProxy`'s `postMessage(str)` (see `src/core/device/
 * OutputProxy.ts`), a channel entirely independent of whatever unrelated signal (another thread
 * setting `control = "stop"`, or the app itself ending) triggered this termination. A print issued
 * moments earlier can still be in flight when the kill lands, silently dropping it -- unlike a
 * worker's own trailing print before its own "stop"/"end" message, which shares that same channel
 * and is reliably ordered ahead of it. Confirmed with a standalone worker_threads repro:
 * terminating immediately after an unrelated worker's message loses the target's last postMessage
 * a meaningful fraction of the time (worse under CPU load); a short quiet window after its last
 * message eliminates the loss. The caller must keep the worker's real "message" listener attached
 * during the wait -- this only tracks activity, it never substitutes for it -- and remove it
 * afterward, once quiet.
 *
 * The quiet window only starts once the worker is running (its "online" event): a worker that
 * hasn't started yet has produced no activity, and on a slow host its startup alone can outlast
 * `quietMs`, which would mistake "hasn't started" for "already done" and lose its first message.
 * @param worker Task worker about to be terminated
 * @param quietMs How long the worker must be silent before considering it drained
 * @param maxWaitMs Upper bound so a worker that keeps producing output can't stall shutdown
 */
async function drainWorkerOutput(worker: Worker, quietMs = 50, maxWaitMs = 500): Promise<void> {
    return new Promise((resolve) => {
        let quietTimer: NodeJS.Timeout;
        const onActivity = () => {
            clearTimeout(quietTimer);
            quietTimer = setTimeout(finish, quietMs).unref();
        };
        const maxTimer = setTimeout(finish, maxWaitMs).unref();
        function finish() {
            clearTimeout(maxTimer);
            clearTimeout(quietTimer);
            worker.off("online", onActivity);
            worker.off("message", onActivity);
            worker.stdout.off("data", onActivity);
            worker.stderr.off("data", onActivity);
            resolve();
        }
        // "message" is the real print/debug/warning transport; stdout/stderr only catch a stray
        // write that bypassed OutputProxy (engine internals, third-party libraries).
        worker.on("message", onActivity);
        worker.stdout.on("data", onActivity);
        worker.stderr.on("data", onActivity);
        if (onlineWorkers.has(worker)) {
            quietTimer = setTimeout(finish, quietMs).unref();
        } else {
            worker.once("online", onActivity);
        }
    });
}

/**
 * Terminates a running task worker and cleans up resources.
 * @param taskId ID of the task to terminate
 */
async function endTask(taskId: number) {
    // A task stopped before its queued launch got a slot must not start afterwards.
    const queued = pendingTasks.findIndex((pending) => pending.taskData.id === taskId);
    if (queued >= 0) {
        pendingTasks.splice(queued, 1);
    }
    const thread = detachTask(taskId);
    if (thread) {
        await stopTaskThread(thread);
    }
    startPendingTasks();
}

/**
 * Takes a task out of the broker at once, before its worker is torn down: a new run of the same task
 * then gets its own worker and buffers, and a second stop of this run finds nothing to stop.
 * @param taskId ID of the task to detach
 * @returns The task's worker and resources, or undefined if it isn't running
 */
function detachTask(taskId: number): TaskThread | undefined {
    const worker = tasks.get(taskId);
    if (!worker) {
        return undefined;
    }
    const thread: TaskThread = {
        id: taskId,
        worker,
        background: backgroundThreads.get(taskId),
        toTask: threadSyncToTask.get(taskId),
        toMain: threadSyncToMain.get(taskId),
    };
    tasks.delete(taskId);
    backgroundThreads.delete(taskId);
    threadSyncToTask.delete(taskId);
    threadSyncToMain.delete(taskId);
    return thread;
}

/**
 * Tears down a detached task, tracked in `stoppingTasks` until it's done.
 * @param thread Task detached by `detachTask`
 */
async function stopTaskThread(thread: TaskThread) {
    const stopping = terminateTaskThread(thread);
    stoppingTasks.add(stopping);
    await stopping;
    stoppingTasks.delete(stopping);
}

/**
 * Terminates a detached task's worker and releases its resources.
 * @param thread Task detached by `detachTask`
 */
async function terminateTaskThread(thread: TaskThread) {
    const { id, worker } = thread;
    // A task stopped right after it started may still be loading: terminating it then would abort
    // the whole process (see workerLoad.ts).
    await waitForWorkerLoad(worker);
    // Drain before detaching the real "message" listener: a print in flight when this was called
    // must still reach taskCallback/notifyHost, not just be waited on.
    await drainWorkerOutput(worker);
    worker.removeAllListeners("message");
    worker.terminate().catch(() => {});
    releaseBackground(thread.background);
    // Cancel any pending queued writes so an in-flight wait that resolves after the worker is gone
    // can't surface a stale "dropped update" error against the next app to run.
    thread.toTask?.dispose();
    thread.toMain?.dispose();
    notifyHost("debug", `[task:host] Task worker stopped: ${id}`);
}

/** Starts queued launches, oldest first, while slots are free. */
function startPendingTasks() {
    while (pendingTasks.length > 0 && tasks.size + stoppingTasks.size < MAX_TASKS) {
        const next = pendingTasks.shift()!;
        notifyHost("debug", `[task:host] Starting queued Task: ${next.taskData.id}, ${next.taskData.name}`);
        runTask(next.taskData, next.payload);
    }
}

/**
 * Resets all tasks by terminating workers and clearing state.
 */
export async function resetTasks() {
    // Queued launches belong to the app being torn down; starting them against the next one would
    // spawn workers with a stale payload.
    pendingTasks.length = 0;
    // Tear every task down concurrently, real "message" listener still attached while it drains:
    // sequential draining would multiply the (usually negligible) quiet-window wait by the number of
    // still-running tasks. Repeat until none is left, since the app can still launch a task while
    // the others load and drain, and it must not outlive the app.
    resetting = true;
    try {
        while (tasks.size > 0 || stoppingTasks.size > 0) {
            for (const taskId of tasks.keys()) {
                const thread = detachTask(taskId);
                if (thread) {
                    stopTaskThread(thread);
                }
            }
            await Promise.all(stoppingTasks);
        }
    } finally {
        resetting = false;
    }
    // Buffers of launches that never got a worker (queued, or rejected as invalid)
    for (const shared of threadSyncToTask.values()) {
        shared.dispose();
    }
    for (const shared of threadSyncToMain.values()) {
        shared.dispose();
    }
    threadSyncToTask.clear();
    threadSyncToMain.clear();
    directMode = false;
}

/**
 * Handles messages received from task worker threads.
 * Routes registry updates, task state changes and thread updates.
 * @param data Message posted by the task worker
 * @param worker Task worker that posted it
 */
function taskCallback(data: any, worker: Worker) {
    if (isWorkerReady(data)) {
        // Handled by workerLoad.ts
        return;
    } else if (isRegistryData(data)) {
        notifyHost("registry", data);
    } else if (isChannelCredData(data)) {
        notifyHost("channelCredentials", data);
    } else if (isRendezvousEvent(data)) {
        notifyHost("rendezvous", data);
    } else if (isExtensionInfo(data)) {
        notifyHost("debug", `[task:host] Loaded Extension: ${data.name} (v${data.version}) from ${data.library}\r\n`);
    } else if (isTaskData(data)) {
        notifyHost("debug", `[task:host] Task data received from Task Thread: ${data.name}, ${TaskState[data.state]}`);
        // A stopped run's worker, still draining, must not stop a new run of the same task
        if (data.state === TaskState.STOP && tasks.get(data.id) === worker) {
            endTask(data.id);
        }
    } else if (isThreadUpdate(data)) {
        if (tasks.get(data.id) !== worker) {
            // The run that sent it is stopped, and a new run of the same task may already own its id
            return;
        }
        notifyHost(
            "debug",
            `[task:host] Update received from Task thread: ${data.id}, "${data.action}" ${data.type}.${data.key}`
        );
        handleThreadUpdate(data, true);
    } else if (isNDKStart(data)) {
        notifyHost("ndkStart", data);
    } else if (typeof data === "string") {
        // A task thread only posts `end,<reason>` when it dies: an uncaught error, or unwinding on a
        // termination command. Either way the app goes with it on a device (an uncaught error in a
        // Task thread terminates the app, and its own `exit` from the Micro Debugger ends it too), so
        // the reason is escalated to the host instead of being surfaced as plain output. The browser
        // API already behaves this way — there a task worker's string lands in the same
        // `handleStringMessage` as the app worker's, whose `end,` calls `terminate()`.
        if (data.startsWith("end,")) {
            notifyHost("appEnd", data.slice(4).trimEnd());
            return;
        }
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
