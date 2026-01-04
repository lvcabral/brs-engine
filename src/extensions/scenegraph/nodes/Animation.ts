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

    constructor(members: AAMember[] = [], name: string = SGNodeType.Animation) {
        super(members, name);
        this.registerDefaultFields(this.animationFields);
        this.refreshWillBeSkipped();
    }

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

    protected handleControl(control: string) {
        if ((control === "start" || control === "resume") && this.computeSkipDecision()) {
            this.playSkippedAnimation();
            return;
        }
        super.handleControl(control);
    }

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

    protected shapeFraction(fraction: number): number {
        return this.applyEaseFunction(fraction, this.getEaseFunction());
    }

    protected getDurationSeconds(): number {
        const duration = this.getValueJS("duration");
        return typeof duration === "number" && duration > 0 ? duration : 0;
    }

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

    private clampPercent(value: unknown, fallback: number): number {
        if (typeof value !== "number" || Number.isNaN(value)) {
            return Math.min(Math.max(fallback, 0), 1);
        }
        return Math.min(Math.max(value, 0), 1);
    }

    private getEaseFunction(): string {
        const ease = this.getValueJS("easeFunction");
        return typeof ease === "string" && ease.length > 0 ? ease : "outCubic";
    }

    private refreshWillBeSkipped() {
        this.setWillBeSkippedFlag(this.computeSkipDecision(false));
    }

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

    private setWillBeSkippedFlag(value: boolean) {
        const field = this.fields.get("willbeskipped");
        if (field) {
            field.setValue(BrsBoolean.from(value));
            this.fields.set("willbeskipped", field);
        }
    }

    private playSkippedAnimation() {
        this._state = "running";
        this.updateStateField("running");
        this.updateAnimation(this.shapeFraction(1));
        this.stop();
    }

    private resolveTarget(child: Interpolator): TargetBinding | undefined {
        const descriptor = child.getValueJS("fieldToInterp");
        if (typeof descriptor !== "string" || descriptor.trim().length === 0) {
            this.targetCache.delete(child);
            return undefined;
        }

        const normalized = descriptor.trim();
        const cached = this.targetCache.get(child);
        if (cached && cached.signature === normalized.toLowerCase()) {
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
