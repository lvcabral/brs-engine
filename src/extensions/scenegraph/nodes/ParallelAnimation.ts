import { AAMember, BrsString } from "brs-engine";
import { AnimationBase } from "./AnimationBase";
import { SGNodeType } from ".";

/**
 * Mirrors Roku's `ParallelAnimation` container. It relays control commands to each child animation so
 * they start and stop in unison while sgRoot tracks their individual progress.
 */
export class ParallelAnimation extends AnimationBase {
    /**
     * Registers required default fields through the base class.
     */
    constructor(members: AAMember[] = [], name: string = SGNodeType.ParallelAnimation) {
        super(members, name);
    }

    /**
     * Forwards every acting `control` command to the children.
     *
     * DEVICE-MEASURED (Streaming Stick, Roku OS 15.2): a container relays the whole control
     * vocabulary, not just start/stop.
     *
     * - `finish` sets EVERY child's animated field to its final value, synchronously — matching the
     *   reference ("All animated fields will be immediately set to their final values as if the
     *   animation had completed"). Forwarding only start/stop meant a container `finish` flipped the
     *   container's own `state` and touched no field at all, because a container's `updateAnimation`
     *   is a no-op.
     * - `pause` pauses the children, and each child's own `state` reads "paused".
     * - `resume` CONTINUES from where the children paused; it does not restart them.
     *
     * `none` is deliberately absent: it is inert on a device (see AnimationBase.handleControl).
     */
    setValue(index: string, value: any, alwaysNotify?: boolean) {
        super.setValue(index, value, alwaysNotify);
        if (index.toLowerCase() === "control") {
            const control = value.getValue().toLowerCase();
            if (["start", "stop", "pause", "resume", "finish"].includes(control)) {
                this.propagateControl(control);
            }
        }
    }

    /**
     * Container nodes do not interpolate their own fields, so this method is intentionally a no-op.
     */
    protected updateAnimation(fraction: number) {
        // No-op for ParallelAnimation base update
    }

    /**
     * Advances the container lifecycle by checking whether all child animations have stopped. When
     * configured to repeat, restarting the children happens automatically.
     */
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

    /**
     * Stops every child animation before invoking the base stop logic, matching Roku's behavior.
     */
    stop() {
        this.propagateControl("stop");
        super.stop();
    }

    /**
     * Sends the provided control string to all descendant animations.
     */
    private propagateControl(control: string) {
        for (const child of this.children) {
            if (child instanceof AnimationBase) {
                child.setValue("control", new BrsString(control));
            }
        }
    }
}
