import { Rect } from "brs-engine";
import Long from "long";

/**
 * Checks if all properties of a Rect are finite numbers.
 * @param rect Rectangle to validate
 * @returns True if all rect properties are finite, false otherwise
 */
function isFiniteRect(rect: Rect) {
    return (
        Number.isFinite(rect.x) &&
        Number.isFinite(rect.y) &&
        Number.isFinite(rect.width) &&
        Number.isFinite(rect.height)
    );
}

/**
 * Determines if one rectangle is completely contained within another rectangle.
 * Both rectangles must have finite properties to be considered valid.
 * @param outer The rectangle that is expected to contain the other rectangle
 * @param inner The rectangle that is expected to be contained within the other rectangle
 * @returns "full" if inner is fully contained within outer, "partial" if inner is partially contained, or "none" if inner is not contained at all
 */
export function rectContainsRect(outer: Rect, inner: Rect) {
    if (!isFiniteRect(outer) || !isFiniteRect(inner)) {
        return "none";
    }
    if (
        inner.x >= outer.x &&
        inner.y >= outer.y &&
        inner.x + inner.width <= outer.x + outer.width &&
        inner.y + inner.height <= outer.y + outer.height
    ) {
        return "full";
    } else if (
        inner.x < outer.x + outer.width &&
        inner.x + inner.width > outer.x &&
        inner.y < outer.y + outer.height &&
        inner.y + inner.height > outer.y
    ) {
        return "partial";
    } else {
        return "none";
    }
}

/**
 * Calculates the bounding box of a rotated rectangle.
 * Rotates the rectangle around a specified center point.
 * @param rect Rectangle to rotate
 * @param rotation Rotation angle in radians
 * @param center Optional rotation center point [x, y] (defaults to top-left corner)
 * @returns New Rect representing the bounding box of the rotated rectangle
 */
export function rotateRect(rect: Rect, rotation: number, center?: number[]): Rect {
    // Default to top-left corner if centerX and centerY are not provided
    const rotationCenterX = center === undefined ? 0 : center[0];
    const rotationCenterY = center === undefined ? 0 : center[1];

    // Calculate the bounding box of the rotated rectangle
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);

    // Original corners of the rectangle
    const corners = [
        { x: -rotationCenterX, y: -rotationCenterY },
        { x: rect.width - rotationCenterX, y: -rotationCenterY },
        { x: rect.width - rotationCenterX, y: rect.height - rotationCenterY },
        { x: -rotationCenterX, y: rect.height - rotationCenterY },
    ];

    // Rotated corners
    const rotatedCorners = corners.map((corner) => ({
        x: corner.x * cos - corner.y * sin,
        y: corner.x * sin + corner.y * cos,
    }));

    // Find the bounding box
    const minX = Math.min(...rotatedCorners.map((corner) => corner.x));
    const maxX = Math.max(...rotatedCorners.map((corner) => corner.x));
    const minY = Math.min(...rotatedCorners.map((corner) => corner.y));
    const maxY = Math.max(...rotatedCorners.map((corner) => corner.y));

    return {
        x: rect.x + minX + rotationCenterX,
        y: rect.y + minY + rotationCenterY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

/**
 * Rotates a translation vector by a given angle.
 * @param translation Translation vector [x, y]
 * @param rotation Rotation angle in radians
 * @returns Rotated translation vector [x, y]
 */
export function rotateTranslation(translation: number[], rotation: number) {
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    return [translation[0] * cos - translation[1] * sin, translation[0] * sin + translation[1] * cos];
}

/**
 * Merges two bounding rectangles into a single bounding box.
 * Returns a copy of valid rect if the other is invalid.
 * @param rectChild Child rectangle to merge
 * @param rectParent Parent rectangle to merge
 * @returns New Rect representing the union of both rectangles
 */
export function unionRect(rectChild: Rect, rectParent: Rect) {
    if (!isFiniteRect(rectChild)) {
        return { ...rectParent };
    }
    if (!isFiniteRect(rectParent)) {
        return { ...rectChild };
    }
    const x = Math.min(rectChild.x, rectParent.x);
    const y = Math.min(rectChild.y, rectParent.y);
    const width = Math.max(rectChild.x + rectChild.width, rectParent.x + rectParent.width) - x;
    const height = Math.max(rectChild.y + rectChild.height, rectParent.y + rectParent.height) - y;
    return { x, y, width, height };
}

/**
 * Applies a node's scale factor to a measured extent (width or height), normalizing a mirrored
 * (negative) scale to a non-negative magnitude — callers that assume a non-negative extent
 * (`unionRect`'s `x + width` far-edge math, a `width > 0` gate) need this rather than the raw,
 * possibly-negative product.
 * @param extent The unscaled width or height.
 * @param scale The matching scale component (`scale[0]` for width, `scale[1]` for height).
 * @returns The scaled, non-negative extent.
 */
export function scaledExtent(extent: number, scale: number): number {
    return Math.abs(extent * scale);
}

/**
 * Converts a string representation of a number to a numeric value.
 * @param strNumber String representation of the number
 * @returns Numeric value of the string
 */
export function convertNumber(strNumber: string): number {
    let value = Number.NaN;
    strNumber = strNumber.trim();
    if (strNumber.length) {
        // Check if is Hexadecimal (prefix #, 0x or &h)
        if (strNumber.startsWith("#")) {
            value = Number.parseInt(strNumber.slice(1), 16);
        } else if (strNumber.toLowerCase().startsWith("0x") || strNumber.toLowerCase().startsWith("&h")) {
            value = Number.parseInt(strNumber.slice(2), 16);
        } else if (strNumber.includes(".")) {
            value = Number.parseFloat(strNumber);
        } else {
            value = Number.parseInt(strNumber);
        }
    }
    return value;
}

/**
 * Converts a string representation of a number to a Long value.
 * @param strNumber String representation of the number
 * @returns Long value or undefined if conversion fails
 */
export function convertLong(strNumber: string): Long | undefined {
    let valueLong: Long | undefined;
    strNumber = strNumber.trim();
    if (strNumber.length) {
        if (strNumber.startsWith("#")) {
            valueLong = Long.fromString(strNumber.slice(1), false, 16);
        } else if (strNumber.toLowerCase().startsWith("0x") || strNumber.toLowerCase().startsWith("&h")) {
            valueLong = Long.fromString(strNumber.slice(2), false, 16);
        } else {
            valueLong = Long.fromString(strNumber, false, 10);
            if (valueLong.isZero() && !strNumber.startsWith("0")) {
                valueLong = undefined;
            }
        }
    }
    return valueLong;
}

/**
 * Converts a hex color string to a number.
 * Handles various formats: #RRGGBB, 0xRRGGBB, &hRRGGBB.
 * Automatically adds FF alpha channel if not provided.
 * @param strColor Hex color string to convert
 * @returns Color as 32-bit integer (RRGGBBAA) or -1 if invalid
 */
export function convertHexColor(strColor: string): number {
    let color = -1;
    strColor = strColor.trim();
    if (strColor.length) {
        strColor = strColor.startsWith("#") ? strColor.slice(1) : strColor;
        strColor = strColor.toLowerCase().startsWith("0x") ? strColor.slice(2) : strColor;
        strColor = strColor.toLowerCase().startsWith("&h") ? strColor.slice(2) : strColor;
        strColor = strColor.padStart(6, "0");
        if (strColor.length === 6) {
            strColor = strColor + "FF";
        }
        color = Number.parseInt(strColor, 16);
        color = Number.isNaN(color) ? -1 : color | 0;
    }
    return color;
}

/**
 * Resolves a SceneGraph blend-color field to a tint, or `undefined` for "no color blending".
 *
 * The `0xFFFFFFFF` these fields default to means exactly that per the reference (arraygrid.md,
 * poster.md: "If set to the default, 0xFFFFFFFF, no color blending will occur"). Multiplying by white
 * is a mathematical identity, so skipping it is spec-correct AND avoids `RoBitmap.getRgbaCanvas`'s
 * canvas allocation and full-surface pass per (bitmap, color) pair.
 *
 * A color field is not a clean channel, so every spelling the value can arrive in has to be accepted:
 *   `undefined`        - field unset, or `getValueJS` on an absent field
 *   `-1`               - what `convertHexColor("0xFFFFFFFF")` stores, because of its `| 0`. This is
 *                        the spelling that actually reaches production; it doubles as that function's
 *                        parse-failure sentinel and as `NodeFactory`'s "no declared default", and all
 *                        three want the same answer here.
 *   `0xffffffff`       - an unsigned read (`>>> 0`) or a hand-written literal
 *   `NaN` / non-number - a non-numeric value assigned to a `type: "color"` field
 *
 * NOT treated as the default: `0x7fffffff`, which is what `new Int32(0xFFFFFFFF)` clamps to. It is also a
 * legitimate opaque light-cyan (R=0x7F, G=0xFF, B=0xFF, A=0xFF), and no engine path produces the clamp —
 * `convertHexColor` and `Int32.fromString("&hFFFFFFFF")` both yield `-1`, so only an app passing the
 * decimal literal `4294967295` could hit it. Swallowing a real color to catch that is the wrong trade.
 *
 * Applied in the extension rather than in `IfDraw2D` because "the default means no blending" is a
 * SceneGraph *field* rule, not an ifDraw2D one — the BrightScript Callables map `BrsInvalid` to
 * `undefined`, so core already has a clean two-state world and no sentinel to resolve. Note the saving is
 * now purely cost, not pixels: `getRgbaCanvas` short-circuits an all-white tint to a copy, so
 * `drawObject(x, y, bmp, -1)` and an untinted draw are byte-identical (verified at source alpha 1 and
 * 0.5). What normalizing avoids is a wasted `rgbaCanvas` allocation and a thrash of `RoBitmap`'s
 * single-slot tint cache, which is shared across every node drawing that bitmap.
 */
export function normalizeBlendColor(rgba: unknown): number | undefined {
    if (typeof rgba !== "number" || Number.isNaN(rgba)) {
        return undefined;
    }
    return rgba >>> 0 === 0xffffffff ? undefined : rgba;
}

/**
 * Maps an ifSGNodeBoundingRect sub-part id to a rendered item component in a row-based grid's
 * `rowItemComps[row][col]` store. Shared by RowList and ZoomRowList, which both hold a 2-D grid of
 * components (unlike the flat ArrayGrid `itemComps[]` the base resolver assumes), so
 * `subBoundingRect("item<row>_<col>")` can resolve the focused poster instead of the whole-list rect.
 *
 *   - `focusItem` / `focusIndicator` → the focused row's focused column.
 *   - `item<row>_<col>` → that exact cell (split on `_` before parsing — a plain `parseInt` drops the
 *     `_col`).
 *   - `item<row>` (no underscore) → the row's currently focused column, matching Roku's single-index
 *     addressing of a row-list row.
 *
 * Generic over the element type to avoid a Group/Node import here (SGUtil is dependency-free). Returns
 * undefined for an out-of-range or not-yet-rendered cell so the caller keeps its documented fallback.
 * @param itemNumber The sub-part identifier.
 * @param rowItemComps The grid's per-row component arrays.
 * @param focusIndex The focused row index.
 * @param rowFocus Per-row focused column indices.
 */
export function resolveRowItemSubpart<T>(
    itemNumber: string,
    rowItemComps: T[][],
    focusIndex: number,
    rowFocus: number[]
): T | undefined {
    const name = itemNumber.trim().toLowerCase();
    if (name === "focusitem" || name === "focusindicator") {
        return rowItemComps[focusIndex]?.[rowFocus[focusIndex] ?? 0];
    }
    if (!name.startsWith("item")) {
        return undefined;
    }
    const parts = name.slice(4).split("_");
    const row = Number.parseInt(parts[0], 10);
    if (!Number.isInteger(row)) {
        return undefined;
    }
    let col: number;
    if (parts.length > 1) {
        col = Number.parseInt(parts[1], 10);
        if (!Number.isInteger(col)) {
            return undefined;
        }
    } else {
        col = rowFocus[row] ?? 0;
    }
    return rowItemComps[row]?.[col];
}
