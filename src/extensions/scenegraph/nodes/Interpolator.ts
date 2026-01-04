import { AAMember, BrsType } from "brs-engine";
import { Node } from "./Node";
import { SGNodeType } from "../nodes";
import { FieldModel } from "../SGTypes";

/**
 * Base class for all `FieldInterpolator` nodes. It stores keyframe metadata shared by Roku's
 * interpolator family and offers helpers for segment lookup and fraction normalization so that
 * concrete interpolators only need to focus on value-specific math.
 */
export abstract class Interpolator extends Node {
    readonly defaultFields: FieldModel[] = [
        { name: "fieldToInterp", type: "string" },
        { name: "key", type: "floatarray", value: "[]" },
        { name: "fraction", type: "float", value: "0.0" },
        { name: "reverse", type: "boolean", value: "false" },
    ];

    /**
     * Registers common interpolator fields and applies any user-provided initial values.
     */
    constructor(members: AAMember[] = [], name: string = SGNodeType.Node) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Node);
        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(members);
    }

    /**
     * Calculates the value for the supplied fraction. Concrete subclasses handle the math for the
     * type they produce.
     */
    abstract interpolate(fraction: number): BrsType | undefined;

    /**
     * Given a normalized fraction, returns the surrounding keyframe indices and a local interpolation
     * parameter. This matches the behavior of Roku's Segment data structure.
     */
    protected resolveSegment(fraction: number): { index: number; localT: number } {
        const keys = this.getKeyframes();
        const normalized = this.normalizeFraction(fraction);

        if (keys.length < 2) {
            return { index: 0, localT: normalized };
        }

        if (normalized <= keys[0]) {
            return { index: 0, localT: 0 };
        }

        const lastIndex = keys.length - 1;
        if (normalized >= keys[lastIndex]) {
            return { index: lastIndex - 1, localT: 1 };
        }

        for (let i = 0; i < lastIndex; i++) {
            const start = keys[i];
            const end = keys[i + 1];
            if (normalized >= start && normalized <= end) {
                const span = end - start;
                const localT = span === 0 ? 0 : (normalized - start) / span;
                return { index: i, localT };
            }
        }

        return { index: lastIndex - 1, localT: 1 };
    }

    /**
     * Returns the keyframe array in numeric form; missing or invalid data yields an empty list.
     */
    protected getKeyframes(): number[] {
        const key = this.getValueJS("key");
        return Array.isArray(key) ? key : [];
    }

    /**
     * Clamps the fraction to 0-1 and optionally mirrors it when the `reverse` flag is set.
     */
    private normalizeFraction(fraction: number): number {
        const clamped = Math.min(Math.max(fraction, 0), 1);
        return this.getValueJS("reverse") ? 1 - clamped : clamped;
    }
}
