import { RoSGNode } from "../components/RoSGNode";
import {
    AAMember,
    BrsType,
    ValueKind,
    BrsString,
    BrsInvalid,
    fromAssociativeArray,
    jsValueOf,
} from "..";
import { Field, FieldKind, FieldModel } from "./Field";
import { Interpreter } from "../../interpreter";
import { DataType, TaskData, TaskState, TaskUpdate } from "../../common";

export class Task extends RoSGNode {
    readonly defaultFields: FieldModel[] = [
        { name: "control", type: "string" },
        { name: "state", type: "string", value: "init" },
        { name: "functionName", type: "string" },
    ];

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

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
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
            }
            return BrsInvalid.Instance;
        } else if (field && mapKey === "state" && value instanceof BrsString) {
            if (validStates.includes(value.value.toLowerCase())) {
                field.setValue(value);
            }
            return BrsInvalid.Instance;
        } else if (field && this.thread) {
            const taskUpdate: TaskUpdate = { id: this.id, field: mapKey, value: jsValueOf(value) };
            postMessage(taskUpdate);
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    checkTask(interpreter: Interpreter) {
        const functionName = this.getFieldValue("functionName") as BrsString;
        if (!functionName || functionName.value.trim() === "") {
            this.set(new BrsString("control"), new BrsString("stop"));
            return;
        }
        if (!this.started) {
            const taskData: TaskData = {
                id: this.id,
                name: this.nodeSubtype,
                state: TaskState.RUN,
                m: fromAssociativeArray(this.m),
            };
            console.log("Posting Task Data to RUN: ", this.nodeSubtype, functionName.value);
            postMessage(taskData);
            this.started = true;
        } else {
            const state = Atomics.load(interpreter.sharedArray, DataType.TASK);
            if (state === -1) {
                return;
            }
            if (state === TaskState.STOP || state === TaskState.DONE) {
                this.set(new BrsString("control"), new BrsString(TaskState[state]));
            }
            Atomics.store(interpreter.sharedArray, DataType.TASK, -1);
        }
    }
}
