import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { AAMember, Interpreter, BrsDevice, BrsString, Int32, IfDraw2D, Rect, RectRect } from "brs-engine";
import { ArrayGrid, FocusStyle, GridHoldDelayMs, GridStepMs, GridWrapRowStepMs } from "./ArrayGrid";
import { ContentNode } from "./ContentNode";
import { customNodeExists } from "../factory/NodeFactory";

/** The row geometry `MarkupGrid.renderGridRows` lays out. */
interface GridRowsLayout {
    firstRow: number;
    lastRow: number;
    moving: boolean;
    /** The grid's left edge, where every row starts. */
    left: number;
    startCol: number;
    rowWidth: number;
    itemSize: number[];
    spacing: number[];
    columnWidths: number[];
    columnSpacings: number[];
    rowHeights: number[];
    rowSpacings: number[];
    spanOf: (r: number) => number;
    screen: Rect;
}

export class MarkupGrid extends ArrayGrid {
    readonly defaultFields: FieldModel[] = [
        { name: "itemComponentName", type: "string", value: "" },
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
        this.setExtendsType(SGNodeType.MarkupGrid, SGNodeType.ArrayGrid);

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

    /** A grid lays its columns out from columnWidths/columnSpacings; per the reference, lists do not. */
    protected usesColumnWidths(): boolean {
        return true;
    }

    protected focusMotionEnabled(): boolean {
        return true;
    }

    protected motionStepMs(axis: "row" | "col"): number {
        return axis === "row" && this.wrap ? GridWrapRowStepMs : GridStepMs;
    }

    protected motionHoldDelayMs(): number {
        return GridHoldDelayMs;
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
        if (!this.itemComponentExists()) {
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
        const displayRows = Math.min(Math.ceil(this.content.length / this.numCols), this.numRows);
        const rowWidth = this.numCols * itemSize[0] + (this.numCols - 1) * spacing[0];
        // Culling bound for the loop below; the scene map does not change inside it.
        const screen = this.visibleSceneRect();
        // Start at the horizontal scroll window's left column (clamped in case numColumns
        // shrank at runtime) so the focused/visible columns lay out from the grid's left edge.
        const startCol = Math.min(this.scrollCol, Math.max(0, this.numCols - 1));
        // Focus in motion: the settled layout drawn `shift` rows lower, plus the rows scrolling in/out.
        const motion = this.listMotionFrame(displayRows);
        const motionRow = (r: number) => {
            const index = this.motionRowIndex(r);
            return index < 0 ? -1 : Math.floor(index / this.numCols);
        };
        const heightOf = (r: number) => {
            const row = motionRow(r);
            return row < 0 ? itemSize[1] : rowHeights[row] ?? itemSize[1];
        };
        const spanOf = (r: number) => {
            const row = motionRow(r);
            const gap = row < 0 ? spacing[1] : rowSpacings[row] ?? spacing[1];
            return heightOf(r) + gap + this.motionDividerSpace(r + 1, spacing[1]);
        };
        let firstRow = 0;
        let lastRow = displayRows;
        let motionFocus: Rect | undefined;
        const focusOnTop = this.focusFeedbackOnTop();
        if (motion) {
            const rows = this.motionRowLayout(motion, displayRows, spanOf, heightOf);
            firstRow = rows.firstRow;
            lastRow = rows.lastRow;
            itemRect.y = rect.y + rows.firstY;
            motionFocus = this.gridMotionFocusRect(
                rect,
                rect.y + rows.focusY,
                rows.focusHeight,
                motion.focusCol,
                startCol,
                (c) => columnWidths[c] ?? itemSize[0],
                (c) => columnSpacings[c] ?? spacing[0]
            );
            if (!focusOnTop) {
                this.renderMotionFocus(motionFocus, motion.visualIndex, opacity, draw2D);
            }
            this.pushMotionClip(rect, rows.viewportHeight, draw2D);
        }
        try {
            const layout: GridRowsLayout = {
                firstRow,
                lastRow,
                moving: motion !== undefined,
                left: rect.x,
                startCol,
                rowWidth,
                itemSize,
                spacing,
                columnWidths,
                columnSpacings,
                rowHeights,
                rowSpacings,
                spanOf,
                screen,
            };
            this.renderGridRows(interpreter, layout, itemRect, rotation, opacity, draw2D);
        } finally {
            if (motion) {
                draw2D?.popClip();
            }
        }
        if (motionFocus && motion && focusOnTop) {
            // Over every cell, as at rest (see focusFeedbackOnTop).
            this.renderMotionFocus(motionFocus, motion.visualIndex, opacity, draw2D);
        }
        this.updateRect(rect, displayRows, itemSize, {
            firstRow: Math.max(0, Math.floor(this.getRenderRowIndex(0) / this.numCols)),
        });
    }

    /** Whether `itemComponentName` names a component; logs the failure once when it doesn't. */
    private itemComponentExists(): boolean {
        const itemCompName = this.getValueJS("itemComponentName") as string;
        if (customNodeExists(itemCompName)) {
            return true;
        }
        if (!this.itemComponentErrorLogged) {
            const name = itemCompName.trim() || "missing 'itemComponentName'";
            BrsDevice.stderr.write(`error,[sg.markupgrid.create.fail] Failed to create item: ${name}`);
            this.itemComponentErrorLogged = true;
        }
        return false;
    }

    /** Draws viewport rows `firstRow`..`lastRow - 1`, advancing `itemRect` down the grid. */
    private renderGridRows(
        interpreter: Interpreter,
        layout: GridRowsLayout,
        itemRect: Rect,
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        const { firstRow, lastRow, moving, itemSize, spacing, columnWidths, columnSpacings, screen } = layout;
        const state = { lastIndex: -1, sectionIndex: 0 };
        for (let r = firstRow; r < lastRow; r++) {
            const rowIndex = moving ? this.motionRowIndex(r) : this.getRenderRowIndex(r);
            if (rowIndex < 0) {
                if (moving) {
                    itemRect.y += layout.spanOf(r);
                    continue;
                }
                break;
            }
            // Per-row overrides are indexed by ABSOLUTE row, top to bottom — not by the display slot,
            // which differs as soon as the grid is scrolled.
            const absoluteRow = Math.floor(rowIndex / this.numCols);
            itemRect.height = layout.rowHeights[absoluteRow] ?? itemSize[1];
            if (r > firstRow) {
                itemRect.y += this.renderRowDivider(rowIndex, layout, itemRect, state, opacity, draw2D);
            }
            for (let c = layout.startCol; c < this.numCols; c++) {
                itemRect.width = columnWidths[c] ?? itemSize[0];
                const index = rowIndex + c;
                if (index >= this.content.length) {
                    break;
                }
                this.renderItemComponent(interpreter, index, itemRect, rotation, opacity, draw2D);
                itemRect.x += itemRect.width + (columnSpacings[c] ?? spacing[0]);
                state.lastIndex = index;
                if (!moving && !RectRect(screen, itemRect)) {
                    break;
                }
            }
            itemRect.x = layout.left;
            itemRect.y += itemRect.height + (layout.rowSpacings[absoluteRow] ?? spacing[1]);
            if (!moving && !RectRect(screen, itemRect)) {
                break;
            }
        }
    }

    /**
     * Draws the wrap or section divider above a row when one goes there, and returns the height it takes
     * (0 when there is none).
     */
    private renderRowDivider(
        rowIndex: number,
        layout: GridRowsLayout,
        itemRect: Rect,
        state: { lastIndex: number; sectionIndex: number },
        opacity: number,
        draw2D?: IfDraw2D
    ): number {
        if (!this.wrap) {
            return 0;
        }
        const divRect = { ...itemRect, width: layout.rowWidth };
        const hasSections = this.metadata.length > 0;
        if (!hasSections && rowIndex < state.lastIndex) {
            return this.renderWrapDivider(divRect, opacity, draw2D) + layout.spacing[1];
        }
        if (hasSections && this.metadata[rowIndex]?.divider) {
            const divText = this.metadata[rowIndex].sectionTitle;
            const divHeight = this.renderSectionDivider(divText, divRect, opacity, state.sectionIndex, draw2D);
            state.sectionIndex++;
            return divHeight + layout.spacing[1];
        }
        return 0;
    }
}
