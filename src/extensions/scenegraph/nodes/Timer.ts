import { AAMember, BrsInvalid, BrsString, BrsType, isBrsString } from "brs-engine";
import { Node } from "./Node";
import { sgRoot } from "../SGRoot";
import { sgClock } from "../SGClock";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";

export class Timer extends Node {
    readonly defaultFields: FieldModel[] = [
        { name: "control", type: "string", value: "none" },
        { name: "repeat", type: "boolean", value: "false" },
        { name: "duration", type: "time", value: "1.0" },
        { name: "fire", type: "object", alwaysNotify: true },
    ];

    active: boolean;
    private lastFireTime: number;
    private jsCallback?: Function;

    constructor(members: AAMember[] = [], readonly name: string = SGNodeType.Timer) {
        super([], name);
        this.setExtendsType(SGNodeType.Timer, SGNodeType.Node);
        this.lastFireTime = 0;
        this.active = false;

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const mapKey = index.toLowerCase();
        const field = this.fields.get(mapKey);

        if (field && mapKey === "control" && isBrsString(value)) {
            let control = value.getValue().toLowerCase();
            if (control === "start") {
                this.lastFireTime = sgClock.perfNow();
                this.active = true;
                if (!sgRoot.timers.includes(this)) {
                    sgRoot.timers.push(this);
                }
            } else if (control === "stop") {
                this.active = false;
                this.release();
            } else {
                control = "none";
            }
            field.setValue(new BrsString(control));
            this.fields.set(mapKey, field);
            return;
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    private release() {
        const index = sgRoot.timers.indexOf(this);
        if (index > -1) {
            sgRoot.timers.splice(index, 1);
        }
    }

    setCallback(callback: Function) {
        this.jsCallback = callback;
    }

    checkFire() {
        const now = sgClock.perfNow();
        const duration = this.getValueJS("duration") as number;
        const repeat = this.getValueJS("repeat") as boolean;
        if (this.active && (now - this.lastFireTime) / 1000 >= duration) {
            this.lastFireTime = now;
            this.active = repeat;
            if (!repeat) {
                this.release();
            }
            this.fields.get("fire")?.setValue(BrsInvalid.Instance);
            if (this.jsCallback) {
                this.jsCallback();
            }
            return true;
        }
        return false;
    }
}
