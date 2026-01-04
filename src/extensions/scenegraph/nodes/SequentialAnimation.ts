import { AAMember, BrsString } from "brs-engine";
import { AnimationBase } from "./AnimationBase";
import { SGNodeType } from ".";

export class SequentialAnimation extends AnimationBase {
    private currentChildIndex: number = -1;

    constructor(members: AAMember[] = [], name: string = SGNodeType.SequentialAnimation) {
        super(members, name);
    }

    setValue(index: string, value: any, alwaysNotify: boolean = false) {
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

    private playNext() {
        if (this.currentChildIndex >= 0 && this.currentChildIndex < this.children.length) {
            const child = this.children[this.currentChildIndex];
            if (child instanceof AnimationBase) {
                child.setValue("control", new BrsString("start"));
            }
        } else {
            // Done
            if (this.getValueJS("repeat") as boolean) {
                this.currentChildIndex = 0;
                this.playNext();
            } else {
                this.stop();
            }
        }
    }

    private stopCurrent() {
        if (this.currentChildIndex >= 0 && this.currentChildIndex < this.children.length) {
            const child = this.children[this.currentChildIndex];
            if (child instanceof AnimationBase) {
                child.setValue("control", new BrsString("stop"));
            }
        }
    }

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

    stop() {
        this.stopCurrent();
        this.currentChildIndex = -1;
        super.stop();
    }

    protected updateAnimation(fraction: number) {
        // No-op
    }
}
