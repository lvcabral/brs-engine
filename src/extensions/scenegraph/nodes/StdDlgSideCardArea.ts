import { AAMember, Float } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { Node } from "./Node";

/**
 * A freeform decorative area placed on the left or right of a custom StandardDialog, beside the
 * vertical column of StdDlg*Area nodes. It holds arbitrary app-authored children (Poster, Label, …),
 * never gains key focus, and a dialog may contain only one. The owning StandardDialog reads this
 * node's fields to position it, size the dialog, and draw the optional divider; this node only
 * measures its own children so the dialog can lay it out.
 *
 * Maps Roku's StdDlgSideCardArea (extends StdDlgAreaBase → Group); like the other area nodes we
 * collapse the abstract base onto Group.
 */
export class StdDlgSideCardArea extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "extendToDialogEdge", type: "boolean", value: "true" },
        { name: "horizAlign", type: "string", value: "right" },
        { name: "showDivider", type: "boolean", value: "false" },
        { name: "width", type: "float", value: "0.0" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StdDlgSideCardArea) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    /**
     * Resolves the side card's size for the dialog's layout pass as the union of its children's
     * bounding rectangles (using each child's translation + width/height; rotation/scale ignored —
     * a pragmatic approximation). The width comes from the `width` field when set (> 0), otherwise
     * it defaults to the children's bounding width. Returns the resolved width/height and stores
     * them on this node.
     *
     * Note: the spec defaults the auto width (0) to the StdDlgContentArea's bounding width; because
     * our content items fill the available column width, that would be degenerate, so we use this
     * card's own children bounding width instead (which matches the visible examples).
     */
    layoutSideCard(): { width: number; height: number } {
        let contentWidth = 0;
        let height = 0;
        for (const child of this.children) {
            if (!(child instanceof Node)) {
                continue;
            }
            const trans = (child.getValueJS("translation") as number[]) ?? [0, 0];
            // Fall back to the loaded bitmap size for Posters that have no explicit width/height.
            let childWidth = (child.getValueJS("width") as number) ?? 0;
            let childHeight = (child.getValueJS("height") as number) ?? 0;
            if (childWidth <= 0) {
                childWidth = (child.getValueJS("bitmapWidth") as number) ?? 0;
            }
            if (childHeight <= 0) {
                childHeight = (child.getValueJS("bitmapHeight") as number) ?? 0;
            }
            contentWidth = Math.max(contentWidth, trans[0] + childWidth);
            height = Math.max(height, trans[1] + childHeight);
        }
        const fieldWidth = this.getValueJS("width") as number;
        const width = fieldWidth > 0 ? fieldWidth : contentWidth;
        this.setValueSilent("width", new Float(width));
        this.setValueSilent("height", new Float(height));
        return { width, height };
    }
}
