import {
    AAMember,
    Interpreter,
    BrsDevice,
    BrsEvent,
    BrsInvalid,
    BrsString,
    BrsType,
    isBrsString,
    SharedObject,
    isThreadUpdate,
    TaskData,
    TaskState,
    ThreadUpdate,
    SyncType,
    RoArray,
    isSyncAction,
    RuntimeError,
    RuntimeErrorDetail,
} from "brs-engine";
import { sgRoot } from "../SGRoot";
import { brsValueOf, fromAssociativeArray, fromSGNode, jsValueOf, updateSGNode } from "../factory/Serializer";
import { FieldKind, FieldModel, MethodCallPayload, isMethodCallPayload } from "../SGTypes";
import { Node } from "./Node";
import { ContentNode } from "./ContentNode";
import { Global } from "./Global";
import { SGNodeType } from ".";
import type { Field, Scene } from "..";

/**
 * Maximum time (ms) a blocking rendezvous wait sleeps before re-checking cooperative conditions.
 * `Atomics.wait` on the response buffer can't simultaneously watch the debug-halt slot, so a wait
 * that would otherwise sleep for the full rendezvous timeout is capped to this interval; each wake
 * re-checks `BrsDevice.pauseIfDebugging()` so the thread freezes promptly when the Micro Debugger
 * activates on another thread instead of running out the clock and throwing a spurious timeout.
 */
const RENDEZVOUS_POLL_MS = 100;

/**
 * SceneGraph `Task` node implementation responsible for executing BrightScript in a worker thread.
 * Manages control/state fields, SharedArrayBuffer message passing, and thread synchronization.
 */
export class Task extends Node {
    /** Built-in Task fields defined by Roku (control/state/functionName). */
    readonly defaultFields: FieldModel[] = [
        { name: "control", type: "string" },
        { name: "state", type: "string", value: "init" },
        { name: "functionName", type: "string" },
    ];
    /** Shared buffer used to communicate updates between host and task thread (via the broker). */
    private taskBuffer?: SharedObject;
    /**
     * Dedicated buffer carrying rendezvous responses directly between the render thread (writer) and
     * this Task thread (reader), bypassing the main-thread broker. Allocated on the render-thread
     * instance when the task activates.
     */
    private directBuffer?: SharedObject;
    /**
     * Render-side write handle for the dedicated fan-out buffer (render → this task) used to deliver
     * observed-field updates directly. Present only on the render-thread instance.
     */
    private fanoutBuffer?: SharedObject;
    /**
     * Render-side queue of pending fan-out updates for this task, flushed synchronously into
     * `fanoutBuffer` during `processTasks` (the render thread can't rely on async writes — it
     * busy-waits for FPS and doesn't yield its event loop mid-frame).
     */
    private readonly fanoutQueue: ThreadUpdate[] = [];

    /** Thread identifier assigned by sgRoot once scheduled. */
    threadId: number;
    /** Indicates the task is currently marked as active (control = run). */
    active: boolean;
    /** Whether the task has started execution at least once. */
    started: boolean;
    /** True when this instance runs on a dedicated worker thread. */
    inThread: boolean;
    /** Incrementing identifier for rendezvous acknowledgements. */
    private syncRequestId: number = 1;
    /** Tracks acknowledgements completed by the main thread. */
    private readonly completedAcks: Set<number> = new Set();

    /**
     * Creates a Task node, registering default and initial fields.
     * @param members AA members originating from XML component instantiation.
     * @param name Specific component type name (defaults to `Task`).
     */
    constructor(members: AAMember[] = [], readonly name: string = SGNodeType.Task) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Node);
        this.syncType = "task";
        this.threadId = -1; // Not activated yet
        this.active = false;
        this.started = false;
        this.inThread = false;

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);
    }

    /**
     * Overrides `Node.setValue` to add control/state synchronization semantics.
     * @param index Field name being updated.
     * @param value New BrightScript value.
     * @param alwaysNotify Whether observers should always be notified.
     * @param kind Optional explicit field kind.
     * @param sync When false skips sending thread updates back to the main thread.
     */
    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind, sync: boolean = true) {
        const validStates = new Set(["init", "run", "stop", "done"]);
        const mapKey = index.toLowerCase();
        const field = this.fields.get(mapKey);

        if (field && mapKey === "control" && isBrsString(value)) {
            let control = value.getValue().toLowerCase();
            if (!validStates.has(control)) {
                control = "";
            }
            this.setControlField(field, control, sync);
            return;
        } else if (field && mapKey === "state" && isBrsString(value)) {
            // Roku documentation states this is read-only but it allows change the value to valid states
            // But it does not trigger any action
            if (validStates.has(value.getValue().toLowerCase())) {
                field.setValue(value);
            }
            return;
        }
        super.setValue(index, value, alwaysNotify, kind);
        // Notify other threads of field changes
        if (field && sync && this.changed) {
            this.syncRemoteField(mapKey, field.getValue(false));
            this.changed = false;
        }
    }

    /**
     * Handles control field updates, toggling thread state and mirroring Roku behavior.
     * @param field Control field instance to mutate.
     * @param control Lowercase control command (`run`, `stop`, etc.).
     * @param sync When true sends updates to the owning thread.
     */
    private setControlField(field: Field, control: string, sync: boolean) {
        if (control === "run") {
            this.activateTask();
        } else if (control === "stop" || control === "done") {
            this.deactivateTask();
        }
        field.setValue(new BrsString(control));
        if (control !== "" && control !== "init") {
            const state = this.fields.get("state")!;
            state.setValue(new BrsString(control));
            this.fields.set("state", state);
            // Notify other threads of field changes
            if (this.threadId >= 0 && this.inThread && sync) {
                const update: ThreadUpdate = {
                    id: this.threadId,
                    action: "set",
                    type: this.syncType,
                    address: this.address,
                    key: "control",
                    value: control,
                };
                this.sendThreadUpdate(update);
            }
        }
    }

    /**
     * Handles a request from a worker thread to retrieve a field value from the main thread.
     * @param node The node (or Global/Scene) being queried.
     * @param update The thread update request containing the field key.
     */
    private handleGetFieldRequest(node: Node | Global | Scene, update: ThreadUpdate) {
        if (update.id < 0) {
            return;
        }
        const value = node.get(new BrsString(update.key));
        BrsDevice.stdout.write(
            `debug,[task-sync] Task #${sgRoot.threadId} responding to field request for ${update.type}.${update.key} from thread ${update.id}`
        );
        update.action = "set";
        update.address = node.getAddress();
        if (value instanceof Node) {
            // Serialize the node SHALLOW (identity + own fields, no children). The requester reads a
            // node it does not own, so every child/method access rendezvouses back here anyway — the
            // children are never read from the requester's local copy. Deep-serializing them made each
            // `m.top.content` read cost O(programs) and, repeated across a Task's content build, drove
            // an allocation storm that OOMs V8 on large content (e.g. a TimeGrid EPG with 1000s of items).
            update.value = fromSGNode(value, false);
        } else {
            update.value = jsValueOf(value);
        }
        this.sendThreadUpdate(update);
    }

    /**
     * Waits for an acknowledgement from the main thread for a specific field update.
     * @param update The thread update request containing the field key and request ID.
     * @param timeoutMs Time to wait in milliseconds (default 10000).
     * @returns True if acknowledgement was received, false on timeout.
     */
    private waitForFieldAck(update: ThreadUpdate, timeoutMs: number = sgRoot.rendezvousTimeout) {
        // Responses (including acks) arrive on the dedicated direct buffer; taskBuffer is the fallback.
        const responseBuffer = this.directBuffer ?? this.taskBuffer;
        if (!responseBuffer || update.requestId === undefined) {
            return false;
        }
        let deadline = Date.now() + timeoutMs;
        while (true) {
            if (this.completedAcks.delete(update.requestId)) {
                return true;
            }
            if (BrsDevice.pauseIfDebugging()) {
                // Frozen for a debug session on another thread; debug time must not count toward
                // the rendezvous timeout, and the request has already been sent (do not re-send).
                deadline = Date.now() + timeoutMs;
                continue;
            }
            const remaining = deadline - Date.now();
            if (remaining <= 0) {
                break;
            }
            // Cap the sleep so the loop re-checks pauseIfDebugging even if the debugger activates
            // after we entered the wait; the real timeout is enforced by the `remaining` check above.
            responseBuffer.waitVersion(0, Math.min(remaining, RENDEZVOUS_POLL_MS));
            this.processThreadUpdate(responseBuffer);
        }
        throw this.rendezvousTimeoutError("set", update.type, update.key);
    }

    /**
     * Builds the runtime error raised when a rendezvous is not served within the configured timeout.
     * On a real device this corresponds to a blocked render thread, which terminates the app; here it
     * surfaces as an `ExecutionTimeout` runtime error instead of silently returning `invalid`.
     * @param action Rendezvous action that timed out (`get`, `set`, or `call`).
     * @param type Sync type domain of the target node.
     * @param key Field or method name involved in the rendezvous.
     * @returns A RuntimeError carrying the ExecutionTimeout errno and a descriptive message.
     */
    private rendezvousTimeoutError(action: string, type: SyncType, key: string): RuntimeError {
        const message = `Rendezvous timeout: render thread blocked while serving ${action} ${type}.${key} (thread ${this.threadId})`;
        BrsDevice.stderr.write(`error,[task:${sgRoot.threadId}] ${message}`);
        return new RuntimeError(
            { errno: RuntimeErrorDetail.ExecutionTimeout.errno, message },
            sgRoot.interpreter?.location
        );
    }

    /**
     * Marks the task as active and registers it with sgRoot if not already done.
     */
    private activateTask() {
        this.active = true;
        if (this.inThread) return;
        // Create the direct render→task buffers up front — before any field can be synced — so every
        // render-side fan-out takes the direct path. Done lazily in checkTaskRun they would miss the
        // window between activation and the first processTasks pass, where a field set (e.g. a Task's
        // `request`) would fall back to the broker, which in direct mode has no read buffer for the
        // task and silently drops the update.
        this.ensureDirectBuffers();
        // In main thread add this task to sgRoot. (in a task thread it's added by `loadTaskData()`)
        if (this.threadId < 0) {
            sgRoot.addTask(this);
        } else if (sgRoot.getThreadTask(this.threadId) !== this) {
            sgRoot.setThread(this.threadId, this.address, this);
        }
    }

    /**
     * Allocates the dedicated render→task rendezvous buffers (direct response + observed-field
     * fan-out) so the render thread delivers them straight to the Task thread without a main-thread
     * relay hop. Idempotent and render-thread only.
     */
    private ensureDirectBuffers() {
        if (this.inThread || this.fanoutBuffer) {
            return;
        }
        this.directBuffer = new SharedObject();
        this.fanoutBuffer = new SharedObject();
        if (sgRoot.logRendezvous) {
            BrsDevice.stdout.write(
                `debug,[rendezvous] thread ${sgRoot.threadId} allocated direct buffers for task ${this.nodeSubtype} (thread ${this.threadId})`
            );
        }
    }

    /**
     * Marks the task as inactive and notifies the main thread to stop execution.
     */
    private deactivateTask() {
        if (this.started) {
            const taskData: TaskData = {
                id: this.threadId,
                name: this.nodeSubtype,
                state: TaskState.STOP,
            };
            postMessage(taskData);
            this.started = false;
        }
        this.active = false;
    }

    /**
     * Sends a fire-and-forget roRenderThreadQueue message to the render thread (non-blocking, unlike
     * a rendezvous). Used by `RoRenderThreadQueue.PostMessage`/`CopyMessage` from a Task thread. The
     * render thread routes it to its queue singleton by message id, so no node address is needed;
     * the (otherwise unused) `address` field carries the posting function name for `msgInfo.function`.
     * @param messageId Channel id the message was posted to.
     * @param value Serialized message payload.
     * @param fn Name of the BrightScript function that posted the message.
     */
    postRenderQueueMessage(messageId: string, value: any, fn: string = "") {
        if (this.threadId < 0 || !this.active) {
            return;
        }
        const update: ThreadUpdate = {
            id: this.threadId,
            action: "post",
            type: "node",
            address: fn,
            key: messageId,
            value,
        };
        this.sendThreadUpdate(update);
    }

    /**
     * Sends a stop command to the worker thread to terminate execution.
     */
    stopTask() {
        const update: ThreadUpdate = {
            id: this.threadId,
            action: "set",
            type: "task",
            address: this.address,
            key: "control",
            value: "stop",
        };
        postMessage(update);
    }

    /**
     * Initializes the shared buffer wrapper from a raw SharedArrayBuffer.
     * @param data Buffer supplied by the scheduler for inter-thread messaging.
     */
    setTaskBuffer(data: SharedArrayBuffer) {
        this.taskBuffer = new SharedObject();
        this.taskBuffer.setBuffer(data);
        this.active = true;
    }

    /**
     * Initializes the dedicated direct-response buffer on the Task thread (Phase 3a).
     * @param data Buffer the render thread writes rendezvous responses into.
     */
    setDirectBuffer(data: SharedArrayBuffer) {
        this.directBuffer = new SharedObject();
        this.directBuffer.setBuffer(data);
    }

    /**
     * Synchronizes a field change back to the owning thread when applicable.
     * @param key Field name to synchronize.
     * @param fieldValue The new value of the field being synchronized.
     * @param type The sync type domain (e.g. "task") for the update message.
     * @param address The address of the node for the update message (defaults to this node's address).
     */
    syncRemoteField(key: string, fieldValue: BrsType, type: SyncType = this.syncType, address: string = this.address) {
        if (this.threadId < 0 || !this.active) {
            return;
        }
        const value = fieldValue instanceof Node ? fromSGNode(fieldValue, true) : jsValueOf(fieldValue);
        if (fieldValue instanceof Node) {
            // Re-own to the render thread only when the node actually crosses task → render (a task
            // setting a field). On the render side this is a fan-out (render → task): the node stays
            // render-authoritative and the task receives a serialized copy, so mutating its ownership
            // here would corrupt the live node tree (setOwner recurses into children).
            if (this.inThread) {
                fieldValue.setOwner(0); // Once the Node is sent to the Render thread, it's forever owned by it
            }
            fieldValue.changed = false;
        }
        const update: ThreadUpdate = {
            id: this.threadId,
            action: "set",
            type,
            address,
            key,
            value,
        };
        // Phase 3b: on the render thread, queue fan-out for direct delivery (drained in processTasks)
        // instead of relaying it through the main-thread broker.
        if (this.fanoutBuffer && !this.inThread) {
            this.fanoutQueue.push(update);
            if (sgRoot.logRendezvous) {
                BrsDevice.stdout.write(
                    `debug,[rendezvous] thread ${sgRoot.threadId} queued fan-out ${type}.${key} -> task thread ${this.threadId} (queue ${this.fanoutQueue.length})`
                );
            }
            return;
        }
        if (sgRoot.logRendezvous) {
            BrsDevice.stdout.write(
                `debug,[rendezvous] thread ${sgRoot.threadId} broker fan-out ${type}.${key} -> task thread ${
                    this.threadId
                } (inThread=${this.inThread} fanoutBuffer=${!!this.fanoutBuffer})`
            );
        }
        this.sendThreadUpdate(update);
    }

    /**
     * Flushes queued fan-out updates into the dedicated buffer (render thread only). Writes are
     * synchronous and non-blocking: one update is stored whenever the single slot is free, leaving
     * the rest queued for the next render pass so a slow task can never stall the render thread.
     */
    flushFanout() {
        if (!this.fanoutBuffer) {
            return;
        }
        while (this.fanoutQueue.length > 0 && this.fanoutBuffer.getVersion() === 0) {
            const update = this.fanoutQueue.shift();
            try {
                this.fanoutBuffer.store(update);
                if (sgRoot.logRendezvous) {
                    BrsDevice.stdout.write(
                        `debug,[rendezvous] thread ${sgRoot.threadId} flushed fan-out ${update?.type}.${update?.key} -> task thread ${this.threadId} (queue ${this.fanoutQueue.length})`
                    );
                }
            } catch (err: any) {
                // A non-serializable payload (e.g. a value with a cycle) must never propagate out of
                // here: on the render thread this runs inside the render loop, so a throw would stall
                // every rendezvous. Drop just this update and keep draining the rest.
                BrsDevice.stderr.write(
                    `error,[task:${sgRoot.threadId}] Dropped fan-out ${update?.type}.${update?.key} to thread ${
                        this.threadId
                    }: ${err?.message ?? err}`
                );
            }
        }
    }

    /**
     * Requests a field value from the task thread using the rendezvous mechanism.
     * Blocks until the value is received or timeout occurs.
     * @param type The sync type domain (e.g. "task").
     * @param address The address of the node.
     * @param fieldName The field to retrieve.
     * @param timeoutMs Timeout in milliseconds.
     * @returns True if the value was successfully retrieved.
     */
    requestFieldValue(
        type: SyncType,
        address: string,
        fieldName: string,
        timeoutMs: number = sgRoot.rendezvousTimeout
    ): boolean {
        if (!this.taskBuffer || this.threadId < 0) {
            return false;
        }
        const requestId = this.syncRequestId++;
        const request: ThreadUpdate = {
            id: this.threadId,
            action: "get",
            type,
            address,
            key: fieldName,
            value: null,
            requestId,
        };
        const started = sgRoot.logRendezvous ? Date.now() : 0;
        this.sendThreadUpdate(request);
        let deadline = Date.now() + timeoutMs;
        const responseBuffer = this.directBuffer ?? this.taskBuffer;

        while (true) {
            const update = this.processThreadUpdate(responseBuffer);
            if (update?.requestId === requestId) {
                if (update.action === "set") {
                    this.logRendezvousTiming("get", type, fieldName, started);
                    return true;
                } else if (update.action === "nil") {
                    this.logRendezvousTiming("get", type, fieldName, started);
                    return false;
                }
            }
            if (BrsDevice.pauseIfDebugging()) {
                // Frozen for a debug session on another thread; debug time must not count toward
                // the rendezvous timeout, and the request has already been sent (do not re-send).
                deadline = Date.now() + timeoutMs;
                continue;
            }
            const remaining = deadline - Date.now();
            if (remaining <= 0) {
                break;
            }
            // Cap the sleep so the loop re-checks pauseIfDebugging even if the debugger activates
            // after we entered the wait; the real timeout is enforced by the `remaining` check above.
            responseBuffer.waitVersion(0, Math.min(remaining, RENDEZVOUS_POLL_MS));
        }
        throw this.rendezvousTimeoutError("get", type, fieldName);
    }

    /**
     * Requests a method call on the task thread (or from task to main) using rendezvous.
     * Blocks until the return value is received or timeout occurs.
     * @param type The sync type domain.
     * @param address The address of the target node.
     * @param methodName The method name to call.
     * @param payload Optional arguments and context for the call.
     * @param timeoutMs Timeout in milliseconds.
     * @returns The method return value or undefined on error/timeout.
     */
    requestMethodCall(
        type: SyncType,
        address: string,
        methodName: string,
        payload?: MethodCallPayload,
        timeoutMs: number = sgRoot.rendezvousTimeout
    ): BrsType | undefined {
        if (!this.taskBuffer || this.threadId < 0) {
            return undefined;
        }
        const value = payload ?? null;
        const requestId = this.syncRequestId++;
        const request: ThreadUpdate = {
            id: this.threadId,
            action: "call",
            type,
            address,
            key: methodName,
            value,
            requestId,
        };
        const started = sgRoot.logRendezvous ? Date.now() : 0;
        this.sendThreadUpdate(request);
        let deadline = Date.now() + timeoutMs;
        const responseBuffer = this.directBuffer ?? this.taskBuffer;

        while (true) {
            const update = this.processThreadUpdate(responseBuffer);
            if (update?.requestId === requestId) {
                if (update.action === "resp") {
                    this.logRendezvousTiming("call", type, methodName, started);
                    return brsValueOf(update.value);
                } else if (update.action === "nil") {
                    this.logRendezvousTiming("call", type, methodName, started);
                    return undefined;
                }
            }
            if (BrsDevice.pauseIfDebugging()) {
                // Frozen for a debug session on another thread; debug time must not count toward
                // the rendezvous timeout, and the request has already been sent (do not re-send).
                deadline = Date.now() + timeoutMs;
                continue;
            }
            const remaining = deadline - Date.now();
            if (remaining <= 0) {
                break;
            }
            // Cap the sleep so the loop re-checks pauseIfDebugging even if the debugger activates
            // after we entered the wait; the real timeout is enforced by the `remaining` check above.
            responseBuffer.waitVersion(0, Math.min(remaining, RENDEZVOUS_POLL_MS));
        }
        throw this.rendezvousTimeoutError("call", type, methodName);
    }

    /**
     * MessagePort callback invoked when observers wait on task-owned fields.
     * @param _ Interpreter instance (unused).
     * @param wait Milliseconds to wait for a buffer version change.
     * @returns Array of generated events (empty for Task nodes).
     */
    protected getNewEvents(_: Interpreter, wait: number) {
        if (this.taskBuffer && this.inThread) {
            // Freeze the task's idle wait while another thread owns the debug session.
            if (BrsDevice.pauseIfDebugging()) {
                return new Array<BrsEvent>();
            }
            const timeout = wait === 0 ? undefined : wait;
            this.taskBuffer.waitVersion(0, timeout);
            this.processThreadUpdate();
        }
        return new Array<BrsEvent>();
    }

    /**
     * Validates readiness and posts task metadata to the scheduler when control becomes `run`.
     */
    checkTaskRun() {
        const functionName = this.getValueJS("functionName") as string;
        if (!functionName || functionName.trim() === "") {
            this.setValue("control", new BrsString("stop"));
            return;
        }
        if (!this.started) {
            this.taskBuffer = new SharedObject();
            // Direct render→task buffers (responses + fan-out) are normally allocated at activation;
            // ensure they exist here too in case the task was started without going through activate.
            this.ensureDirectBuffers();
            const taskData: TaskData = {
                id: this.threadId,
                name: this.nodeSubtype,
                state: TaskState.RUN,
                buffer: this.taskBuffer.getBuffer(),
                directToTask: this.directBuffer?.getBuffer(),
                fanout: this.fanoutBuffer?.getBuffer(),
                tmp: BrsDevice.getTmpVolume(),
                cacheFS: BrsDevice.getCacheFS(),
                m: fromAssociativeArray(this.m, true, this),
                render: sgRoot.getRenderThreadInfo()?.id,
            };
            postMessage(taskData);
            this.started = true;
        }
    }

    /**
     * Posts a serialized node update to the owning thread.
     * @param update ThreadUpdate containing the details of the field change and optional rendezvous requestId for acknowledgements.
     * @param requestAck When true (default) the method will wait for an acknowledgement from the main thread confirming the update was processed, otherwise it will fire-and-forget without waiting. This should be false for updates originating from the main thread to avoid deadlocks, and can be true for updates originating from the task thread when the caller needs to ensure the main thread has processed the change before proceeding.
     */
    sendThreadUpdate(update: ThreadUpdate, requestAck: boolean = true) {
        const isRequest = update.action === "set" || update.action === "get" || update.action === "call";
        // Tag outbound requests originating from a task thread with a unique id so the matching
        // response/ack can be correlated unambiguously. Responses (resp/ack/nil) and render-thread
        // requests preserve the requestId already present on the update.
        if (this.inThread && isRequest && requestAck && update.requestId === undefined) {
            update.requestId = this.syncRequestId++;
        }
        // Phase 3a: the render thread delivers a rendezvous *response* (it carries a requestId)
        // directly to the requesting task's buffer, bypassing the broker. Fan-out sets (no requestId)
        // and all task-originated traffic still go through the broker via postMessage.
        if (!this.inThread && this.directBuffer && update.requestId !== undefined) {
            this.directBuffer.store(update);
            return;
        }
        postMessage(update);
        if (this.inThread && update.action === "set" && update.requestId !== undefined) {
            const started = sgRoot.logRendezvous ? Date.now() : 0;
            this.waitForFieldAck(update);
            this.logRendezvousTiming("set", update.type, update.key, started);
        }
    }

    /**
     * Logs the duration of a completed rendezvous when `sgRoot.logRendezvous` is enabled, mirroring
     * the Roku SceneGraph debug console `logrendezvous` command to help identify performance issues.
     * @param action Rendezvous action performed (`get`, `set`, or `call`).
     * @param type Sync type domain of the target (`global`, `task`, `scene`, or `node`).
     * @param key Field or method name involved in the rendezvous.
     * @param startedMs Timestamp (ms) captured before the rendezvous started.
     */
    private logRendezvousTiming(action: string, type: SyncType, key: string, startedMs: number) {
        if (sgRoot.logRendezvous) {
            const ms = Date.now() - startedMs;
            BrsDevice.stdout.write(
                `debug,[rendezvous] thread ${sgRoot.threadId} ${action} ${type}.${key} on thread ${this.threadId} took ${ms}ms`
            );
        }
    }

    /**
     * Applies pending updates stored in the shared buffer that originated from another thread.
     * @returns The ThreadUpdate that was applied, if any.
     */
    processThreadUpdate(buffer: SharedObject | undefined = this.taskBuffer): ThreadUpdate | undefined {
        const currentVersion = buffer?.getVersion() ?? -1;
        // Only process updates when the buffer version is exactly 1,
        // which indicates a new update is available from the other thread.
        // (Versioning protocol: 1 = update ready, 0 = idle/no update)
        if (!buffer || currentVersion !== 1) {
            return undefined;
        }
        // Load update from buffer and reset version to 0 (idle)
        const update = buffer.load(true);
        if (isThreadUpdate(update)) {
            if (update.action === "ack") {
                if (this.inThread && update.requestId !== undefined) {
                    this.completedAcks.add(update.requestId);
                }
                return update;
            }
            if (update.action === "resp") {
                return update;
            }
            if (update.action === "nil") {
                return update;
            }
            if (update.action === "post") {
                // Fire-and-forget roRenderThreadQueue message: enqueue for the render-loop drain.
                // `address` carries the posting function name (see postRenderQueueMessage).
                sgRoot.enqueueRenderQueueMessage(update.key, update.value, update.address);
                return update;
            }
            const node = this.getNodeToUpdate(update);
            if (!node) {
                const replied = this.handleUnresolvedNode(update);
                BrsDevice.stdout.write(
                    `debug,[task:${sgRoot.threadId}] Node sync type: ${update.type}, from ${update.id} ${
                        update.action
                    } '${update.key}' address ${update.address ?? "n/a"} - target node not found! It was ${
                        replied ? "replied" : "not replied"
                    }`
                );
                return undefined;
            }
            if (update.action === "get") {
                this.handleGetFieldRequest(node, update);
                return undefined;
            }
            if (update.action === "call") {
                this.handleMethodCallRequest(node, update);
                return undefined;
            }
            if (update.action === "set") {
                this.handleSetFieldRequest(node, update);
                return update;
            }
        }
        return undefined;
    }

    /**
     * Resolves the node target for an incoming thread update message.
     * @param type Domain identifier (`global`, `task`, or `scene`).
     * @returns Target node, if available.
     */
    private getNodeToUpdate(update: ThreadUpdate): Node | undefined {
        if (update.type === "global") {
            return sgRoot.mGlobal;
        } else if (update.type === "scene") {
            return sgRoot.scene;
        } else if (update.type === "task") {
            return this;
        } else if (update.address) {
            return this.resolveNode(update.address, true);
        }
        return undefined;
    }

    /**
     * Handles field update requests received via thread updates,
     * applying changes to the target node and sending acknowledgements if needed.
     * @param node Target node on which the field update should be applied.
     * @param update Thread update containing field change details and optional rendezvous requestId for acknowledgements.
     * @returns The processed ThreadUpdate for potential further handling, or undefined if the update was fully handled here.
     */
    private handleSetFieldRequest(node: Node, update: ThreadUpdate) {
        const oldValue = node.getValue(update.key);
        let value: BrsType;
        if (!this.inThread && oldValue instanceof Node && oldValue.getAddress() === update.value._address_) {
            // Update existing node to preserve references
            value = updateSGNode(update.value, oldValue);
        } else {
            value = brsValueOf(update.value);
        }
        node.markFieldFresh(update.key);
        node.setValue(update.key, value, false, undefined, false);
        if (sgRoot.logRendezvous) {
            BrsDevice.stdout.write(
                `debug,[rendezvous] thread ${sgRoot.threadId} applied set ${update.type}.${update.key} from thread ${update.id}`
            );
        }
        // The render fans a task's applied set out to the other observing tasks itself (targeted to
        // observers, excluding the originator) rather than relying on the broker to blind-relay. Only
        // shared domains (global/scene/node) cross between tasks — `task`-type fields are private to a
        // single task, mirroring the broker's `type !== "task"` guard; fanning them out would deliver
        // one task's field into another task's identically-named field (and corrupt node ownership).
        if (this.fanoutBuffer && !this.inThread && update.type !== "task") {
            node.fanOutFieldToObservingTasks(update.key, update.id);
        }
        // Send acknowledgement back to the other thread if needed
        if (!this.inThread && update.requestId !== undefined) {
            update.action = "ack";
            update.value = null;
            this.sendThreadUpdate(update);
        }
        return update;
    }

    /**
     * Handles method call requests received via thread updates.
     * @param target Target node on which the method is called.
     * @param update Thread update containing method call details.
     */
    private handleMethodCallRequest(target: Node, update: ThreadUpdate) {
        const payload = update.value;
        if (!isMethodCallPayload(payload)) {
            BrsDevice.stderr.write(
                `warning,[task:${sgRoot.threadId}] Invalid method call payload from Task thread: ${update.type}.${update.key}`
            );
            return;
        }
        const hostNode = this.resolveNode(payload.host) ?? target;
        const method = target.getMethod(update.key);
        if (!method || !sgRoot.interpreter) {
            return;
        }
        const value = brsValueOf(payload.args);
        const args: BrsType[] = value instanceof RoArray ? value.getElements() : [];
        const location = payload.location ?? sgRoot.interpreter.location;
        const result = sgRoot.interpreter.call(method, args, hostNode.m, location, hostNode);
        update.action = "resp";
        if (result instanceof Node) {
            const deep = result instanceof ContentNode;
            update.value = fromSGNode(result, deep);
        } else {
            update.value = jsValueOf(result);
        }
        this.sendThreadUpdate(update);
    }

    /**
     * Handles cases where the target node for an update cannot be found.
     * Sends appropriate error/nil responses back to the caller.
     * @param update The failed update request.
     * @returns True if a response was sent back.
     */
    handleUnresolvedNode(update: ThreadUpdate) {
        let responseAction = "";
        if (update.action === "set" && update.requestId !== undefined) {
            responseAction = "ack";
        } else if (update.action === "call" || update.action === "get") {
            responseAction = "nil";
        }
        if (isSyncAction(responseAction)) {
            update.action = responseAction;
            update.value = BrsInvalid.Instance;
            this.sendThreadUpdate(update);
            return true;
        }
        return false;
    }

    /**
     * Resolves the node based on the given address.
     * @param address The address of the node to resolve.
     * @returns The resolved node, or undefined if not found.
     */
    private resolveNode(address: string, searchFields: boolean = false): Node | undefined {
        if (address) {
            // Live reachability wins. The cross-thread registry can hold a *stale duplicate* instance
            // for an address: `toSGNode` copies `_address_` when it rebuilds a node on the receiving
            // thread, so repeated serializations of the same logical node mint new instances that share
            // its address, and `registerCrossThreadNode` keeps only the latest. Resolving the registry
            // first therefore risks targeting a detached duplicate instead of the node actually wired
            // into the scene (field writes/observers landing on the wrong copy). Walk the trees first so
            // a node still reachable from task/scene/global always resolves to its authoritative copy.
            const rootNodes = [this, sgRoot.scene, sgRoot.mGlobal];
            for (const rootNode of rootNodes) {
                const foundNode = this.findNodeByAddress(rootNode, address, searchFields);
                if (foundNode) {
                    return foundNode;
                }
            }
            // Fallback: a node held only by the other thread (a true orphan — e.g. a per-request
            // callback node a task keeps a reference to) is unreachable from the trees above; resolve it
            // by address so late write-backs still reach it, mirroring Roku's process-wide references.
            const crossThreadNode = sgRoot.getCrossThreadNode(address);
            if (crossThreadNode) {
                return crossThreadNode;
            }
        }
        return undefined;
    }
}
