export type BoundingRect = { x: number; y: number; width: number; height: number };

/* Function to calculate the bounding box of a rotated rectangle */
export function rotateRect(
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number,
    centerX?: number,
    centerY?: number
): BoundingRect {
    // Default to top-left corner if centerX and centerY are not provided
    const rotationCenterX = centerX !== undefined ? centerX : 0;
    const rotationCenterY = centerY !== undefined ? centerY : 0;

    // Calculate the bounding box of the rotated rectangle
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);

    // Original corners of the rectangle
    const corners = [
        { x: -rotationCenterX, y: -rotationCenterY },
        { x: width - rotationCenterX, y: -rotationCenterY },
        { x: width - rotationCenterX, y: height - rotationCenterY },
        { x: -rotationCenterX, y: height - rotationCenterY },
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
        x: x + minX + rotationCenterX,
        y: y + minY + rotationCenterY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

export function rotateTranslation(
    translation: number[],
    rotation: number,
    centerX: number = 0,
    centerY: number = 0
) {
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    return [
        translation[0] * cos - translation[1] * sin + centerX,
        translation[0] * sin + translation[1] * cos + centerY,
    ];
}

/* Function to merge two bounding rectangles */
export function unionRect(rectChild: BoundingRect, rectParent: BoundingRect) {
    const x = Math.min(rectChild.x, rectParent.x);
    const y = Math.min(rectChild.y, rectParent.y);
    const width = Math.max(rectChild.x + rectChild.width, rectParent.x + rectParent.width) - x;
    const height = Math.max(rectChild.y + rectChild.height, rectParent.y + rectParent.height) - y;
    return { x, y, width, height };
}
