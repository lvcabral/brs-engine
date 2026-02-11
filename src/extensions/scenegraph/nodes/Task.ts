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
} from "brs-engine";
import { sgRoot } from "../SGRoot";
import { brsValueOf, fromAssociativeArray, fromSGNode, jsValueOf, updateSGNode } from "../factory/Serializer";
import { FieldKind, FieldModel, MethodCallPayload, isMethodCallPayload } from "../SGTypes";
import { Node } from "./Node";
import { Global } from "./Global";
import type { Field, Scene } from "..";
import { SGNodeType } from ".";

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
    /** Shared buffer used to communicate updates between host and task thread. */
    private taskBuffer?: SharedObject;

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
        update.value = value instanceof Node ? fromSGNode(value, true) : jsValueOf(value);
        this.sendThreadUpdate(update);
    }

    /**
     * Waits for an acknowledgement from the main thread for a specific field update.
     * @param update The thread update request containing the field key and request ID.
     * @param timeoutMs Time to wait in milliseconds (default 10000).
     * @returns True if acknowledgement was received, false on timeout.
     */
    private waitForFieldAck(update: ThreadUpdate, timeoutMs: number = 10000) {
        if (!this.taskBuffer || update.requestId === undefined) {
            return false;
        }
        const deadline = Date.now() + timeoutMs;
        while (true) {
            if (this.completedAcks.delete(update.requestId)) {
                return true;
            }
            const remaining = deadline - Date.now();
            if (remaining <= 0) {
                break;
            }
            const waitResult = this.taskBuffer.waitVersion(0, remaining);
            if (waitResult === "timed-out") {
                break;
            }
            this.processThreadUpdate();
        }
        BrsDevice.stderr.write(
            `warning,[task-sync] Task #${this.threadId} rendezvous ack timeout for task.${update.key} (req=${update.id})`
        );
        return false;
    }

    /**
     * Marks the task as active and registers it with sgRoot if not already done.
     */
    private activateTask() {
        this.active = true;
        if (this.inThread) return;
        // In main thread add this task to sgRoot. (in a task thread it's added by `loadTaskData()`)
        if (this.threadId < 0) {
            sgRoot.addTask(this);
        } else if (sgRoot.getThreadTask(this.threadId) !== this) {
            sgRoot.setThread(this.threadId, this.address, this);
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
        this.sendThreadUpdate(update);
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
    requestFieldValue(type: SyncType, address: string, fieldName: string, timeoutMs: number = 10000): boolean {
        if (!this.taskBuffer || this.threadId < 0) {
            return false;
        }
        const update: ThreadUpdate = {
            id: this.threadId,
            action: "get",
            type,
            address,
            key: fieldName,
            value: null,
        };
        this.sendThreadUpdate(update);
        const deadline = Date.now() + timeoutMs;

        while (true) {
            const update = this.processThreadUpdate();
            if (update?.action === "set" && update.type === type && update.key === fieldName) {
                return true;
            } else if (update?.action === "nil" && update.type === type && update.key === fieldName) {
                return false;
            }
            const remaining = deadline - Date.now();
            if (remaining <= 0) {
                break;
            }
            const waitResult = this.taskBuffer.waitVersion(0, remaining);
            if (waitResult === "timed-out") {
                break;
            }
        }
        BrsDevice.stderr.write(
            `warning,[task:${sgRoot.threadId}] Rendezvous timeout for field ${type}.${fieldName} on thread ${this.threadId}`
        );
        return false;
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
        timeoutMs: number = 10000
    ): BrsType | undefined {
        if (!this.taskBuffer || this.threadId < 0) {
            return undefined;
        }
        const value = payload ?? null;
        const update: ThreadUpdate = {
            id: this.threadId,
            action: "call",
            type,
            address,
            key: methodName,
            value,
        };
        this.sendThreadUpdate(update);
        const deadline = Date.now() + timeoutMs;

        while (true) {
            const update = this.processThreadUpdate();
            if (update?.action === "resp" && update.type === type && update.key === methodName) {
                return brsValueOf(update.value);
            } else if (update?.action === "nil" && update.type === type && update.key === methodName) {
                return undefined;
            }
            const remaining = deadline - Date.now();
            if (remaining <= 0) {
                break;
            }
            const waitResult = this.taskBuffer.waitVersion(0, remaining);
            if (waitResult === "timed-out") {
                break;
            }
        }
        BrsDevice.stderr.write(
            `warning,[task:${sgRoot.threadId}] Rendezvous timeout for method ${type}.${methodName}() on thread ${this.threadId}`
        );
        return undefined;
    }

    /**
     * MessagePort callback invoked when observers wait on task-owned fields.
     * @param _ Interpreter instance (unused).
     * @param wait Milliseconds to wait for a buffer version change.
     * @returns Array of generated events (empty for Task nodes).
     */
    protected getNewEvents(_: Interpreter, wait: number) {
        if (this.taskBuffer && this.inThread) {
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
            const taskData: TaskData = {
                id: this.threadId,
                name: this.nodeSubtype,
                state: TaskState.RUN,
                buffer: this.taskBuffer.getBuffer(),
                tmp: BrsDevice.getTmpVolume(),
                cacheFS: BrsDevice.getCacheFS(),
                m: fromAssociativeArray(this.m, true, this),
                scene: sgRoot.scene ? fromSGNode(sgRoot.scene, false, this) : undefined,
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
        if (this.inThread && update.action === "set") {
            update.requestId = requestAck ? this.syncRequestId++ : undefined;
        } else if (update.action !== "ack") {
            update.requestId = undefined;
        }
        postMessage(update);
        if (this.inThread && update.requestId !== undefined && update.action !== "ack") {
            this.waitForFieldAck(update);
        }
    }

    /**
     * Applies pending updates stored in the shared buffer that originated from another thread.
     * @returns The ThreadUpdate that was applied, if any.
     */
    processThreadUpdate(): ThreadUpdate | undefined {
        const currentVersion = this.taskBuffer?.getVersion() ?? -1;
        // Only process updates when the buffer version is exactly 1,
        // which indicates a new update is available from the other thread.
        // (Versioning protocol: 1 = update ready, 0 = idle/no update)
        if (!this.taskBuffer || currentVersion !== 1) {
            return undefined;
        }
        // Load update from buffer and reset version to 0 (idle)
        const update = this.taskBuffer.load(true);
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
            const node = this.getNodeToUpdate(update);
            if (!node) {
                const replied = this.handleUnresolvedNode(update);
                BrsDevice.stdout.write(
                    `debug,[task:${sgRoot.threadId}] Node sync type: ${update.type}, from ${update.id} ${
                        update.action
                    } '${update.key}' - target node not found! It was ${replied ? "replied" : "not replied"}`
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
        const serializedValue = result instanceof Node ? fromSGNode(result, true) : jsValueOf(result);
        update.action = "resp";
        update.value = serializedValue;
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
            const rootNodes = [this, sgRoot.scene, sgRoot.mGlobal];
            for (const rootNode of rootNodes) {
                const foundNode = this.findNodeByAddress(rootNode, address, searchFields);
                if (foundNode) {
                    return foundNode;
                }
            }
        }
        return undefined;
    }
}
