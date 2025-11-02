import { RoSGNode } from "../components/RoSGNode";
import {
    AAMember,
    BrsType,
    BrsString,
    BrsInvalid,
    fromAssociativeArray,
    jsValueOf,
    BrsEvent,
    brsValueOf,
    isBrsString,
    sgRoot,
    fromSGNode,
    Scene,
} from "..";
import { Field, FieldKind, FieldModel } from "./Field";
import { isThreadUpdate, TaskData, TaskState, ThreadUpdate } from "../../common";
import SharedObject from "../../SharedObject";
import { Global } from "./Global";
import { Interpreter } from "../../interpreter";

export class Task extends RoSGNode {
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

    constructor(members: AAMember[] = [], readonly name: string = "Task") {
        super([], name);
        this.id = -1; // Not initialized
        this.active = false;
        this.started = false;
        this.thread = false;

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind, sync: boolean = true) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const validStates = ["init", "run", "stop", "done"];
        const mapKey = index.getValue().toLowerCase();
        const field = this.fields.get(mapKey);

        if (field && mapKey === "control" && isBrsString(value)) {
            let control = value.getValue().toLowerCase();
            if (!validStates.includes(control)) {
                control = "";
            }
            this.setControlField(field, control, sync);
            return BrsInvalid.Instance;
        } else if (field && mapKey === "state" && isBrsString(value)) {
            // Roku documentation states this is read-only but it allows change the value to valid states
            // But it does not trigger any action
            if (validStates.includes(value.getValue().toLowerCase())) {
                field.setValue(value);
            }
            return BrsInvalid.Instance;
        } else if (this.id >= 0 && field && sync) {
            const update: ThreadUpdate = {
                id: this.id,
                type: "task",
                field: mapKey,
                value: jsValueOf(value),
            };
            if (this.thread && value instanceof RoSGNode) {
                value.changed = false;
            }
            postMessage(update);
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    private setControlField(field: Field, control: string, sync: boolean) {
        const state = this.fields.get("state") as Field;
        if (control === "run") {
            this.active = true;
        } else if (control === "stop" || control === "done") {
            if (this.started) {
                console.debug("Posting Task Data to STOP: ", this.nodeSubtype);
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
                const update: ThreadUpdate = {
                    id: this.id,
                    type: "task",
                    field: "control",
                    value: control,
                };
                postMessage(update);
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
            console.debug(`The thread ${this.id} was awaken with "${result}"`);
            this.updateTask();
        }
        return new Array<BrsEvent>();
    }

    checkTask() {
        const functionName = this.getFieldValueJS("functionName") as string;
        if (!functionName || functionName.trim() === "") {
            this.set(new BrsString("control"), new BrsString("stop"));
            return;
        }
        if (!this.started) {
            this.taskBuffer = new SharedObject();
            const taskData: TaskData = {
                id: this.id,
                name: this.nodeSubtype,
                state: TaskState.RUN,
                buffer: this.taskBuffer.getBuffer(),
                m: fromAssociativeArray(this.m),
                scene: sgRoot.scene ? fromSGNode(sgRoot.scene) : undefined,
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
            console.debug("Posting Task Data to RUN: ", this.nodeSubtype, functionName);
            postMessage(taskData);
            this.started = true;
        }
    }

    updateTask() {
        const updates = this.processUpdateFromOtherThread();
        const state = this.getFieldValueJS("state") as string;
        if (!this.thread || state !== "run") {
            return updates;
        }
        // Check for changed fields to notify updates to the Main thread
        for (const [name, field] of this.getNodeFields()) {
            const value = field.getValue();
            if (!field.isHidden() && value instanceof RoSGNode && value.changed) {
                value.changed = false;
                const update: ThreadUpdate = {
                    id: this.id,
                    type: "task",
                    field: name,
                    value: jsValueOf(value),
                };
                postMessage(update);
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
                    `Received Update from ${this.thread ? "Main thread" : "Task Thread"}: `,
                    update.id,
                    update.type,
                    update.field
                );
                const node = this.getNodeToUpdate(update.type);
                if (node) {
                    const field = new BrsString(update.field);
                    const value = brsValueOf(update.value);
                    node.set(field, value, false, undefined, false);
                    return true;
                }
            }
        }
        return false;
    }

    private getNodeToUpdate(type: "global" | "task" | "scene"): Task | Global | Scene | undefined {
        if (type === "global") {
            return sgRoot.mGlobal;
        } else if (type === "scene") {
            return sgRoot.scene;
        } else {
            return this;
        }
    }
}
