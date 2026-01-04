import { AAMember, Float, BrsType } from "brs-engine";
import { Interpolator } from "./Interpolator";
import { SGNodeType } from "../nodes";
import { FieldModel } from "../SGTypes";

/**
 * Performs piecewise-linear interpolation between numeric keyframes. This mirrors Roku's
 * `FloatFieldInterpolator`, emitting a `Float` value for each animation tick.
 */
export class FloatFieldInterpolator extends Interpolator {
    // Only key is inherited, adding keyValue
    readonly interpolationFields: FieldModel[] = [{ name: "keyValue", type: "floatarray", value: "[]" }];

    constructor(members: AAMember[] = [], name: string = SGNodeType.FloatFieldInterpolator) {
        super(members, name);
        this.registerDefaultFields(this.interpolationFields);
    }

    /**
     * Calculates the interpolated float for the provided fraction, falling back to the nearest keyframe
     * when only a single value exists.
     */
    interpolate(fraction: number): BrsType | undefined {
        const keyValues = this.getValueJS("keyValue") as number[];
        if (!Array.isArray(keyValues) || keyValues.length === 0) {
            return undefined;
        }

        if (keyValues.length === 1) {
            return new Float(keyValues[0]);
        }

        const { index, localT } = this.resolveSegment(fraction);
        const clampedIndex = Math.min(index, keyValues.length - 2);
        const startVal = keyValues[clampedIndex];
        const endVal = keyValues[Math.min(clampedIndex + 1, keyValues.length - 1)];

        const result = startVal + (endVal - startVal) * localT;
        return new Float(result);
    }
}
