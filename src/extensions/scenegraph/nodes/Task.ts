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
    toAssociativeArray,
    isSyncAction,
} from "brs-engine";
import { sgRoot } from "../SGRoot";
import { brsValueOf, fromAssociativeArray, fromSGNode, updateSGNode } from "../factory/Serializer";
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
    thread: boolean;
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
        this.threadId = -1; // Not activated yet
        this.active = false;
        this.started = false;
        this.thread = false;

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);
    }

    /**
     * Overrides `Node.get` to add task update semantics when accessed from a task thread.
     * @param index Field name being retrieved.
     * @returns The BrightScript value of the requested field.
     */
    get(index: BrsType): BrsType {
        if (this.active && isBrsString(index)) {
            const fieldName = index.toString().toLowerCase();
            if (this.fields.has(fieldName)) {
                if (this.owner !== sgRoot.threadId && this.threadId >= 0) {
                    if (!this.consumeFreshField(fieldName)) {
                        this.requestFieldValue("task", this.address, fieldName);
                    }
                }
            }
        }
        return super.get(index);
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
        if (this.threadId >= 0 && field && sync && this.changed) {
            this.syncTaskField(field, mapKey);
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
            if (this.threadId >= 0 && this.thread && sync) {
                this.sendThreadUpdate(this.threadId, "set", "task", this.address, "control", new BrsString(control));
            }
        }
    }

    private syncTaskField(field: Field, fieldName: string) {
        if (this.threadId < 0) {
            return;
        }
        const currentValue = field.getValue(false);
        const deep = currentValue instanceof Node;
        const requestId = this.thread ? this.syncRequestId++ : undefined;
        this.sendThreadUpdate(this.threadId, "set", "task", this.address, fieldName, currentValue, deep, requestId);
        if (requestId !== undefined) {
            this.waitForFieldAck(fieldName, requestId);
        }
    }

    private handleFieldRequest(node: Node | Global | Scene, update: ThreadUpdate) {
        if (update.id < 0) {
            return;
        }
        const value = node.get(new BrsString(update.key));
        BrsDevice.stdout.write(
            `debug,[task-sync] Task #${sgRoot.threadId} responding to field request for ${update.type}.${update.key} from thread ${update.id}`
        );
        const deep = value instanceof Node;
        this.sendThreadUpdate(update.id, "set", update.type, node.getAddress(), update.key, value, deep);
    }

    private waitForFieldAck(fieldName: string, requestId: number, timeoutMs: number = 10000) {
        if (!this.taskBuffer) {
            return false;
        }
        const deadline = Date.now() + timeoutMs;
        while (true) {
            if (this.completedAcks.delete(requestId)) {
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
            `warning,[task-sync] Task #${this.threadId} rendezvous ack timeout for task.${fieldName} (req=${requestId})`
        );
        return false;
    }

    /**
     * Marks the task as active and registers it with sgRoot if not already done.
     */
    private activateTask() {
        this.active = true;
        if (this.thread) return;
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

    requestFieldValue(type: SyncType, address: string, fieldName: string, timeoutMs: number = 10000): boolean {
        if (!this.taskBuffer || this.threadId < 0) {
            return false;
        }
        this.sendThreadUpdate(this.threadId, "get", type, address, fieldName, BrsInvalid.Instance, false);
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
        const value = payload ? toAssociativeArray(payload) : BrsInvalid.Instance;
        this.sendThreadUpdate(this.threadId, "call", type, address, methodName, value, false);
        const deadline = Date.now() + timeoutMs;

        while (true) {
            const update = this.processThreadUpdate();
            if (update?.action === "resp" && update.type === type && update.key === methodName) {
                return brsValueOf(update.value);
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
        if (this.taskBuffer && this.thread) {
            const timeout = wait === 0 ? undefined : wait;
            this.taskBuffer.waitVersion(0, timeout);
            this.updateTask();
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
     * Processes shared-buffer updates and synchronizes dirty child nodes back to the main thread.
     * @returns True when updates were applied, otherwise false.
     */
    updateTask() {
        const updates = this.processThreadUpdate();
        const state = this.getValueJS("state") as string;
        if (!this.thread || state !== "run") {
            return updates !== undefined;
        }
        // Check for changed Node fields to notify updates to the Main thread
        for (const [name, field] of this.getNodeFields()) {
            const value = field.getValue();
            if (!field.isHidden() && value instanceof Node && value.changed) {
                this.sendThreadUpdate(this.threadId, "set", "task", this.address, name, value, true);
            }
        }
        return updates !== undefined;
    }

    /**
     * Applies pending updates stored in the shared buffer that originated from another thread.
     * @returns The ThreadUpdate that was applied, if any.
     */
    private processThreadUpdate(): ThreadUpdate | undefined {
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
                if (this.thread && update.requestId !== undefined) {
                    this.completedAcks.add(update.requestId);
                }
                return update;
            }
            if (update.action === "nil") {
                return update;
            }
            const node = this.getNodeToUpdate(update);
            if (!node) {
                const replied = this.handleUnresolvedNode(update);
                BrsDevice.stderr.write(
                    `warning,[task:${sgRoot.threadId}] Node sync type: ${update.type}, from ${update.id} ${
                        update.action
                    } '${update.key}' - target node not found! It was ${replied ? "replied" : "not replied"}`
                );
                return undefined;
            }
            if (update.action === "get") {
                this.handleFieldRequest(node, update);
                return undefined;
            }
            if (update.action === "call") {
                this.handleMethodCallRequest(node, update);
                return undefined;
            }
            if (update.action === "resp") {
                // Method call response - simply return it for processing
                return update;
            }
            // Apply Field update
            const oldValue = node.getValue(update.key);
            let value: BrsType;
            if (!this.thread && oldValue instanceof Node && oldValue.getAddress() === update.value._address_) {
                // Update existing node to preserve references
                value = updateSGNode(update.value, oldValue);
            } else {
                value = brsValueOf(update.value);
            }
            node.markFieldFresh(update.key);
            node.setValue(update.key, value, false, undefined, false);
            // Send acknowledgement back to the other thread if needed
            if (!this.thread && update.requestId !== undefined) {
                this.sendThreadUpdate(
                    update.id,
                    "ack",
                    update.type,
                    update.address,
                    update.key,
                    BrsInvalid.Instance,
                    false,
                    update.requestId
                );
            }
            return update;
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
        const hostNode = this.resolveNode(payload.host);
        if (!hostNode) {
            BrsDevice.stderr.write(
                `warning,[task:${sgRoot.threadId}] Unable to resolve host node '${payload.host}' for method call request: ${update.type}.${update.key}`
            );
            return;
        }
        const method = target.getMethod(update.key);
        if (!method || !sgRoot.interpreter) {
            return;
        }
        const value = brsValueOf(payload.args);
        const args: BrsType[] = value instanceof RoArray ? value.getElements() : [];
        const location = payload.location ?? sgRoot.interpreter.location;
        const result = sgRoot.interpreter.call(method, args, hostNode.m, location, hostNode);
        this.sendThreadUpdate(update.id, "resp", update.type, update.address, update.key, result, false);
    }

    handleUnresolvedNode(update: ThreadUpdate) {
        let responseAction = "";
        if (update.action === "set" && update.requestId !== undefined) {
            responseAction = "ack";
        } else if (update.action === "call") {
            responseAction = "resp";
        } else if (update.action === "get") {
            responseAction = "nil";
        }
        if (isSyncAction(responseAction)) {
            this.sendThreadUpdate(
                update.id,
                responseAction,
                update.type,
                update.address,
                update.key,
                BrsInvalid.Instance,
                false,
                update.requestId
            );
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
                BrsDevice.stdout.write(
                    `debug,[task:${sgRoot.threadId}] Resolving node by address: ${address} from ${
                        rootNode?.nodeSubtype
                    }:${rootNode?.getAddress()}`
                );
                const foundNode = this.findNodeByAddress(rootNode, address, searchFields);
                if (foundNode) {
                    return foundNode;
                }
            }
        }
        return undefined;
    }
}
