import { Rect } from "brs-engine";

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
 * Converts a hex color string to a number.
 * Handles various formats: #RRGGBB, 0xRRGGBB, RRGGBB.
 * Automatically adds FF alpha channel if not provided.
 * @param strColor Hex color string to convert
 * @returns Color as 32-bit integer (RRGGBBAA) or -1 if invalid
 */
export function convertHexColor(strColor: string): number {
    let color = -1;
    if (strColor.length) {
        strColor = strColor.startsWith("#") ? strColor.slice(1) : strColor;
        strColor = strColor.startsWith("0x") ? strColor.slice(2) : strColor;
        strColor = strColor.padStart(6, "0");
        if (strColor.length === 6) {
            strColor = strColor + "FF";
        }
        color = Number.parseInt(strColor, 16);
        color = Number.isNaN(color) ? -1 : color | 0;
    }
    return color;
}
