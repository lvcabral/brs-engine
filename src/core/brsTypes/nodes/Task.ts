import { RoSGNode } from "../components/RoSGNode";
import { AAMember, BrsType, ValueKind, BrsString, BrsInvalid, Callable } from "..";
import { Field, FieldKind, FieldModel } from "./Field";
import { Interpreter } from "../../interpreter";

export class Task extends RoSGNode {
    readonly defaultFields: FieldModel[] = [
        { name: "control", type: "string" },
        { name: "state", type: "string", value: "init" },
        { name: "functionName", type: "string" },
    ];

    active: boolean;

    constructor(members: AAMember[] = [], readonly name: string = "Task") {
        super([], name);
        this.active = false;

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
        if (!this.active || !functionName || functionName.value.trim() === "") {
            return;
        }

        const typeDef = interpreter.environment.nodeDefMap.get(this.nodeSubtype.toLowerCase());
        const taskEnv = typeDef?.environment;
        if (taskEnv) {
            const mPointer = this.m;
            const node = this;
            interpreter.inSubEnv((subInterpreter) => {
                const funcToCall = interpreter.getCallableFunction(functionName.value);
                subInterpreter.environment.hostNode = node;
                subInterpreter.environment.setM(mPointer);
                subInterpreter.environment.setRootM(mPointer);
                if (funcToCall instanceof Callable) {
                    funcToCall.call(subInterpreter);
                    node.set(new BrsString("control"), new BrsString("stop"));
                }
                return BrsInvalid.Instance;
            }, taskEnv);
        }
        this.active = false;
    }
}
