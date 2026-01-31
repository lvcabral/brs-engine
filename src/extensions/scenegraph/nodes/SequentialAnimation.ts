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
        super.setValue(index, value, alwaysNotify);
        if (index.toLowerCase() === "control") {
            const control = value.getValue().toLowerCase();
            if (control === "start") {
                this.currentChildIndex = 0;
                this.playNext();
            } else if (control === "stop") {
                this.stopCurrent();
                this.currentChildIndex = -1;
            }
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
