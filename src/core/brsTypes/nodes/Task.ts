import { RoSGNode } from "../components/RoSGNode";
import { AAMember, BrsType, ValueKind, BrsString, BrsInvalid } from "..";
import { Field, FieldKind, FieldModel } from "./Field";
import { Interpreter } from "../../interpreter";
import { DataType, TaskData, TaskState } from "../../common";

export class Task extends RoSGNode {
    readonly defaultFields: FieldModel[] = [
        { name: "control", type: "string" },
        { name: "state", type: "string", value: "init" },
        { name: "functionName", type: "string" },
    ];

    active: boolean;
    started: boolean;

    constructor(members: AAMember[] = [], readonly name: string = "Task") {
        super([], name);
        this.active = false;
        this.started = false;

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
                    postMessage({ name: this.nodeSubtype, state: TaskState.STOP });
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
            const taskData = {
                name: this.nodeSubtype,
                state: TaskState.RUN,
                function: functionName.value,
            };
            console.log("Posting Task Data to RUN: ", taskData.name, taskData.function);
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
