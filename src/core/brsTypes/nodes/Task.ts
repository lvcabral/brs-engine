import { RoSGNode } from "../components/RoSGNode";
import {
    AAMember,
    BrsType,
    ValueKind,
    BrsString,
    BrsInvalid,
    fromAssociativeArray,
    jsValueOf,
    BrsEvent,
    brsValueOf,
} from "..";
import { Field, FieldKind, FieldModel } from "./Field";
import { isTaskUpdate, TaskData, TaskState, TaskUpdate } from "../../common";
import SharedObject from "../../SharedObject";

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

    set(
        index: BrsType,
        value: BrsType,
        alwaysNotify: boolean = false,
        kind?: FieldKind,
        sync: boolean = true
    ) {
        if (index.kind !== ValueKind.String) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const validStates = ["init", "run", "stop", "done"];
        const mapKey = index.value.toLowerCase();
        const field = this.fields.get(mapKey);

        if (field && mapKey === "control" && value instanceof BrsString) {
            const state = this.fields.get("state") as Field;
            let control = value.value.toLowerCase();
            if (!validStates.includes(control)) {
                control = "";
            } else if (control === "run") {
                this.active = true;
            } else if (control === "stop" || control === "done") {
                if (this.started) {
                    console.log("Posting Task Data to STOP: ", this.nodeSubtype);
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
                    const taskUpdate: TaskUpdate = { id: this.id, field: mapKey, value: control };
                    postMessage(taskUpdate);
                }
            }
            return BrsInvalid.Instance;
        } else if (field && mapKey === "state" && value instanceof BrsString) {
            // Roku documentation states this is read-only but it allows change the value to valid states
            // But it does not trigger any action
            if (validStates.includes(value.value.toLowerCase())) {
                field.setValue(value);
            }
            return BrsInvalid.Instance;
        } else if (this.id >= 0 && field && sync) {
            const taskUpdate: TaskUpdate = { id: this.id, field: mapKey, value: jsValueOf(value) };
            postMessage(taskUpdate);
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    setTaskBuffer(data: SharedArrayBuffer) {
        this.taskBuffer = new SharedObject();
        this.taskBuffer.setBuffer(data);
    }

    /** Message callback to handle observed fields with message port */
    protected getNewEvents() {
        const events: BrsEvent[] = [];
        this.updateTask();
        return events;
    }

    checkTask() {
        const functionName = this.getFieldValue("functionName") as BrsString;
        if (!functionName || functionName.value.trim() === "") {
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
            };
            console.log("Posting Task Data to RUN: ", this.nodeSubtype, functionName.value);
            postMessage(taskData);
            this.started = true;
        }
    }

    updateTask() {
        let currentVersion = this.taskBuffer?.getVersion() ?? 0;
        if (this.taskBuffer && currentVersion === 1) {
            const taskUpdate = this.taskBuffer.load(true);
            if (isTaskUpdate(taskUpdate)) {
                console.log(
                    `Received Update from ${this.thread ? "Main thread" : "Task Thread"}: `,
                    taskUpdate.id,
                    taskUpdate.field
                );
                this.set(
                    new BrsString(taskUpdate.field),
                    brsValueOf(taskUpdate.value),
                    undefined,
                    undefined,
                    false
                );
                return true;
            }
        }
        return false;
    }
}
