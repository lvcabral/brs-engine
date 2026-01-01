import {
    AAMember,
    Interpreter,
    BrsDevice,
    BrsEvent,
    BrsString,
    BrsType,
    isBrsString,
    SharedObject,
    isThreadUpdate,
    TaskData,
    TaskState,
} from "brs-engine";
import { sgRoot } from "../SGRoot";
import { brsValueOf, fromAssociativeArray, fromSGNode, updateSGNode } from "../factory/Serializer";
import { Node } from "./Node";
import { Scene } from "./Scene";
import { Global } from "./Global";
import type { Field } from "./Field";
import { FieldKind, FieldModel } from "../SGTypes";
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
    id: number;
    /** Indicates the task is currently marked as active (control = run). */
    active: boolean;
    /** Whether the task has started execution at least once. */
    started: boolean;
    /** True when this instance runs on a dedicated worker thread. */
    thread: boolean;

    /**
     * Creates a Task node, registering default and initial fields.
     * @param members AA members originating from XML component instantiation.
     * @param name Specific component type name (defaults to `Task`).
     */
    constructor(members: AAMember[] = [], readonly name: string = SGNodeType.Task) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Node);
        this.id = -1; // Not initialized
        this.active = false;
        this.started = false;
        this.thread = false;

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
    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind, sync: boolean = true) {
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
        // Notify Main thread of field changes
        if (this.id >= 0 && field && sync && this.changed) {
            this.sendThreadUpdate(this.id, "task", mapKey, value, true);
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
        const state = this.fields.get("state") as Field;
        if (control === "run") {
            this.active = true;
        } else if (control === "stop" || control === "done") {
            if (this.started) {
                postMessage(`debug,[task] Posting Task #${this.id} Data to STOP: ${this.nodeSubtype}`);
                const taskData: TaskData = {
                    id: this.id,
                    name: this.nodeSubtype,
                    state: TaskState.STOP,
                };
                postMessage(taskData);
                this.started = false;
            }
            this.active = false;
        }
        field.setValue(new BrsString(control));
        if (state && control !== "" && control !== "init") {
            state.setValue(new BrsString(control));
            this.fields.set("state", state);
            if (this.id >= 0 && this.thread && sync) {
                this.sendThreadUpdate(this.id, "task", "control", new BrsString(control));
            }
        }
    }

    /**
     * Initializes the shared buffer wrapper from a raw SharedArrayBuffer.
     * @param data Buffer supplied by the scheduler for inter-thread messaging.
     */
    setTaskBuffer(data: SharedArrayBuffer) {
        this.taskBuffer = new SharedObject();
        this.taskBuffer.setBuffer(data);
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
            const result = this.taskBuffer.waitVersion(0, timeout);
            postMessage(`debug,[task] The thread ${this.id} was awaken with "${result}"`);
            this.updateTask();
        }
        return new Array<BrsEvent>();
    }

    /**
     * Validates readiness and posts task metadata to the scheduler when control becomes `run`.
     */
    checkTask() {
        const functionName = this.getValueJS("functionName") as string;
        if (!functionName || functionName.trim() === "") {
            this.setValue("control", new BrsString("stop"));
            return;
        }
        if (!this.started) {
            this.taskBuffer = new SharedObject();
            const taskData: TaskData = {
                id: this.id,
                name: this.nodeSubtype,
                state: TaskState.RUN,
                buffer: this.taskBuffer.getBuffer(),
                tmp: BrsDevice.getTmpVolume(),
                cacheFS: BrsDevice.getCacheFS(),
                m: fromAssociativeArray(this.m),
                scene: sgRoot.scene ? fromSGNode(sgRoot.scene, false) : undefined,
                render: sgRoot.getRenderThread()?.id,
            };
            // Check of observed fields in `m.global`
            const global = this.m.elements.get("global");
            if (global instanceof Global) {
                const fields = global.getNodeFields();
                const observed: string[] = [];
                for (const [name, field] of fields) {
                    if (!field.isHidden() && field.isPortObserved(this)) {
                        observed.push(name);
                    }
                }
                if (observed.length && taskData.m) {
                    taskData.m.global["_observed_"] = observed;
                }
            }
            postMessage(`debug,[task] Posting Task #${this.id} Data to RUN: ${this.nodeSubtype}, ${functionName}`);
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
            return updates;
        }
        // Check for changed fields to notify updates to the Main thread
        for (const [name, field] of this.getNodeFields()) {
            const value = field.getValue();
            if (!field.isHidden() && value instanceof Node && value.changed) {
                this.sendThreadUpdate(this.id, "task", name, value, true);
            }
        }
        return updates;
    }

    /**
     * Applies pending updates stored in the shared buffer that originated from another thread.
     * @returns True when at least one field update was applied; false otherwise.
     */
    private processUpdateFromOtherThread() {
        const currentVersion = this.taskBuffer?.getVersion() ?? -1;
        // Only process updates when the buffer version is exactly 1,
        // which indicates a new update is available from the other thread.
        // (Versioning protocol: 1 = update ready, 0 = idle/no update)
        if (!this.taskBuffer || currentVersion !== 1) {
            return false;
        }
        const update = this.taskBuffer.load(true);
        if (isThreadUpdate(update)) {
            postMessage(
                `debug,[task] Received Update at ${this.id} thread from ${
                    this.thread ? "Main thread" : "Task Thread"
                }: ${update.id} - ${update.type} - ${update.field}`
            );
            const node = this.getNodeToUpdate(update.type);
            if (!node) {
                return false;
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
            node.setValue(update.field, value, false, undefined, false);
            return true;
        }
        return false;
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
