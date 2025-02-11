import { RoSGNode } from "../components/RoSGNode";
import { FieldKind, FieldModel } from "./Field";
import { AAMember, BrsType, BrsBoolean, Float, ValueKind, BrsString, BrsInvalid } from "..";

export class Timer extends RoSGNode {
    readonly defaultFields: FieldModel[] = [
        { name: "control", type: "string" },
        { name: "repeat", type: "boolean" },
        { name: "duration", type: "float" },
        { name: "fire", type: "object", alwaysNotify: true },
    ];

    active: boolean;
    private lastFireTime: number;

    constructor(members: AAMember[] = [], readonly name: string = "Timer") {
        super([], name);
        this.lastFireTime = 0;
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
            let control = value.value;
            if (control === "start") {
                this.lastFireTime = performance.now();
                this.active = true;
            } else if (control === "stop") {
                this.active = false;
            } else {
                control = "none";
            }
            field.setValue(new BrsString(control));
            this.fields.set(mapKey, field);
            return BrsInvalid.Instance;
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    checkFire() {
        const now = performance.now();
        const duration = this.getFieldValue("duration") as Float;
        const repeat = this.getFieldValue("repeat") as BrsBoolean;
        if (this.active && (now - this.lastFireTime) / 1000 >= duration.getValue()) {
            this.lastFireTime = now;
            this.active = repeat.toBoolean();
            this.fields.get("fire")?.setValue(BrsInvalid.Instance);
            return true;
        }
        return false;
    }
}
