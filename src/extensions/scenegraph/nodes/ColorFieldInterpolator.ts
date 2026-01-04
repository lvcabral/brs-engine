import { AAMember, Int32, BrsType } from "brs-engine";
import { Interpolator } from "./Interpolator";
import { SGNodeType } from "../nodes";
import { FieldModel } from "../SGTypes";

/**
 * Interpolates ARGB colors across HSV space to mimic Roku's hue-aware blending.
 * The node reads `key` (fractions) and `keyValue` (colorarray) to emit `Int32`
 * colors that downstream animations apply to their targets.
 */
export class ColorFieldInterpolator extends Interpolator {
    readonly interpolationFields: FieldModel[] = [{ name: "keyValue", type: "colorarray", value: "[]" }];

    constructor(members: AAMember[] = [], name: string = SGNodeType.ColorFieldInterpolator) {
        super(members, name);
        this.registerDefaultFields(this.interpolationFields);
    }

    /**
     * Produces an ARGB color for the provided fraction by blending between adjacent HSV keyframes.
     */
    interpolate(fraction: number): BrsType | undefined {
        const keyValues = this.getValueJS("keyValue") as number[];
        if (!Array.isArray(keyValues) || keyValues.length === 0) {
            return undefined;
        }

        if (keyValues.length === 1) {
            return new Int32(keyValues[0]);
        }

        const { index, localT } = this.resolveSegment(fraction);
        const clampedIndex = Math.min(index, keyValues.length - 2);
        const startColor = keyValues[clampedIndex];
        const endColor = keyValues[Math.min(clampedIndex + 1, keyValues.length - 1)];

        const rgba = this.interpolateColor(startColor, endColor, localT);
        return new Int32(rgba);
    }

    /**
     * Performs hue-aware interpolation between two packed ARGB colors. Hue wrapping is handled so the
     * shortest path is taken across the color wheel.
     */
    private interpolateColor(start: number, end: number, t: number): number {
        const startHsv = this.toHsv(start);
        const endHsv = this.toHsv(end);

        let startHue = startHsv.h;
        let endHue = endHsv.h;
        if (Math.abs(endHue - startHue) > 180) {
            if (endHue > startHue) {
                startHue += 360;
            } else {
                endHue += 360;
            }
        }

        const hue = (startHue + (endHue - startHue) * t + 360) % 360;
        const saturation = Math.min(Math.max(startHsv.s + (endHsv.s - startHsv.s) * t, 0), 1);
        const value = Math.min(Math.max(startHsv.v + (endHsv.v - startHsv.v) * t, 0), 1);
        const alpha = startHsv.a + (endHsv.a - startHsv.a) * t;

        return this.fromHsv(hue, saturation, value, alpha);
    }

    /**
     * Converts a packed ARGB integer into its HSV + alpha representation.
     */
    private toHsv(color: number): { h: number; s: number; v: number; a: number } {
        const r = ((color >> 24) & 0xff) / 255;
        const g = ((color >> 16) & 0xff) / 255;
        const b = ((color >> 8) & 0xff) / 255;
        const a = color & 0xff;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;

        let hue = 0;
        if (delta !== 0) {
            if (max === r) {
                hue = 60 * (((g - b) / delta) % 6);
            } else if (max === g) {
                hue = 60 * ((b - r) / delta + 2);
            } else {
                hue = 60 * ((r - g) / delta + 4);
            }
        }
        if (hue < 0) {
            hue += 360;
        }

        const saturation = max === 0 ? 0 : delta / max;
        return { h: hue, s: saturation, v: max, a };
    }

    /**
     * Converts HSV + alpha values back into a packed ARGB integer.
     */
    private fromHsv(h: number, s: number, v: number, alpha: number): number {
        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;
        let r = 0;
        let g = 0;
        let b = 0;

        if (h < 60) {
            r = c;
            g = x;
        } else if (h < 120) {
            r = x;
            g = c;
        } else if (h < 180) {
            g = c;
            b = x;
        } else if (h < 240) {
            g = x;
            b = c;
        } else if (h < 300) {
            r = x;
            b = c;
        } else {
            r = c;
            b = x;
        }

        const red = Math.round((r + m) * 255);
        const green = Math.round((g + m) * 255);
        const blue = Math.round((b + m) * 255);
        const alphaClamped = Math.round(Math.min(Math.max(alpha, 0), 255));

        return ((red & 0xff) << 24) | ((green & 0xff) << 16) | ((blue & 0xff) << 8) | (alphaClamped & 0xff);
    }
}
