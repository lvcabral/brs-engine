import { AAMember, BrsString, BrsType, isBrsString } from "brs-engine";
import { Node } from "./Node";
import { sgRoot } from "../SGRoot";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";

/**
 * Shared scaffolding for all SceneGraph animation nodes. Handles control-state transitions, repeat/
 * delay bookkeeping, lifecycle scheduling with `sgRoot`, and delegates rendering to subclasses via
 * `updateAnimation`.
 */
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

    /**
     * Registers default animation fields and captures the initial delay so derived classes start with the
     * same state Roku devices expect.
     */
    constructor(members: AAMember[] = [], name: string = SGNodeType.AnimationBase) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Node);
        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);
        this.delayRemaining = this.getDelaySeconds();
        // Animations are scheduled when control transitions to "start"/"resume".
    }

    /**
     * Intercepts writes to `control` so lifecycle changes flow through `handleControl` before updating the
     * stored value. All other fields defer to the base `Node` implementation.
     */
    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
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

    /**
     * Centralized handler for Roku's animation control strings.
     */
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

    /**
     * Stops the animation, clears elapsed time/delay, and removes it from the global scheduler.
     */
    stop() {
        this._state = "stopped";
        this.elapsedTime = 0;
        this.delayRemaining = this.getDelaySeconds();
        this.updateStateField("stopped");
        this.dequeue();
    }

    /**
     * Called by sgRoot every frame. Updates elapsed time, applies delay logic, calls `updateAnimation`,
     * and manages repeat/stop behavior.
     */
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
        const rawFraction = duration > 0 ? Math.min(this.elapsedTime / duration, 1) : 1;
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

    /**
     * Subclasses must implement their per-frame behavior using the eased fraction.
     */
    protected abstract updateAnimation(fraction: number): void;

    /**
     * Override to provide easing/shaping at the base layer.
     */
    protected shapeFraction(fraction: number): number {
        return fraction;
    }

    /**
     * Override to declare the duration (seconds) for concrete animations.
     */
    protected getDurationSeconds(): number {
        return 0;
    }

    /**
     * Determines whether the animation should loop back to the start when it finishes.
     */
    protected shouldRepeat(): boolean {
        return Boolean(this.getValueJS("repeat"));
    }

    /**
     * Reads the `delay` field and normalizes it to seconds.
     */
    protected getDelaySeconds(): number {
        const delay = this.getValueJS("delay");
        if (typeof delay === "number" && delay > 0) {
            return delay;
        }
        return 0;
    }

    /**
     * Resets timing counters and transitions the animation into the running state.
     */
    protected startFromBeginning() {
        this.elapsedTime = 0;
        this.delayRemaining = this.getDelaySeconds();
        this.lastUpdateTime = performance.now();
        this.enterRunningState();
    }

    /**
     * Continues from a paused state without resetting elapsed time.
     */
    protected resumeFromPause() {
        this.lastUpdateTime = performance.now();
        this.enterRunningState();
    }

    /**
     * Pauses the animation if it is running and removes it from the scheduler queue.
     */
    protected pause() {
        if (this._state !== "running") {
            return;
        }
        this._state = "paused";
        this.updateStateField("paused");
        this.dequeue();
    }

    /**
     * Immediately jumps to the final eased fraction and stops the animation.
     */
    protected finishImmediately() {
        const finalFraction = this.shapeFraction(1);
        this.updateAnimation(finalFraction);
        this.stop();
    }

    /**
     * Helper to mark the animation running and enqueue it for ticking.
     */
    private enterRunningState() {
        this._state = "running";
        this.updateStateField("running");
        this.enqueue();
    }

    /**
     * Registers the instance with sgRoot so it receives `tick()` callbacks.
     */
    private enqueue() {
        if (!sgRoot.animations.includes(this)) {
            sgRoot.animations.push(this);
        }
    }

    /**
     * Removes the instance from sgRoot's animation list.
     */
    private dequeue() {
        const index = sgRoot.animations.indexOf(this);
        if (index > -1) {
            sgRoot.animations.splice(index, 1);
        }
    }

    /**
     * Synchronizes the public `state` field so BrightScript observers see the current lifecycle state.
     */
    protected updateStateField(state: "running" | "paused" | "stopped") {
        const field = this.fields.get("state");
        if (field) {
            field.setValue(new BrsString(state));
            this.fields.set("state", field);
        }
    }
}
