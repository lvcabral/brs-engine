import { AAMember, BrsBoolean, BrsDevice, BrsType, Float } from "brs-engine";
import { AnimationBase } from "./AnimationBase";
import { SGNodeType } from ".";
import { Interpolator } from "./Interpolator";
import { Node } from "./Node";
import { FieldKind, FieldModel } from "../SGTypes";
import { sgRoot } from "../SGRoot";

type TargetBinding = {
    node: Node;
    field: string;
    signature: string;
};

/**
 * SceneGraph implementation of Roku's `Animation` node. It orchestrates a set of child
 * interpolators, evaluates their values for the current eased fraction, and writes the
 * interpolated results into target fields. Targets are resolved relative to the nearest
 * non-animation ancestor so that identical IDs in separate components do not collide.
 * Optional animations are auto-skipped when the host advertises `skip_optional_animations`.
 */
export class Animation extends AnimationBase {
    private readonly targetCache = new WeakMap<Interpolator, TargetBinding>();

    private readonly animationFields: FieldModel[] = [
        { name: "duration", type: "float", value: "0" },
        { name: "easeFunction", type: "string", value: "outCubic" },
        { name: "easeInPercent", type: "float", value: "0.5" },
        { name: "easeOutPercent", type: "float", value: "0.5" },
        { name: "optional", type: "boolean", value: "false" },
        { name: "willBeSkipped", type: "boolean", value: "false", system: true },
    ];

    /**
     * Registers animation-specific default fields and evaluates whether the instance should be skipped
     * based on host-provided feature flags.
     */
    constructor(members: AAMember[] = [], name: string = SGNodeType.Animation) {
        super(members, name);
        this.registerDefaultFields(this.animationFields);
        this.refreshWillBeSkipped();
    }

    /**
     * Handles writes to animation fields, guarding the internal `willBeSkipped` flag and recomputing skip
     * decisions whenever the optional flag toggles.
     */
    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const key = index.toLowerCase();
        if (key === "willbeskipped") {
            return;
        }
        super.setValue(index, value, alwaysNotify, kind);
        if (key === "optional") {
            this.refreshWillBeSkipped();
        }
    }

    /**
     * Applies Roku's optional animation semantics: optional animations short-circuit when hosts request
     * skipping them, otherwise defer to the base class for the standard control lifecycle.
     */
    protected handleControl(control: string) {
        if ((control === "start" || control === "resume") && this.computeSkipDecision()) {
            this.playSkippedAnimation();
            return;
        }
        super.handleControl(control);
    }

    /**
     * Steps through child interpolators, asking each to calculate its value for the current fraction and
     * applying the result to the resolved target node field.
     */
    protected updateAnimation(fraction: number) {
        for (const child of this.children) {
            if (!(child instanceof Interpolator)) {
                continue;
            }

            child.setValue("fraction", new Float(fraction));
            const value = child.interpolate(fraction);
            if (!value) {
                continue;
            }

            const target = this.resolveTarget(child);
            if (!target) {
                continue;
            }

            target.node.setValue(target.field, value);
        }
    }

    /**
     * Shapes the raw animation fraction using Roku's supported ease functions.
     */
    protected shapeFraction(fraction: number): number {
        return this.applyEaseFunction(fraction, this.getEaseFunction());
    }

    /**
     * Returns the animation duration (in seconds) or 0 for instantaneous animations.
     */
    protected getDurationSeconds(): number {
        const duration = this.getValueJS("duration");
        return typeof duration === "number" && duration > 0 ? duration : 0;
    }

    /**
     * Maps a normalized fraction through the requested easing curve. All Roku-documented ease names are
     * supported, with piecewise easing delegated to `applyPiecewiseEase`.
     */
    private applyEaseFunction(t: number, ease: string): number {
        const clamped = Math.min(Math.max(t, 0), 1);
        switch (ease.toLowerCase()) {
            case "linear":
                return clamped;
            case "inquad":
                return clamped * clamped;
            case "outquad":
                return clamped * (2 - clamped);
            case "inoutquad":
                return clamped < 0.5 ? 2 * clamped * clamped : -1 + (4 - 2 * clamped) * clamped;
            case "incubic":
                return Math.pow(clamped, 3);
            case "outcubic":
                return Math.pow(clamped - 1, 3) + 1;
            case "inoutcubic":
                return clamped < 0.5 ? 4 * Math.pow(clamped, 3) : Math.pow(clamped - 1, 3) * 4 + 1;
            case "inquartic":
                return Math.pow(clamped, 4);
            case "outquartic":
                return 1 - Math.pow(clamped - 1, 4);
            case "inoutquartic":
                return clamped < 0.5 ? 8 * Math.pow(clamped, 4) : 1 - 8 * Math.pow(clamped - 1, 4);
            case "inquintic":
                return Math.pow(clamped, 5);
            case "outquintic":
                return 1 + Math.pow(clamped - 1, 5);
            case "inoutquintic":
                return clamped < 0.5 ? 16 * Math.pow(clamped, 5) : 1 + 16 * Math.pow(clamped - 1, 5);
            case "inexpo":
                return clamped === 0 ? 0 : Math.pow(2, 10 * (clamped - 1));
            case "outexpo":
                return clamped === 1 ? 1 : 1 - Math.pow(2, -10 * clamped);
            case "inoutexpo":
                if (clamped === 0 || clamped === 1) {
                    return clamped;
                }
                if (clamped < 0.5) {
                    return 0.5 * Math.pow(2, 20 * clamped - 10);
                }
                return 1 - 0.5 * Math.pow(2, -20 * clamped + 10);
            case "piecewise":
                return this.applyPiecewiseEase(clamped);
            default:
                return clamped;
        }
    }

    /**
     * Implements Roku's piecewise easing where the ease-in and ease-out percentages carve out quadratic
     * regions at the beginning and end of the animation curve.
     */
    private applyPiecewiseEase(t: number): number {
        const easeIn = this.clampPercent(this.getValueJS("easeInPercent"), 0.5);
        const easeOut = this.clampPercent(this.getValueJS("easeOutPercent"), 0.5);
        const cappedEaseOut = Math.min(easeOut, 1 - easeIn);
        const easeOutPortion = cappedEaseOut;
        const easeInPortion = Math.min(easeIn, 1 - easeOutPortion);
        const linearPortion = Math.max(0, 1 - easeInPortion - easeOutPortion);

        if (easeInPortion > 0 && t <= easeInPortion) {
            const local = t / easeInPortion;
            return easeInPortion * local * local;
        }

        if (easeOutPortion > 0 && t >= 1 - easeOutPortion) {
            const local = (t - (1 - easeOutPortion)) / easeOutPortion;
            const eased = 1 - Math.pow(1 - local, 2);
            return 1 - easeOutPortion + easeOutPortion * eased;
        }

        if (linearPortion > 0) {
            const local = (t - easeInPortion) / linearPortion;
            return easeInPortion + linearPortion * local;
        }

        return t;
    }

    /**
     * Normalizes percentage-style field values to the 0-1 range, falling back to Roku's documented defaults
     * whenever the value is missing or invalid.
     */
    private clampPercent(value: unknown, fallback: number): number {
        if (typeof value !== "number" || Number.isNaN(value)) {
            return Math.min(Math.max(fallback, 0), 1);
        }
        return Math.min(Math.max(value, 0), 1);
    }

    /**
     * Reads the requested easing name and falls back to `outCubic` when the field is unset or empty.
     */
    private getEaseFunction(): string {
        const ease = this.getValueJS("easeFunction");
        return typeof ease === "string" && ease.length > 0 ? ease : "outCubic";
    }

    /**
     * Updates the cached `willBeSkipped` field to reflect the current optional/feature-flag state.
     */
    private refreshWillBeSkipped() {
        this.setWillBeSkippedFlag(this.computeSkipDecision(false));
    }

    /**
     * Determines whether the animation should be skipped based on the optional flag and device features.
     * Optionally writes the derived value back into the `willBeSkipped` field.
     */
    private computeSkipDecision(recalculateField: boolean = true): boolean {
        const optional = Boolean(this.getValueJS("optional"));
        const features = BrsDevice.deviceInfo?.customFeatures;
        const skip =
            optional &&
            Array.isArray(features) &&
            features.some((feature) => feature.toLowerCase() === "skip_optional_animations");
        if (recalculateField) {
            this.setWillBeSkippedFlag(skip);
        }
        return skip;
    }

    /**
     * Writes the derived skip value into the internal `willBeSkipped` field so BrightScript observers can
     * react just like they would on-device.
     */
    private setWillBeSkippedFlag(value: boolean) {
        const field = this.fields.get("willbeskipped");
        if (field) {
            field.setValue(BrsBoolean.from(value));
            this.fields.set("willbeskipped", field);
        }
    }

    /**
     * Simulates Roku's behavior for skipped animations: briefly enter the running state, fast-forward to
     * the final eased fraction, and immediately stop.
     */
    private playSkippedAnimation() {
        this._state = "running";
        this.updateStateField("running");
        this.updateAnimation(this.shapeFraction(1));
        this.stop();
    }

    /**
     * Parses an interpolator's `fieldToInterp` descriptor and resolves a cached binding to a node and
     * field. Bindings are scoped to the closest non-animation ancestor to prevent cross-component clashes.
     */
    private resolveTarget(child: Interpolator): TargetBinding | undefined {
        const descriptor = child.getValueJS("fieldToInterp");
        if (typeof descriptor !== "string" || descriptor.trim().length === 0) {
            this.targetCache.delete(child);
            return undefined;
        }

        const normalized = descriptor.trim();
        const cached = this.targetCache.get(child);
        if (cached?.signature === normalized.toLowerCase()) {
            return cached;
        }

        let targetNode: Node | undefined;
        let fieldName = "";

        if (normalized.includes(".")) {
            const [nodeId, ...fieldParts] = normalized.split(".");
            fieldName = fieldParts.join(".").trim();
            targetNode = this.findTargetNode(nodeId.trim());
        } else {
            const parent = this.getNodeParent();
            targetNode = parent instanceof Node ? parent : this;
            fieldName = normalized;
        }

        if (!targetNode || !fieldName) {
            this.targetCache.delete(child);
            return undefined;
        }

        const binding: TargetBinding = {
            node: targetNode,
            field: fieldName,
            signature: normalized.toLowerCase(),
        };
        this.targetCache.set(child, binding);
        return binding;
    }

    /**
     * Helper that searches for a node ID starting at the animation's scoped root. Returns `undefined`
     * when the ID cannot be resolved within that subtree.
     */
    private findTargetNode(nodeId: string): Node | undefined {
        if (!nodeId) {
            return undefined;
        }
        const searchRoot = this.getSearchRoot();
        if (!searchRoot) {
            return undefined;
        }
        const found = this.findNodeById(searchRoot, nodeId);
        return found instanceof Node ? found : undefined;
    }

    /**
     * Walks up the parent chain until the traversal exits nested animation containers. The resulting node
     * becomes the scope root for resolving `findNodeById` lookups.
     */
    private getSearchRoot(): Node | undefined {
        let cursor: Node | undefined = this;

        while (cursor instanceof AnimationBase) {
            const parent = cursor.getNodeParent();
            if (!(parent instanceof Node)) {
                return cursor;
            }
            cursor = parent;
        }

        return cursor ?? (sgRoot.scene instanceof Node ? sgRoot.scene : undefined);
    }
}
