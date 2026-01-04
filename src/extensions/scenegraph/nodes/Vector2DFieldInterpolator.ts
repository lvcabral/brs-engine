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
     * Generates an interpolated 2D point for the supplied fraction. Values are copied to new arrays so
     * calling code can mutate the result without affecting cached key data.
     */
    interpolate(fraction: number): BrsType | undefined {
        const keyValues = this.getValue("keyValue");
        if (!(keyValues instanceof RoArray) || keyValues.getElements().length === 0) {
            return undefined;
        }

        const elements = keyValues.getElements();
        if (elements.length === 1 && elements[0] instanceof RoArray) {
            return elements[0].deepCopy();
        }

        const { index, localT } = this.resolveSegment(fraction);
        const clampedIndex = Math.min(index, elements.length - 2);
        const startVec = elements[clampedIndex];
        const endVec = elements[Math.min(clampedIndex + 1, elements.length - 1)];

        if (startVec instanceof RoArray && endVec instanceof RoArray) {
            const startPoint = jsValueOf(startVec);
            const endPoint = jsValueOf(endVec);
            if (
                Array.isArray(startPoint) &&
                Array.isArray(endPoint) &&
                startPoint.length >= 2 &&
                endPoint.length >= 2
            ) {
                const currX = startPoint[0] + (endPoint[0] - startPoint[0]) * localT;
                const currY = startPoint[1] + (endPoint[1] - startPoint[1]) * localT;
                return new RoArray([new Float(currX), new Float(currY)]);
            }
        }
        return undefined;
    }
}
