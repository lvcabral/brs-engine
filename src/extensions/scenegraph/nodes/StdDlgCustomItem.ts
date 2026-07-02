import { AAMember, BrsType, Float, IfDraw2D, Interpreter } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { Label } from "./Label";
import { Node } from "./Node";
import { StdDlgItem } from "./StdDlgItemBase";

/**
 * A free-form content-area item that hosts app-authored children with a custom layout. The owning
 * StdDlgContentArea drives its width through the layout algorithm: `fixedWidthField` (if set) is the
 * requested width, and the resolved width is reported back via the read-only `widthField`. The
 * children keep their own translations/sizes (the app lays them out). Set `focusable` to true to let
 * it gain focus (e.g. when it embeds a custom keyboard).
 *
 * Maps Roku's StdDlgCustomItem (extends StdDlgItemBase → Group; we collapse the abstract base onto
 * Group, matching the other StdDlg* items). Group's default renderNode draws the children.
 */
export class StdDlgCustomItem extends Group implements StdDlgItem {
    readonly defaultFields: FieldModel[] = [
        // width/height are inherited from Group on a real device; register them here so apps can
        // observe `width` (the content area sets it) and read it to size custom columns.
        { name: "width", type: "float", value: "0.0" },
        { name: "height", type: "float", value: "0.0" },
        { name: "widthField", type: "float", value: "0.0" },
        { name: "fixedWidthField", type: "float", value: "0.0" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StdDlgCustomItem) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    /**
     * Measures the children's bounding height (union of translation + height; rotation/scale ignored).
     * Children laid out by a LayoutGroup only report a non-zero size after they have rendered once, so
     * the height can be 0 on the first pass and is corrected on the next frame (see renderNode).
     */
    private measureContentHeight(): number {
        let height = 0;
        for (const child of this.children) {
            if (!(child instanceof Group)) {
                continue;
            }
            const trans = (child.getValueJS("translation") as number[]) ?? [0, 0];
            let childHeight =
                child instanceof Label ? child.getMeasured().height : (child.getValueJS("height") as number);
            // Not `childHeight <= 0`: childHeight can be NaN (unmeasured child), which must also fall
            // back to bitmapHeight. `!(childHeight > 0)` is true for NaN, whereas `NaN <= 0` is false.
            if (!(childHeight > 0)) {
                childHeight = (child.getValueJS("bitmapHeight") as number) ?? 0;
            }
            height = Math.max(height, trans[1] + childHeight);
        }
        return height;
    }

    layoutItem(width: number): number {
        // Use the requested fixed width when provided, otherwise the content area's width.
        const fixedWidth = this.getValueJS("fixedWidthField") as number;
        const resolvedWidth = fixedWidth > 0 ? fixedWidth : width;
        const height = this.measureContentHeight();
        this.setValueSilent("widthField", new Float(resolvedWidth));
        // Set `width` non-silently so width observers fire (apps size custom columns from it).
        this.setValue("width", new Float(resolvedWidth));
        this.setValueSilent("height", new Float(height));
        return height;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        super.renderNode(interpreter, origin, angle, opacity, draw2D);
        // Children (e.g. a LayoutGroup) only know their size after rendering. If that changed the
        // content height from what layout assumed, ask the owning dialog to re-lay-out next frame so
        // the following areas (buttons) are positioned below this item rather than overlapping it.
        if (draw2D) {
            const measured = this.measureContentHeight();
            if (Math.abs(measured - ((this.getValueJS("height") as number) ?? 0)) > 1) {
                // Content size became known after rendering; ask the dialog to re-lay-out next frame
                // so the following areas (buttons) drop below this item rather than overlapping it.
                this.getOwningDialog()?.requestRelayout();
            }
        }
    }

    /** Walks up to the owning StandardDialog (duck-typed via requestRelayout). */
    private getOwningDialog(): { requestRelayout(): void } | undefined {
        let parent: BrsType = this.getNodeParent();
        while (parent instanceof Node) {
            const dialog = parent as unknown as { requestRelayout?: () => void };
            if (typeof dialog.requestRelayout === "function") {
                return dialog as { requestRelayout(): void };
            }
            parent = parent.getNodeParent();
        }
        return undefined;
    }
}
