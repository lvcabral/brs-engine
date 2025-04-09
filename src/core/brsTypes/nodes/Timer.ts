import { RoSGNode } from "../components/RoSGNode";
import { FieldKind, FieldModel } from "./Field";
import { AAMember, BrsType, BrsString, BrsInvalid, isBrsString } from "..";

export class Timer extends RoSGNode {
    readonly defaultFields: FieldModel[] = [
        { name: "control", type: "string" },
        { name: "repeat", type: "boolean", value: "false" },
        { name: "duration", type: "float", value: "1.0" },
        { name: "fire", type: "object", alwaysNotify: true },
    ];

    active: boolean;
    private lastFireTime: number;
    private jsCallback?: Function;

    constructor(members: AAMember[] = [], readonly name: string = "Timer") {
        super([], name);
        this.lastFireTime = 0;
        this.active = false;

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }

        const mapKey = index.getValue().toLowerCase();
        const field = this.fields.get(mapKey);

        if (field && mapKey === "control" && isBrsString(value)) {
            let control = value.getValue().toLowerCase();
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

    setCallback(callback: Function) {
        this.jsCallback = callback;
    }

    checkFire() {
        const now = performance.now();
        const duration = this.getFieldValueJS("duration") as number;
        const repeat = this.getFieldValueJS("repeat") as boolean;
        if (this.active && (now - this.lastFireTime) / 1000 >= duration) {
            this.lastFireTime = now;
            this.active = repeat;
            this.fields.get("fire")?.setValue(BrsInvalid.Instance);
            if (this.jsCallback) {
                this.jsCallback();
            }
            return true;
        }
        return false;
    }
}
