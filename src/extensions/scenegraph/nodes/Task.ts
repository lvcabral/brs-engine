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
import { brsValueOf, fromAssociativeArray, fromSGNode } from "../factory/serialization";
import { Node } from "./Node";
import { Scene } from "./Scene";
import { Global } from "./Global";
import type { Field } from "./Field";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";

export class Task extends Node {
    readonly defaultFields: FieldModel[] = [
        { name: "control", type: "string" },
        { name: "state", type: "string", value: "init" },
        { name: "functionName", type: "string" },
    ];
    private taskBuffer?: SharedObject;

    id: number;
    active: boolean;
    started: boolean;
    thread: boolean;

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

    private setControlField(field: Field, control: string, sync: boolean) {
        const state = this.fields.get("state") as Field;
        if (control === "run") {
            this.active = true;
        } else if (control === "stop" || control === "done") {
            if (this.started) {
                console.debug(`[Task] Posting Task #${this.id} Data to STOP: ${this.nodeSubtype}`);
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

    setTaskBuffer(data: SharedArrayBuffer) {
        this.taskBuffer = new SharedObject();
        this.taskBuffer.setBuffer(data);
    }

    /** Message callback to handle observed fields with message port */
    protected getNewEvents(_: Interpreter, wait: number) {
        if (this.taskBuffer && this.thread) {
            const timeout = wait === 0 ? undefined : wait;
            const result = this.taskBuffer.waitVersion(0, timeout);
            console.debug(`[Task] The thread ${this.id} was awaken with "${result}"`);
            this.updateTask();
        }
        return new Array<BrsEvent>();
    }

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
            console.debug(`[Task] Posting Task #${this.id} Data to RUN: ${this.nodeSubtype}, ${functionName}`);
            postMessage(taskData);
            this.started = true;
        }
    }

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

    private processUpdateFromOtherThread() {
        let currentVersion = this.taskBuffer?.getVersion() ?? -1;
        if (this.taskBuffer && currentVersion === 1) {
            const update = this.taskBuffer.load(true);
            if (isThreadUpdate(update)) {
                console.debug(
                    `[Task] Received Update at ${this.id} thread from ${this.thread ? "Main thread" : "Task Thread"}: `,
                    update.id,
                    update.type,
                    update.field
                );
                const node = this.getNodeToUpdate(update.type);
                if (node) {
                    const value = brsValueOf(update.value);
                    node.setValue(update.field, value, false, undefined, false);
                    return true;
                }
            }
        }
        return false;
    }

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
