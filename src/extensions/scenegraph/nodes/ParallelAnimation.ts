import { AAMember, BrsString } from "brs-engine";
import { AnimationBase } from "./AnimationBase";
import { SGNodeType } from ".";

export class ParallelAnimation extends AnimationBase {
    constructor(members: AAMember[] = [], name: string = SGNodeType.ParallelAnimation) {
        super(members, name);
    }

    setValue(index: string, value: any, alwaysNotify: boolean = false) {
        super.setValue(index, value, alwaysNotify);
        if (index.toLowerCase() === "control") {
            const control = value.getValue().toLowerCase();
            if (control === "start" || control === "stop") {
                this.propagateControl(control);
            }
        }
    }

    // ParallelAnimation monitors children, but they run independently in sgRoot
    protected updateAnimation(fraction: number) {
        // No-op for ParallelAnimation base update
    }

    tick(): boolean {
        if (this._state !== "running") {
            return false;
        }

        // Check if all children are stopped
        let allStopped = true;
        for (const child of this.children) {
            if (child instanceof AnimationBase) {
                if (child.getValueJS("state") !== "stopped") {
                    allStopped = false;
                    break;
                }
            }
        }

        if (allStopped) {
            if (this.getValueJS("repeat") as boolean) {
                this.propagateControl("start");
            } else {
                this.stop();
            }
        }

        return true;
    }

    stop() {
        this.propagateControl("stop");
        super.stop();
    }

    private propagateControl(control: string) {
        for (const child of this.children) {
            if (child instanceof AnimationBase) {
                child.setValue("control", new BrsString(control));
            }
        }
    }
}
