import { RoSGNode } from "../components/RoSGNode";
import { AAMember, BrsType, ValueKind, BrsString, BrsInvalid, Callable } from "..";
import { FieldKind, FieldModel } from "./Field";
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

        const mapKey = index.value.toLowerCase();
        const field = this.fields.get(mapKey);

        if (field && mapKey === "control" && value instanceof BrsString) {
            let control = value.value.toLowerCase();
            if (control === "run") {
                console.log("Task run");
                this.active = true;
            } else if (control === "stop") {
                this.active = false;
            } else {
                control = "done";
            }
            field.setValue(new BrsString(control));
            this.fields.set(mapKey, field);
            return BrsInvalid.Instance;
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    checkTask(interpreter: Interpreter) {
        const functionName = this.getFieldValue("functionName") as BrsString;
        let funcToCall = interpreter.getFunction(functionName.value);
        let typeDef = interpreter.environment.nodeDefMap.get(this.nodeSubtype.toLowerCase());
        let currentEnv = typeDef?.environment?.createSubEnvironment();
        if (currentEnv && funcToCall instanceof Callable) {
            const mPointer = this.m;
            const node = this;
            interpreter.inSubEnv((subInterpreter) => {
                subInterpreter.environment.hostNode = node;
                subInterpreter.environment.setM(mPointer);
                subInterpreter.environment.setRootM(mPointer);
                funcToCall.call(subInterpreter);
                return BrsInvalid.Instance;
            }, currentEnv);
        }
        this.active = false;
    }
}
