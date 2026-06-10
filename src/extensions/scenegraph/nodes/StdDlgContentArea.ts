import { AAMember, Float } from "brs-engine";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { isStdDlgItem } from "./StdDlgItemBase";

export class StdDlgContentArea extends Group {
    private readonly itemGap: number;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StdDlgContentArea) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerInitializedFields(initializedFields);
        this.itemGap = this.resolution === "FHD" ? 30 : 20;
    }

    /** Removes all current content items. */
    clearItems() {
        this.removeChildrenAtIndex(0, this.children.length);
    }

    /** Appends a content item. */
    addItem(item: Group) {
        this.appendChildToParent(item);
    }

    /**
     * Stacks the content items (StdDlgTextItem, StdDlgBulletTextItem, StdDlgKeyboardItem, …)
     * vertically for the given width and returns the total height. Items that don't participate in
     * layout keep their own translation/size (e.g. the centered StdDlgProgressItem).
     */
    layoutArea(width: number): number {
        let y = 0;
        let laidOut = 0;
        // Report the items' actual max width (not the available width) so the dialog can size to its
        // content — items that fill the width (text/bullet) report `width`, while compact items
        // (e.g. a spinner progress item) report their natural width and let the dialog shrink.
        let maxWidth = 0;
        for (const child of this.children) {
            if (isStdDlgItem(child)) {
                child.setTranslation([0, y]);
                y += child.layoutItem(width) + this.itemGap;
                maxWidth = Math.max(maxWidth, child.getDimensions().width);
                laidOut++;
            }
        }
        const height = laidOut > 0 ? y - this.itemGap : 0;
        this.setValueSilent("width", new Float(maxWidth));
        this.setValueSilent("height", new Float(height));
        return height;
    }
}
