import { AAMember, BrsType, Float, RoArray } from "brs-engine";
import { Interpolator } from "./Interpolator";
import { SGNodeType } from "../nodes";
import { FieldModel } from "../SGTypes";
import { jsValueOf } from "../factory/Serializer";

/**
 * Interpolates fields that hold arrays of floats, such as `Effect.borderRadius`. Each `keyValue` entry
 * is itself an array of floats; interpolation is performed piecewise, blending each entry independently
 * against its counterpart in the adjacent keyframe.
 */
export class FloatArrayFieldInterpolator extends Interpolator {
    // Only key is inherited, adding keyValue
    readonly interpolationFields: FieldModel[] = [{ name: "keyValue", type: "floatarray", value: "[]" }];

    constructor(members: AAMember[] = [], name: string = SGNodeType.FloatArrayFieldInterpolator) {
        super(members, name);
        this.registerDefaultFields(this.interpolationFields);
    }

    /**
     * Blends the two float arrays surrounding the current fraction, element by element. Keyframes with
     * mismatched array lengths are an error condition on real hardware, so the update is skipped.
     */
    interpolate(fraction: number): BrsType | undefined {
        const pair = this.resolveArrayKeyframePair(this.getValue("keyValue"), fraction);
        if (!pair) {
            return undefined;
        }
        if (pair instanceof RoArray) {
            return pair;
        }

        const { start, end, localT } = pair;
        const startValues = jsValueOf(start);
        const endValues = jsValueOf(end);
        if (
            !Array.isArray(startValues) ||
            !Array.isArray(endValues) ||
            startValues.length === 0 ||
            startValues.length !== endValues.length
        ) {
            return undefined;
        }

        const blended = startValues.map(
            (value: number, i: number) => new Float(value + (endValues[i] - value) * localT)
        );
        return new RoArray(blended);
    }
}
