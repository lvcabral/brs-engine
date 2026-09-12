import { AAMember, Float, BrsType, RoArray } from "brs-engine";
import { Interpolator } from "./Interpolator";
import { SGNodeType } from "../nodes";
import { FieldModel } from "../SGTypes";
import { jsValueOf } from "../factory/Serializer";

/**
 * Interpolates 2D vectors (stored as `RoArray` pairs) so animations can move nodes along a
 * path in SceneGraph space. Produces a new `RoArray` for each frame to avoid mutating inputs.
 */
export class Vector2DFieldInterpolator extends Interpolator {
    readonly interpolationFields: FieldModel[] = [{ name: "keyValue", type: "vector2darray", value: "[]" }];

    constructor(members: AAMember[] = [], name: string = SGNodeType.Vector2DFieldInterpolator) {
        super(members, name);
        this.registerDefaultFields(this.interpolationFields);
    }

    /**
     * Generates an interpolated 2D point for the supplied fraction. Interpolated points are freshly
     * built; the single-key shortcut returns the cached array itself, because the field write that
     * consumes it copies (`Node.setValue`) and this runs every frame per animated target.
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
        const startPoint = jsValueOf(start);
        const endPoint = jsValueOf(end);
        if (!Array.isArray(startPoint) || !Array.isArray(endPoint) || startPoint.length < 2 || endPoint.length < 2) {
            return undefined;
        }

        const currX = startPoint[0] + (endPoint[0] - startPoint[0]) * localT;
        const currY = startPoint[1] + (endPoint[1] - startPoint[1]) * localT;
        return new RoArray([new Float(currX), new Float(currY)]);
    }
}
