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
     *
     * Each keyframe pairs `key[i]` (its position on the 0-1 progress axis) with `keyValue[i]` (the value
     * at that position) BY ARRAY INDEX, so the animation fraction is compared DIRECTLY against the key
     * positions — it is never remapped into the key domain. The `key` array is normally ascending, but
     * apps also express a reversed sequence with a descending array (e.g. `key="[1.0,0.0]"` with
     * `keyValue="[0,1]"` for a fade-out); handling each segment by its own direction supports both.
     */
    protected resolveSegment(fraction: number): { index: number; localT: number } {
        const keys = this.getKeyframes();
        const normalized = this.normalizeFraction(fraction);

        if (keys.length < 2) {
            return { index: 0, localT: normalized };
        }

        const lastIndex = keys.length - 1;

        // Find the segment [key[i], key[i+1]] whose position range contains `normalized`, honoring
        // whichever direction that segment runs.
        for (let i = 0; i < lastIndex; i++) {
            const start = keys[i];
            const end = keys[i + 1];
            const lo = Math.min(start, end);
            const hi = Math.max(start, end);
            if (normalized >= lo && normalized <= hi) {
                const span = end - start;
                const localT = span === 0 ? 0 : (normalized - start) / span;
                return { index: i, localT };
            }
        }

        // `normalized` falls outside every segment (a keyframe sequence that does not span the full
        // 0-1 axis): clamp to the value of the nearest keyframe by position, matching Roku's behavior
        // of holding the first/last keyValue beyond the first/last key percentage.
        const firstPos = keys[0];
        const lastPos = keys[lastIndex];
        if (Math.abs(normalized - firstPos) <= Math.abs(normalized - lastPos)) {
            return { index: 0, localT: 0 };
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
