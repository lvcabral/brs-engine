import { AAMember, BrsString, BrsType, isBrsString } from "brs-engine";
import { Node } from "./Node";
import { sgRoot } from "../SGRoot";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";

export abstract class AnimationBase extends Node {
    readonly defaultFields: FieldModel[] = [
        { name: "control", type: "string", value: "none" },
        { name: "state", type: "string", value: "stopped", system: true },
        { name: "repeat", type: "boolean", value: "false" },
        { name: "delay", type: "float", value: "0" },
    ];

    protected _state: "stopped" | "running" | "paused" = "stopped";
    private lastUpdateTime: number = 0;
    protected elapsedTime: number = 0;
    private delayRemaining: number = 0;

    constructor(members: AAMember[] = [], name: string = SGNodeType.AnimationBase) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Node);
        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);
        this.delayRemaining = this.getDelaySeconds();
        // Animations are scheduled when control transitions to "start"/"resume".
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const mapKey = index.toLowerCase();
        const field = this.fields.get(mapKey);

        if (field && mapKey === "control" && isBrsString(value)) {
            const control = value.getValue().toLowerCase();
            this.handleControl(control);
            field.setValue(new BrsString(control));
            this.fields.set(mapKey, field);
            return;
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    protected handleControl(control: string) {
        switch (control) {
            case "start":
                this.startFromBeginning();
                break;
            case "stop":
            case "none":
                this.stop();
                break;
            case "pause":
                this.pause();
                break;
            case "resume":
                if (this._state === "paused") {
                    this.resumeFromPause();
                } else {
                    this.startFromBeginning();
                }
                break;
            case "finish":
                this.finishImmediately();
                break;
            default:
                break;
        }
    }

    stop() {
        this._state = "stopped";
        this.elapsedTime = 0;
        this.delayRemaining = this.getDelaySeconds();
        this.updateStateField("stopped");
        this.dequeue();
    }

    tick(): boolean {
        if (this._state !== "running") {
            return false;
        }

        const now = performance.now();
        const delta = (now - this.lastUpdateTime) / 1000; // seconds
        this.lastUpdateTime = now;
        let effectiveDelta = delta;
        if (this.delayRemaining > 0) {
            this.delayRemaining -= delta;
            if (this.delayRemaining > 0) {
                return false;
            }
            effectiveDelta = Math.abs(this.delayRemaining);
            this.delayRemaining = 0;
        }

        this.elapsedTime += effectiveDelta;

        const duration = this.getDurationSeconds();
        const rawFraction = duration > 0 ? Math.min(this.elapsedTime / duration, 1.0) : 1.0;
        const easedFraction = this.shapeFraction(Math.min(Math.max(rawFraction, 0), 1));

        this.updateAnimation(easedFraction);

        if (duration <= 0 || this.elapsedTime >= duration) {
            if (this.shouldRepeat()) {
                this.elapsedTime = 0;
                this.delayRemaining = this.getDelaySeconds();
                this.lastUpdateTime = performance.now();
            } else {
                this.stop();
            }
        }
        return true;
    }

    protected abstract updateAnimation(fraction: number): void;

    protected shapeFraction(fraction: number): number {
        return fraction;
    }

    protected getDurationSeconds(): number {
        return 0;
    }

    protected shouldRepeat(): boolean {
        return Boolean(this.getValueJS("repeat"));
    }

    protected getDelaySeconds(): number {
        const delay = this.getValueJS("delay");
        if (typeof delay === "number" && delay > 0) {
            return delay;
        }
        return 0;
    }

    protected startFromBeginning() {
        this.elapsedTime = 0;
        this.delayRemaining = this.getDelaySeconds();
        this.lastUpdateTime = performance.now();
        this.enterRunningState();
    }

    protected resumeFromPause() {
        this.lastUpdateTime = performance.now();
        this.enterRunningState();
    }

    protected pause() {
        if (this._state !== "running") {
            return;
        }
        this._state = "paused";
        this.updateStateField("paused");
        this.dequeue();
    }

    protected finishImmediately() {
        const finalFraction = this.shapeFraction(1);
        this.updateAnimation(finalFraction);
        this.stop();
    }

    private enterRunningState() {
        this._state = "running";
        this.updateStateField("running");
        this.enqueue();
    }

    private enqueue() {
        if (!sgRoot.animations.includes(this)) {
            sgRoot.animations.push(this);
        }
    }

    private dequeue() {
        const index = sgRoot.animations.indexOf(this);
        if (index > -1) {
            sgRoot.animations.splice(index, 1);
        }
    }

    protected updateStateField(state: "running" | "paused" | "stopped") {
        const field = this.fields.get("state");
        if (field) {
            field.setValue(new BrsString(state));
            this.fields.set("state", field);
        }
    }
}
