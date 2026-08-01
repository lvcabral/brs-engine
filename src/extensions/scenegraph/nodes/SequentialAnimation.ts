import { AAMember, BrsString } from "brs-engine";
import { AnimationBase } from "./AnimationBase";
import { SGNodeType } from ".";

/**
 * Implements Roku's `SequentialAnimation`, launching child animations one at a time and waiting for each
 * to stop before advancing to the next.
 */
export class SequentialAnimation extends AnimationBase {
    private currentChildIndex: number = -1;

    /**
     * Registers required default fields through the base class.
     */
    constructor(members: AAMember[] = [], name: string = SGNodeType.SequentialAnimation) {
        super(members, name);
    }

    /**
     * Intercepts `control` writes so `start` initializes the iteration cursor and `stop` cancels any active
     * child animation.
     */
    setValue(index: string, value: any, alwaysNotify?: boolean) {
        const isControl = index.toLowerCase() === "control";
        // Captured BEFORE the base class acts: `finish` routes through finishImmediately() -> stop(),
        // and this node's stop() override resets the cursor to -1, so by the time control returns the
        // active child is no longer known.
        const activeIndex = this.currentChildIndex;
        super.setValue(index, value, alwaysNotify);
        if (!isControl) {
            return;
        }
        const control = value.getValue().toLowerCase();
        if (control === "start") {
            this.currentChildIndex = 0;
            this.playNext();
        } else if (control === "stop") {
            this.stopCurrent();
            this.currentChildIndex = -1;
        } else if (control === "pause" || control === "resume") {
            // DEVICE-MEASURED: only the child that is actually running pauses/resumes; the ones that
            // already completed and the ones not yet reached keep their own state. A resume continues
            // from where the child paused rather than restarting it.
            this.forwardToChild(activeIndex, control);
        } else if (control === "finish") {
            this.finishRemaining(activeIndex);
        }
    }

    /**
     * Fast-forwards the current child AND every child after it.
     *
     * DEVICE-MEASURED (Streaming Stick, Roku OS 15.2): finishing a sequence mid-way sets the animated
     * field of every remaining child — including ones that never ran — to its final value, matching
     * the reference ("All animated fields will be immediately set to their final values as if the
     * animation had completed"). Previously nothing was forwarded, so a sequence finished after its
     * first child left the later children's targets untouched at their authored values.
     *
     * The base `finishImmediately()` has already run `stop()` by this point, which sends `stop` to the
     * child that was running; sending `finish` afterwards still lands its target on the final value,
     * because `finishImmediately` applies fraction 1 regardless of the child's current state.
     *
     * A sequence that was never started has no cursor (-1); it finishes from the first child, which is
     * the reading consistent with "all animated fields".
     */
    private finishRemaining(fromIndex: number) {
        for (let i = Math.max(0, fromIndex); i < this.children.length; i++) {
            const child = this.children[i];
            if (child instanceof AnimationBase) {
                child.setValue("control", new BrsString("finish"));
            }
        }
    }

    /** Relays a control command to a single child by index, when that index addresses one. */
    private forwardToChild(index: number, control: string) {
        if (index < 0 || index >= this.children.length) {
            return;
        }
        const child = this.children[index];
        if (child instanceof AnimationBase) {
            child.setValue("control", new BrsString(control));
        }
    }

    /**
     * Starts the current child animation or loops/restarts the sequence once every child has completed.
     */
    private playNext() {
        if (this.currentChildIndex >= 0 && this.currentChildIndex < this.children.length) {
            const child = this.children[this.currentChildIndex];
            if (child instanceof AnimationBase) {
                child.setValue("control", new BrsString("start"));
            }
        } else if (this.getValueJS("repeat") as boolean) {
            this.currentChildIndex = 0;
            this.playNext();
        } else {
            this.stop();
        }
    }

    /**
     * Issues a stop command to the child at the current index if one is active.
     */
    private stopCurrent() {
        if (this.currentChildIndex >= 0 && this.currentChildIndex < this.children.length) {
            const child = this.children[this.currentChildIndex];
            if (child instanceof AnimationBase) {
                child.setValue("control", new BrsString("stop"));
            }
        }
    }

    /**
     * Advances the sequential controller by monitoring the active child's state and starting the next
     * animation when appropriate. Handles empty child lists gracefully.
     */
    tick(): boolean {
        if (this._state !== "running") {
            return false;
        }

        if (this.currentChildIndex >= 0 && this.currentChildIndex < this.children.length) {
            const child = this.children[this.currentChildIndex];
            if (child instanceof AnimationBase) {
                if (child.getValueJS("state") === "stopped") {
                    this.currentChildIndex++;
                    this.playNext();
                }
            }
        } else if (this.currentChildIndex === -1 && this.children.length > 0) {
            // Should not happen if playNext called at start, but safety
            this.currentChildIndex = 0;
            this.playNext();
        } else {
            // No children or invalid state, stop
            this.stop();
        }

        return true;
    }

    /**
     * Stops whatever child is running, resets the cursor, and defers to the base implementation for the
     * standard lifecycle cleanup.
     */
    stop() {
        this.stopCurrent();
        this.currentChildIndex = -1;
        super.stop();
    }

    /**
     * SequentialAnimation does not animate its own fields, so this remains a no-op.
     */
    protected updateAnimation(fraction: number) {
        // No-op
    }
}
