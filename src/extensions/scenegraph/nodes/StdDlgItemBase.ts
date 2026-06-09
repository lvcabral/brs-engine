import { BrsString, BrsType, RoAssociativeArray, isBrsString } from "brs-engine";
import { Node } from "./Node";
import { Group } from "./Group";
import { convertHexColor } from "../SGUtil";

/**
 * Shared base for the Standard Dialog Framework content items (StdDlgTextItem,
 * StdDlgBulletTextItem, StdDlgKeyboardItem, …). Maps to Roku's abstract `StdDlgItemBase`,
 * which extends `Group`; concrete items extend `Group` directly (matching the existing
 * `StdDlg*` files) and implement `layoutItem` so the owning content area can stack them.
 */
export interface StdDlgItem {
    /**
     * Positions/sizes the item for the given content width and returns its measured height.
     * Called by the content area during the dialog's layout pass.
     */
    layoutItem(width: number): number;
}

/** Type guard used by content areas to find items that participate in vertical layout. */
export function isStdDlgItem(node: BrsType): node is Group & StdDlgItem {
    return node instanceof Group && typeof (node as unknown as StdDlgItem).layoutItem === "function";
}

/**
 * Walks up the node tree to the owning dialog and returns its resolved palette colors. The
 * dialog (StandardDialog or a subclass) exposes `getPaletteColors()`; duck-typing avoids an
 * import cycle with StandardDialog.
 */
export function getDialogColors(node: Node): RoAssociativeArray {
    let parent: BrsType = node.getNodeParent();
    while (parent instanceof Node) {
        const resolver = (parent as unknown as { getPaletteColors?: () => RoAssociativeArray }).getPaletteColors;
        if (typeof resolver === "function") {
            return resolver.call(parent);
        }
        parent = parent.getNodeParent();
    }
    return new RoAssociativeArray([]);
}

/** Reads a palette color by name, falling back to the provided hex string when absent. */
export function colorFromPalette(colors: RoAssociativeArray, name: string, fallback: string): number {
    const color = colors.get(new BrsString(name));
    return convertHexColor(isBrsString(color) ? color.getValue() : fallback);
}
