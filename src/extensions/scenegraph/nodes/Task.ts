import {
    AAMember,
    Interpreter,
    BrsDevice,
    BrsEvent,
    BrsInvalid,
    BrsString,
    BrsType,
    RoArray,
    isBrsString,
    SharedObject,
    isThreadUpdate,
    TaskData,
    TaskState,
    ThreadUpdate,
} from "brs-engine";
import { sgRoot } from "../SGRoot";
import { brsValueOf, fromAssociativeArray, fromSGNode, updateSGNode } from "../factory/Serializer";
import { FieldKind, FieldModel, isObserverScope, ObserverScope, ObserverRequestPayload } from "../SGTypes";
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

    private handleObserverRequest(target: Node | Global | Scene | undefined, update: ThreadUpdate) {
        if (!target) {
            return;
        }
        const payload = update.value as ObserverRequestPayload;
        if (!payload || typeof payload.functionName !== "string") {
            return;
        }
        const interpreter = sgRoot.interpreter;
        if (!interpreter) {
            return;
        }
        const scope: ObserverScope = isObserverScope(payload.scope) ? payload.scope : "unscoped";
        const infoValue = payload.infoFields === undefined ? undefined : brsValueOf(payload.infoFields);
        const infoFields = infoValue instanceof RoArray ? infoValue : undefined;
        const functionName = payload.functionName;
        const hostNode = this.resolveHostNode(update.id, payload.host) ?? target;
        interpreter.inSubEnv((subInterpreter) => {
            subInterpreter.environment.hostNode = hostNode;
            subInterpreter.environment.setM(hostNode.m);
            subInterpreter.environment.setRootM(hostNode.m);
            target.addObserver(
                subInterpreter,
                scope,
                new BrsString(update.field),
                new BrsString(functionName),
                infoFields
            );
            return BrsInvalid.Instance;
        });
    }

    private resolveHostNode(taskId: number, hostAddress?: string): Node | undefined {
        if (hostAddress) {
            const taskNode = sgRoot.getThreadTask(taskId);
            const fromTask = findNodeByAddress(taskNode, hostAddress);
            if (fromTask) {
                return fromTask;
            }
            const sceneNode = findNodeByAddress(sgRoot.scene, hostAddress);
            if (sceneNode) {
                return sceneNode;
            }
            const globalNode = findNodeByAddress(sgRoot.mGlobal, hostAddress);
            if (globalNode) {
                return globalNode;
            }
        }
        if (taskId > 0) {
            return sgRoot.getThreadTask(taskId);
        }
        return undefined;
    }

    /**
     * Creates a Task node, registering default and initial fields.
     * @param members AA members originating from XML component instantiation.
     * @param name Specific component type name (defaults to `Task`).
     */
    constructor(members: AAMember[] = [], readonly name: string = SGNodeType.Task) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Node);
        this.setThreadSyncType("task");
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
                        this.requestFieldValue("task", fieldName);
                    }
                } else if (this.thread) {
                    this.updateTask();
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
                this.sendThreadUpdate(this.threadId, "set", "task", "control", new BrsString(control));
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
        this.sendThreadUpdate(this.threadId, "set", "task", fieldName, currentValue, deep, requestId);
        if (requestId !== undefined) {
            this.waitForFieldAck(fieldName, requestId);
        }
    }

    private respondToFieldRequest(node: Node | Global | Scene, update: ThreadUpdate) {
        if (update.id < 0) {
            return;
        }
        const value = node.getValue(update.field);
        const deep = value instanceof Node;
        this.sendThreadUpdate(update.id, "set", update.type, update.field, value, deep);
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
            this.processUpdateFromOtherThread();
        }
        postMessage(
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
            sgRoot.setThread(this.threadId, false, this.address, this);
        }
        if (this.threadId >= 0) {
            this.owner = this.threadId;
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
            field: "control",
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

    requestFieldValue(type: "global" | "scene" | "task", fieldName: string, timeoutMs: number = 10000): boolean {
        if (!this.taskBuffer || this.threadId < 0) {
            return false;
        }
        this.sendThreadUpdate(this.threadId, "get", type, fieldName, BrsInvalid.Instance, false);
        const deadline = Date.now() + timeoutMs;

        while (true) {
            const update = this.processUpdateFromOtherThread();
            if (update?.action === "set" && update.type === type && update.field === fieldName) {
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
        }
        postMessage(`warning,[task] Rendezvous timeout for ${type}.${fieldName} on thread ${this.threadId}`);
        return false;
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
        const updates = this.processUpdateFromOtherThread();
        const state = this.getValueJS("state") as string;
        if (!this.thread || state !== "run") {
            return updates !== undefined;
        }
        // Check for changed Node fields to notify updates to the Main thread
        for (const [name, field] of this.getNodeFields()) {
            const value = field.getValue();
            if (!field.isHidden() && value instanceof Node && value.changed) {
                this.sendThreadUpdate(this.threadId, "set", "task", name, value, true);
            }
        }
        return updates !== undefined;
    }

    /**
     * Applies pending updates stored in the shared buffer that originated from another thread.
     * @returns The ThreadUpdate that was applied, if any.
     */
    private processUpdateFromOtherThread(): ThreadUpdate | undefined {
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
            const node = this.getNodeToUpdate(update.type);
            if (!node) {
                return undefined;
            }
            if (update.action === "obs") {
                this.handleObserverRequest(node, update);
                return update;
            }
            if (update.action === "get") {
                this.respondToFieldRequest(node, update);
                return undefined;
            }
            // Apply update
            const oldValue = node.getValue(update.field);
            let value: BrsType;
            if (oldValue instanceof Node && update.value?._node_ && oldValue.address === update.value._address_) {
                // Update existing node to preserve references
                value = updateSGNode(update.value, oldValue);
            } else {
                value = brsValueOf(update.value);
            }
            node.markFieldFresh(update.field);
            node.setValue(update.field, value, false, undefined, false);
            // Send acknowledgement back to the other thread if needed
            if (!this.thread && update.requestId !== undefined) {
                this.sendThreadUpdate(
                    update.id,
                    "ack",
                    update.type,
                    update.field,
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
    private getNodeToUpdate(type: "global" | "task" | "scene"): this | Global | Scene | undefined {
        if (type === "global") {
            return sgRoot.mGlobal;
        } else if (type === "scene") {
            return sgRoot.scene;
        } else {
            return this;
        }
    }
}

function findNodeByAddress(root: Node | undefined, address: string): Node | undefined {
    if (!root) {
        return undefined;
    }
    if (root.address === address) {
        return root;
    }
    for (const child of root.getNodeChildren()) {
        if (child instanceof Node) {
            const match = findNodeByAddress(child, address);
            if (match) {
                return match;
            }
        }
    }
    return undefined;
}
