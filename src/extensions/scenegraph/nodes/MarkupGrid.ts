import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { AAMember, Interpreter, BrsDevice, BrsString, Int32, IfDraw2D, Rect, RectRect } from "brs-engine";
import { ArrayGrid, FocusStyle } from "./ArrayGrid";
import { ContentNode } from "./ContentNode";
import { customNodeExists } from "../factory/NodeFactory";

export class MarkupGrid extends ArrayGrid {
    readonly defaultFields: FieldModel[] = [
        { name: "itemComponentName", type: "string", value: "" },
        { name: "drawFocusFeedbackOnTop", type: "boolean", value: "true" },
        { name: "vertFocusAnimationStyle", type: "string", value: FocusStyle.FixedFocusWrap },
        { name: "numRows", type: "integer", value: "12" },
        { name: "numColumns", type: "integer", value: "1" },
    ];
    protected readonly focusUri = "common:/images/focus_grid.9.png";
    protected readonly marginX: number;
    protected readonly marginY: number;
    protected readonly gap: number;
    // Leftmost rendered column — a single shared horizontal window: a grid scrolls all its rows
    // together on a device (unlike RowList, which keeps a per-row scroll offset).
    protected scrollCol = 0;
    private itemComponentErrorLogged = false;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.MarkupGrid) {
        super([], name);
        this.setExtendsType(name, SGNodeType.ArrayGrid);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (this.resolution === "FHD") {
            this.marginX = 15;
            this.marginY = 15;
        } else {
            this.marginX = 10;
            this.marginY = 10;
        }
        this.gap = 0;
        this.setValueSilent("focusBitmapUri", new BrsString(this.focusUri));
        this.setValueSilent("wrapDividerBitmapUri", new BrsString(this.dividerUri));
        this.applyVertFocusStyle();
        this.applyHorizFocusStyle();
        this.numRows = this.getValueJS("numRows") as number;
        this.numCols = this.getValueJS("numColumns") as number;
        this.hasNinePatch = true;
        this.focusField = "gridHasFocus";
    }

    /**
     * A real device reports a MarkupGrid's bounding rect as exactly the laid-out item extent
     * (rows/columns of itemSize plus spacing) with NO focus-bitmap outset: apps size sibling
     * backgrounds from boundingRect() and on device they align flush with the items. The
     * marginX/marginY outset still drives the drawn focus frame (focusMargins), just not the
     * reported rects.
     */
    protected rectMargins(): { x: number; y: number } {
        return { x: 0, y: 0 };
    }

    protected handleUpDown(key: string) {
        let handled = false;
        let offset: number;
        const numCols = this.numCols;
        if (key === "up") {
            offset = -1;
        } else if (key === "down") {
            offset = 1;
        } else if (key === "rewind") {
            offset = -Math.min(Math.ceil(this.content.length / numCols) - 1, 6);
        } else if (key === "fastforward") {
            offset = Math.min(Math.ceil(this.content.length / numCols) - 1, 6);
        } else {
            return false;
        }
        let nextIndex = this.focusIndex + offset * numCols;
        if (this.wrap) {
            const indexCol = this.focusIndex % numCols;
            nextIndex = this.getIndex(offset) + indexCol;
            if (this.metadata.length > 0) {
                let nextItem = this.content[nextIndex];
                while (nextItem instanceof ContentNode && nextItem.name === "_placeholder_") {
                    nextIndex = this.getIndex(offset, nextIndex) + indexCol;
                    nextItem = this.content[nextIndex];
                }
            }
        }
        // A wrap on a single content row resolves to the focused index itself: the move is a
        // no-op and must NOT report handled, so the key bubbles to an ancestor's onKeyEvent
        // (e.g. a screen moving focus from a one-row related-items grid back to a menu above).
        if (nextIndex >= 0 && nextIndex < this.content.length && nextIndex !== this.focusIndex) {
            const itemIndex = this.metadata[nextIndex]?.index ?? nextIndex;
            this.setValue("animateToItem", new Int32(itemIndex));
            handled = true;
            this.currRow += this.wrap ? 0 : offset;
        }
        return handled;
    }

    protected handlePageUpDown(key: string) {
        return this.handleUpDown(key);
    }

    /** Columns that fit fully on screen; falls back to numCols when the pitch is degenerate. */
    private maxVisibleColumns(): number {
        const itemSize = this.getValueJS("itemSize") as number[];
        const spacing = this.getValueJS("itemSpacing") as number[];
        const pitch = (itemSize?.[0] ?? 0) + (spacing?.[0] ?? 0);
        if (pitch <= 0) {
            return Math.max(1, this.numCols);
        }
        // Like RowList's floating-focus math, the viewport is the scene width. Limitation: a grid
        // translated right of x=0 (or with itemClippingRect) can overestimate by up to a column.
        return Math.max(1, Math.floor(this.sceneRect.width / pitch));
    }

    protected updateHorizScroll(index: number) {
        const numCols = Math.max(1, this.numCols || 1);
        const col = index % numCols;
        if (this.horizFocusAnimationStyleName === FocusStyle.FixedFocus.toLowerCase()) {
            // fixedFocus: the focused column is pinned at the grid's left edge.
            this.scrollCol = col;
            return;
        }
        // floatingFocus, and fixedFocusWrap — horizontal wrapping is not implemented yet (the
        // documented pair is fixedFocusWrap + focusColumn); it floats like a row with too few
        // items would on a device: minimal scroll keeping the focused column fully visible.
        const maxVisible = this.maxVisibleColumns();
        const maxScroll = Math.max(0, numCols - maxVisible);
        if (col < this.scrollCol) {
            this.scrollCol = col;
        } else if (col >= this.scrollCol + maxVisible) {
            this.scrollCol = col - maxVisible + 1;
        }
        this.scrollCol = Math.max(0, Math.min(this.scrollCol, maxScroll));
    }

    protected resetFocusForNewContent(freshContent: boolean) {
        if (freshContent) {
            // Covers the unfocused path where ArrayGrid resets the cursor silently without
            // routing through setFocusedItem/updateHorizScroll.
            this.scrollCol = 0;
        }
        super.resetFocusForNewContent(freshContent);
    }

    protected handleLeftRight(key: string) {
        const offset = key === "left" ? -1 : 1;
        const numCols = Math.max(1, this.numCols || 1);
        const nextIndex = this.focusIndex + offset;
        if (nextIndex < 0 || nextIndex >= this.content.length) {
            // Off either end: bubble to an ancestor's onKeyEvent (no horizontal wrap on device).
            return false;
        }
        if (Math.floor(nextIndex / numCols) !== Math.floor(this.focusIndex / numCols)) {
            // Left/right never changes rows.
            return false;
        }
        // Placeholder cells pad a section's ragged last row (ArrayGrid.processSection). Check the
        // content model instead of requiring this.itemComps[nextIndex] to exist — the old rendered-
        // component check also blocked navigation to any column not yet scrolled on screen.
        if (this.content[nextIndex]?.name === "_placeholder_") {
            return false;
        }
        const itemIndex = this.metadata[nextIndex]?.index ?? nextIndex;
        this.setValue("animateToItem", new Int32(itemIndex));
        return true;
    }

    protected renderContent(
        interpreter: Interpreter,
        rect: Rect,
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        if (this.content.length === 0) {
            return;
        } else if (this.focusIndex < 0) {
            this.focusIndex = 0;
        }
        const hasSections = this.metadata.length > 0;
        const itemCompName = this.getValueJS("itemComponentName") as string;
        if (!customNodeExists(itemCompName)) {
            if (!this.itemComponentErrorLogged) {
                const name = itemCompName.trim() || "missing 'itemComponentName'";
                BrsDevice.stderr.write(`error,[sg.markupgrid.create.fail] Failed to create item: ${name}`);
                this.itemComponentErrorLogged = true;
            }
            return;
        }
        const itemSize = this.getValueJS("itemSize") as number[];
        if (!itemSize?.[0] || !itemSize?.[1] || !this.numRows || !this.numCols) {
            return;
        }
        const itemRect = { ...rect, width: itemSize[0], height: itemSize[1] };
        const spacing = this.getValueJS("itemSpacing") as number[];
        const columnWidths = this.getValueJS("columnWidths") as number[];
        const columnSpacings = this.getValueJS("columnSpacings") as number[];
        const rowHeights = this.getValueJS("rowHeights") as number[];
        const rowSpacings = this.getValueJS("rowSpacings") as number[];
        this.currRow = this.updateCurrRow();
        let lastIndex = -1;
        const displayRows = Math.min(Math.ceil(this.content.length / this.numCols), this.numRows);
        let sectionIndex = 0;
        const rowWidth = this.numCols * itemSize[0] + (this.numCols - 1) * spacing[0];
        for (let r = 0; r < displayRows; r++) {
            const rowIndex = this.getRenderRowIndex(r);
            if (rowIndex < 0) {
                break;
            }
            itemRect.height = rowHeights[rowIndex / this.numCols] ?? itemSize[1];
            if (!hasSections && this.wrap && rowIndex < lastIndex && r > 0) {
                const divRect = { ...itemRect, width: rowWidth };
                const divHeight = this.renderWrapDivider(divRect, opacity, draw2D);
                itemRect.y += divHeight + spacing[1];
            } else if (hasSections && this.wrap && this.metadata[rowIndex]?.divider && r > 0) {
                const divRect = { ...itemRect, width: rowWidth };
                const divText = this.metadata[rowIndex].sectionTitle;
                const divHeight = this.renderSectionDivider(divText, divRect, opacity, sectionIndex, draw2D);
                sectionIndex++;
                itemRect.y += divHeight + spacing[1];
            }
            // Start at the horizontal scroll window's left column (clamped in case numColumns
            // shrank at runtime) so the focused/visible columns lay out from the grid's left edge.
            const startCol = Math.min(this.scrollCol, Math.max(0, this.numCols - 1));
            for (let c = startCol; c < this.numCols; c++) {
                itemRect.width = columnWidths[c] ?? itemSize[0];
                const index = rowIndex + c;
                if (index >= this.content.length) {
                    break;
                }
                this.renderItemComponent(interpreter, index, itemRect, rotation, opacity, draw2D);
                itemRect.x += itemRect.width + (columnSpacings[c] ?? spacing[0]);
                lastIndex = index;
                if (!RectRect(this.sceneRect, itemRect)) {
                    break;
                }
            }
            itemRect.x = rect.x;
            itemRect.y += itemRect.height + (rowSpacings[r] ?? spacing[1]);
            if (!RectRect(this.sceneRect, itemRect)) {
                break;
            }
        }
        this.updateRect(rect, displayRows, itemSize);
    }
}
