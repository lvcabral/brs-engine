import { AAMember, Rect } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Node } from "./Node";

/**
 * TargetSet is a simple data container that defines a set of rectangular regions where the items of
 * a {@link TargetGroup} are rendered. It is a plain `Node` (never drawn itself) and is consumed by a
 * TargetGroup via its `targetSet`/`currTargetSet` fields.
 */
export class TargetSet extends Node {
    readonly defaultFields: FieldModel[] = [
        { name: "targetRects", type: "rect2darray", value: "[]" },
        { name: "focusIndex", type: "integer", value: "-1" },
        { name: "color", type: "color", value: "0xFFFFFF80" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.TargetSet) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Node);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    /**
     * Returns the target rectangles normalized to `{ x, y, width, height }`. The spec allows each
     * rectangle to be specified either as an associative array (`{ x, y, width, height }`) or as a
     * four-element numeric array (`[x, y, width, height]`); this hides that dual format from callers.
     */
    getTargetRects(): Rect[] {
        const rects = this.getValueJS("targetRects");
        if (!Array.isArray(rects)) {
            return [];
        }
        const result: Rect[] = [];
        for (const entry of rects) {
            const rect = normalizeRect(entry);
            if (rect) {
                result.push(rect);
            }
        }
        return result;
    }

    /** Returns the configured focus index, or -1 when unset (TargetGroup falls back to its default). */
    getFocusIndex(): number {
        const value = this.getValueJS("focusIndex");
        return typeof value === "number" ? value : -1;
    }

    /** Returns the debug rectangle color used when a TargetGroup's `showTargetRects` is enabled. */
    getColor(): number {
        const value = this.getValueJS("color");
        return typeof value === "number" ? value : 0xffffff80 | 0;
    }
}

function normalizeRect(entry: unknown): Rect | undefined {
    if (Array.isArray(entry) && entry.length >= 4) {
        return {
            x: Number(entry[0]) || 0,
            y: Number(entry[1]) || 0,
            width: Number(entry[2]) || 0,
            height: Number(entry[3]) || 0,
        };
    }
    if (entry && typeof entry === "object") {
        const aa = entry as Record<string, unknown>;
        return {
            x: Number(aa.x) || 0,
            y: Number(aa.y) || 0,
            width: Number(aa.width) || 0,
            height: Number(aa.height) || 0,
        };
    }
    return undefined;
}
