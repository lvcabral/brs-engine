import {
    AAMember,
    Interpreter,
    BrsBoolean,
    BrsDevice,
    BrsString,
    BrsType,
    Float,
    Int32,
    RoArray,
    IfDraw2D,
    Rect,
    RoFont,
} from "brs-engine";
import { sgRoot } from "../SGRoot";
import { ContentNode } from "./ContentNode";
import { brsValueOf, jsValueOf } from "../factory/Serializer";
import { Font } from "./Font";
import { Group } from "./Group";
import { Node } from "./Node";
import { Field } from "./Field";
import { ArrayGrid, FocusStyle } from "./ArrayGrid";
import { FieldKind, FieldModel } from "../SGTypes";
import { resolveRowItemSubpart } from "../SGUtil";
import { SGNodeType } from ".";

const ValidFocusStyles = new Set(Object.values(FocusStyle).map((style) => style.toLowerCase()));

const RowFocusStyle = {
    Wrap: FocusStyle.FixedFocusWrap.toLowerCase(),
    Floating: FocusStyle.FloatingFocus.toLowerCase(),
    Fixed: FocusStyle.FixedFocus.toLowerCase(),
} as const;

interface RowListRenderContext {
    itemSize: number[];
    globalSpacing: number[];
    rowHeights: number[];
    rowSpacings: number[];
    displayRows: number;
    rowItemWidth: number;
    rowItemHeight: number;
    showRowLabel: boolean;
    itemRect: Rect;
    interpreter: Interpreter;
    rect: Rect;
    rotation: number;
    opacity: number;
    draw2D?: IfDraw2D;
}

export class RowList extends ArrayGrid {
    readonly defaultFields: FieldModel[] = [
        { name: "itemComponentName", type: "string", value: "" },
        { name: "rowTitleComponentName", type: "string", value: "" },
        { name: "numRows", type: "integer", value: "1" },
        { name: "numColumns", type: "integer", value: "1" },
        { name: "rowItemSize", type: "vector2darray", value: "[]" },
        { name: "rowItemSpacing", type: "vector2darray", value: "[]" },
        { name: "rowItemSelected", type: "intarray", value: "[]" },
        { name: "rowItemFocused", type: "intarray", value: "[]" },
        { name: "jumpToRowItem", type: "intarray", value: "[]" },
        { name: "focusXOffset", type: "floatarray", value: "[0,0]" },
        { name: "rowLabelOffset", type: "vector2darray", value: "[[0,0]]" },
        { name: "rowLabelColor", type: "color", value: "0xffffffff" },
        { name: "rowLabelFont", type: "font" },
        { name: "showRowLabel", type: "boolarray", value: "[]" },
        { name: "rowCounterRightOffset", type: "float", value: "0" },
        { name: "showRowCounter", type: "boolarray", value: "[]" },
        { name: "showRowCounterForShortRows", type: "bool", value: "true" },
        { name: "indefiniteRowItemCount", type: "boolarray", value: "[]" },
        { name: "variableWidthItems", type: "boolarray", value: "[]" },
        { name: "rowFocusAnimationStyle", type: "string", value: FocusStyle.FloatingFocus },
        { name: "vertFocusAnimationStyle", type: "string", value: FocusStyle.FixedFocus },
    ];
    protected readonly focusUri = "common:/images/focus_grid.9.png";
    protected readonly footprintUri = "common:/images/focus_footprint.9.png";
    protected readonly marginX: number;
    protected readonly marginY: number;
    protected readonly gap: number;
    protected readonly rowItemComps: Group[][] = [[]];
    protected readonly rowFocus: number[];
    protected readonly rowScrollOffset: number[] = []; // Track scroll offset per row for floating focus
    // Identity of the content node last parsed by refreshContent. Used to reset per-row horizontal
    // focus/scroll only when a NEW content tree is assigned — a plain re-parse (triggered whenever a
    // descendant ContentNode is marked changed) must preserve each row's focused column/scroll.
    private parsedContentNode?: ContentNode;
    private readonly titleHeight: number;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.RowList) {
        super([], name);
        this.setExtendsType(name, SGNodeType.ArrayGrid);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (this.resolution === "FHD") {
            this.marginX = 33;
            // Vertical outset of THIS NODE's own reported rect (rectMargins -> ArrayGrid.updateRect).
            // A real device reports a RowList's boundingRect outset by only ~6px on the Y axis, where
            // the square 33 this used to hold was far too tall. It affects ONLY the reported rect, not
            // the drawn focus frame: the focus RING uses the focus 9-patch's own declared content
            // margins (ArrayGrid.focusMargins prefers them over this value).
            //
            // It does NOT reach an item subBoundingRect: Node.getSubBoundingRect re-expresses the item
            // rect against this node's rectToParent/rectToScene, both of which now carry the outset
            // identically, so it cancels. See resolveSubpart below — that cancellation is the whole
            // reason the footprint outset that used to live here was wrong.
            this.marginY = 6;
        } else {
            this.marginX = 22;
            this.marginY = 4;
        }
        this.gap = 0;
        this.setValueSilent("focusBitmapUri", new BrsString(this.focusUri));
        this.setValueSilent("focusFootprintBitmapUri", new BrsString(this.footprintUri));
        this.setValueSilent("wrapDividerBitmapUri", new BrsString(this.dividerUri));
        // Re-derive the cached vertical focus style AFTER registerDefaultFields has installed RowList's
        // own default (fixedFocus). ArrayGrid's constructor already ran applyVertFocusStyle(), but at
        // that point the field still held ArrayGrid's floatingFocus default, and registerDefaultFields
        // bypasses setValue — so the cache said "floatingfocus" while the field read "fixedFocus".
        // renderContent branches on isFixedFocusMode(), so the two must agree.
        this.applyVertFocusStyle();
        this.numRows = this.getValueJS("numRows") as number;
        this.numCols = this.getValueJS("numColumns") as number;
        this.rowFocus = [];
        this.rowScrollOffset = []; // Initialize scroll offset tracking
        this.hasNinePatch = true;
        this.focusField = "rowListHasFocus";
        const font = this.getValue("rowLabelFont") as Font;
        const drawFont = font.createDrawFont();
        this.titleHeight = drawFont instanceof RoFont ? drawFont.measureTextHeight() : 0;

        // Initialize focus properly
        this.focusIndex = 0;
        this.rowFocus[0] = 0;
        this.rowScrollOffset[0] = 0;
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "rowfocusanimationstyle") {
            const style = value.toString().toLowerCase();
            if (!ValidFocusStyles.has(style)) {
                // Invalid rowFocusAnimationStyle
                return;
            }
        } else if (fieldName === "jumptorowitem" && value instanceof RoArray) {
            const rowItem = jsValueOf(value) as any[];
            if (typeof rowItem[0] === "number" && typeof rowItem[1] === "number") {
                this.setFocusedItem(rowItem[0], rowItem[1]);
            }
        } else if (["horizfocusanimationstyle", "numcolumns"].includes(fieldName)) {
            // Invalid fields for RowList
            return;
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    protected setFocusedItem(rowIndex: number, colIndex: number = -1) {
        if (rowIndex < 0 || rowIndex >= this.content.length) {
            return;
        }
        if (colIndex === -1) {
            colIndex = this.rowFocus[rowIndex] ?? 0;
        }
        const oldRow = this.focusIndex;
        const isChangingRow = oldRow !== rowIndex;
        // itemFocused/rowItemFocused only change when a row gains the key focus on a real device
        // (verified on hardware). When the list is not in the focus chain — e.g. an app writes
        // jumpToRowItem or assigns content while focus is elsewhere — update the cursor/scroll state
        // but do NOT notify observers; setNodeFocus re-emits on focus-gain. See ArrayGrid.setFocusedItem.
        const inFocusChain = sgRoot.focused === this || this.isChildrenFocused();

        if (inFocusChain) {
            // Emit the scroll pulse before ANY of the settled focus fields go out — itemUnfocused
            // below included, so the order matches ArrayGrid.setFocusedItem. See armScrollPulse for
            // why the pulse precedes the settle, and why it is skipped entirely when the list is
            // outside the focus chain (that path notifies nothing).
            this.emitScrollPulse();
        }

        if (isChangingRow && inFocusChain) {
            // Engine-initiated emission (not a direct BrightScript assignment): on Roku its
            // observers dispatch from the message loop, so a reentrant notification defers
            // (see Field.enterInternalUpdate).
            Field.enterInternalUpdate();
            try {
                super.setValue("itemUnfocused", new Int32(oldRow));
            } finally {
                Field.exitInternalUpdate();
            }
        }

        this.focusIndex = rowIndex;
        this.rowFocus[rowIndex] = colIndex;

        // Get the row focus animation style to determine scrolling behavior
        const rowFocusStyle = (this.getValueJS("rowFocusAnimationStyle") as string).toLowerCase();

        // Initialize scroll offset if not set - ensure it starts at 0 for first visit
        const isFirstVisit = this.rowScrollOffset[rowIndex] === undefined || this.rowScrollOffset[rowIndex] === null;
        if (isFirstVisit) {
            this.rowScrollOffset[rowIndex] = 0;
        }

        const spacing = this.getRowItemSpacing(rowIndex); // Use the actual row's spacing
        const rowItemWidth = this.getRowItemWidth(rowIndex);
        const cols = this.getContentChildren(this.content[rowIndex]);
        const allItemsFitOnScreen = this.allItemsFitOnScreen(rowIndex, cols);

        // Adjust scroll offset based on animation style
        if (allItemsFitOnScreen && rowFocusStyle !== RowFocusStyle.Fixed) {
            // All items fit, no scrolling needed - always use floating focus behavior
            this.rowScrollOffset[rowIndex] = 0;
        } else if (rowFocusStyle === RowFocusStyle.Wrap) {
            // For fixedFocusWrap, no scroll offset (focus wraps around)
            this.rowScrollOffset[rowIndex] = 0;
        } else if (rowFocusStyle === RowFocusStyle.Fixed) {
            // For fixedFocus, focus always stays at first visible position (left edge)
            // Scroll offset equals focused column so focus appears at position 0
            this.rowScrollOffset[rowIndex] = colIndex;
        } else if (rowFocusStyle === RowFocusStyle.Floating) {
            // floatingFocus: ensure focused item is fully visible
            // Calculate max items that fit completely on screen (use floor, not ceil)
            const maxVisibleItems = Math.floor(this.sceneRect.width / (rowItemWidth + spacing[0]));

            if (isChangingRow && isFirstVisit) {
                // First time visiting this row - calculate initial scroll position
                if (colIndex === 0) {
                    // Explicitly focusing first item - start from beginning
                    this.rowScrollOffset[rowIndex] = 0;
                } else if (colIndex < maxVisibleItems) {
                    // Focused item fits in the "floating" visible area - no scroll needed
                    this.rowScrollOffset[rowIndex] = 0;
                } else {
                    // Focused item is beyond floating area - scroll to show it fully at right edge
                    this.rowScrollOffset[rowIndex] = Math.max(0, colIndex - maxVisibleItems + 1);
                }
            } else if (isChangingRow) {
                // Keep scroll offset unchanged - row maintains its scroll state
            } else if (colIndex < this.rowScrollOffset[rowIndex]) {
                // Focused item is before visible area, scroll left to show it fully
                this.rowScrollOffset[rowIndex] = colIndex;
            } else if (colIndex >= this.rowScrollOffset[rowIndex] + maxVisibleItems) {
                // Focused item is after visible area, scroll right to show it fully at the right edge
                this.rowScrollOffset[rowIndex] = colIndex - maxVisibleItems + 1;
            }
        }

        if (inFocusChain) {
            // Engine-initiated emission: reentrant observers defer (see Field.enterInternalUpdate).
            Field.enterInternalUpdate();
            try {
                // currFocusRow/currFocusColumn must already reflect the new position before
                // itemFocused fires: apps commonly read them synchronously from an itemFocused
                // observer (e.g. collapsing a header when the focused row leaves index 0). The
                // values are re-applied (as a same-value no-op) by setRowItemFocused below, which
                // still settles rowItemFocused last — see its own ordering comment.
                super.setValue("currFocusRow", new Float(rowIndex));
                super.setValue("currFocusColumn", new Float(colIndex));
                super.setValue("itemFocused", new Int32(rowIndex));
            } finally {
                Field.exitInternalUpdate();
            }
            this.setRowItemFocused(rowIndex, colIndex);
        } else {
            // Unfocused: remember the row/column silently (no observer notification). The values are
            // re-emitted by setNodeFocus when focus lands on the list.
            this.focusLayoutDirty = true;
            this.setValueSilent("itemFocused", new Int32(rowIndex));
            this.setValueSilent("currFocusRow", new Float(rowIndex));
            this.setValueSilent("currFocusColumn", new Float(colIndex));
            this.setValueSilent("rowItemFocused", new RoArray([new Int32(rowIndex), new Int32(colIndex)]));
        }
    }

    /**
     * Records the focused [row, column] and mirrors it into the inherited ArrayGrid
     * currFocusRow/currFocusColumn fields. Roku keeps those two fields in sync with the focus
     * position as the grid scrolls (see arraygrid.md); apps observe/alias them to track which
     * row and column is focused. Without this mirror they stay pinned at their 0.0 default, so an
     * app driving a focused-item overlay from currFocusRow/currFocusColumn never leaves item [0,0].
     */
    protected setRowItemFocused(rowIndex: number, colIndex: number) {
        // The focus/scroll position is about to change, so the item components' cached rects no
        // longer match it (the newly focused row/column has not been re-laid-out yet). Mark layout
        // dirty BEFORE firing the focus fields below: an app's rowItemFocused observer measures the
        // focused item synchronously via subBoundingRect, and the dirty flag makes that query refresh
        // layout first so it reports the settled focus-band position (see needsSubBoundingRectRefresh).
        this.focusLayoutDirty = true;
        // Emit the scroll pulse BEFORE the settled focus fields go out — the falling edge precedes
        // the settle on a device and apps rely on that order (see ArrayGrid.armScrollPulse). The
        // horizontal handlers reach this method directly, without setFocusedItem, so the pulse has to
        // be emitted here too; it is idempotent per key press, so the vertical path (which already
        // pulsed) does not double-emit. Outside the internal-update bracket below on purpose: these
        // notifications must dispatch synchronously rather than defer past the settle.
        this.emitScrollPulse();
        // Engine-initiated emissions: reentrant observers defer (see Field.enterInternalUpdate).
        Field.enterInternalUpdate();
        try {
            // Emit currFocusRow/currFocusColumn BEFORE rowItemFocused. On a real device the focus fields
            // pass through in-transit (fractional) values during the scroll animation and rowItemFocused
            // settles last, so apps treat the rowItemFocused observer as the authoritative "focus settled"
            // callback (e.g. the one that positions a per-row overlay on the final row). Since our scroll is
            // instant, honoring that ordering — the settle notification fires last — keeps such an app from
            // being stranded in its transient state (an observer on currFocusRow that computes an in-transit
            // row from the scroll direction would otherwise run last and win). Regression: RowList.test.js.
            super.setValue("currFocusRow", new Float(rowIndex));
            super.setValue("currFocusColumn", new Float(colIndex));
            super.setValue("rowItemFocused", new RoArray([new Int32(rowIndex), new Int32(colIndex)]));
        } finally {
            Field.exitInternalUpdate();
        }
    }

    protected handleUpDown(key: string) {
        let handled = false;
        let offset: number;
        if (key === "up") {
            offset = -1;
        } else if (key === "down") {
            offset = 1;
        } else if (key === "rewind") {
            offset = -Math.min(Math.ceil(this.content.length / this.numCols) - 1, 6);
        } else if (key === "fastforward") {
            offset = Math.min(Math.ceil(this.content.length / this.numCols) - 1, 6);
        } else {
            return false;
        }
        let nextRow = this.focusIndex + offset;
        if (this.wrap) {
            nextRow = nextRow % this.content.length;
            if (nextRow < 0) {
                nextRow += this.content.length;
            }
        }
        if (nextRow >= 0 && nextRow < this.content.length && nextRow !== this.focusIndex) {
            const rowFocusStyle = (this.getValueJS("rowFocusAnimationStyle") as string).toLowerCase();
            const currentRow = this.focusIndex;
            const currentCol = this.rowFocus[currentRow] ?? 0;
            const currentScrollOffset = this.rowScrollOffset[currentRow] ?? 0;

            // Calculate the visible screen position (0-based position on screen) from current row
            const visiblePosition = currentCol - currentScrollOffset;

            let targetColIndex: number;

            // In floatingFocus mode, move to the same visual screen position
            if (rowFocusStyle === RowFocusStyle.Floating) {
                // Maintain the visual screen position across rows
                // Each row keeps its scroll offset, we just calculate which column
                // corresponds to the same visual position in the next row
                const nextScrollOffset = this.rowScrollOffset[nextRow] ?? 0;
                targetColIndex = nextScrollOffset + visiblePosition;

                // Clamp to valid range for the target row
                const nextRowCols = this.content[nextRow]?.getNodeChildren();
                const nextRowColCount = nextRowCols?.length ?? 0;

                if (nextRowColCount > 0) {
                    // Clamp to valid column range
                    targetColIndex = Math.max(0, Math.min(targetColIndex, nextRowColCount - 1));
                }
            } else {
                // For other modes, use the previously focused column in that row
                targetColIndex = this.rowFocus[nextRow] ?? 0;
            }

            const rowItem = new RoArray([new Int32(nextRow), new Int32(targetColIndex)]);
            // Publish the vertical scroll direction BEFORE the focus change so observers of the focus
            // fields see the correct direction, then reset it to "none" after (mirroring a real device,
            // where the direction is transient and settles back to none once scrolling completes).
            super.setValue("vertFocusDirection", new BrsString(offset > 0 ? "down" : "up"));
            this.setValue("jumpToRowItem", rowItem);
            super.setValue("vertFocusDirection", new BrsString("none"));
            handled = true;
        }
        return handled;
    }

    protected handlePageUpDown(key: string) {
        return this.handleUpDown(key);
    }

    protected handleLeftRight(key: string) {
        const offset = key === "left" ? -1 : 1;
        const currentRow = this.focusIndex;
        const cols = this.getContentChildren(this.content[currentRow]);
        const numCols = cols.length;

        // No row under the cursor (content not assigned yet, or an empty content tree), or a single
        // column: nothing to move to, so the key is unhandled and bubbles to the parent.
        if (numCols <= 1) {
            return false;
        }

        this.rowScrollOffset[currentRow] ??= 0;

        const rowItemWidth = this.getRowItemWidth(currentRow);
        const allItemsFitOnScreen = this.allItemsFitOnScreen(currentRow, cols);
        const rowFocusStyle = (this.getValueJS("rowFocusAnimationStyle") as string).toLowerCase();

        if (allItemsFitOnScreen && rowFocusStyle !== RowFocusStyle.Fixed) {
            return this.handleAllItemsFit(currentRow, numCols, offset);
        } else if (rowFocusStyle === RowFocusStyle.Wrap) {
            return this.handleFixedFocusWrap(currentRow, numCols, offset);
        } else if (rowFocusStyle === RowFocusStyle.Fixed) {
            return this.handleFixedFocus(currentRow, numCols, offset);
        } else {
            return this.handleFloatingFocus(currentRow, numCols, rowItemWidth, offset);
        }
    }

    protected handleOK(press: boolean) {
        // Bound by the content view, not by `rowFocus` — the latter is seeded with row 0 in the
        // constructor, so an empty list would otherwise report row 0 as selected and consume the key.
        // With no content there is no item to select, so the key stays unhandled (device behavior).
        if (press && this.focusIndex >= 0 && this.focusIndex < this.content.length) {
            const currentRow = this.focusIndex;
            const currentCol = this.rowFocus[currentRow];
            if (currentCol >= 0) {
                this.setValue("rowItemSelected", brsValueOf([currentRow, currentCol]));
                this.setValue("itemSelected", new Int32(currentRow));
                return true;
            }
        }
        return false;
    }

    /**
     * Resolves an ifSGNodeBoundingRect sub part to the matching rendered item component. A RowList
     * holds a 2-D grid of components in `rowItemComps[row][col]` (not the flat ArrayGrid `itemComps[]`,
     * which stays empty here), so the base resolver never matches and every query falls back to the
     * whole-list rect. On a real device `subBoundingRect("item<row>_<col>")` returns the focused
     * poster's rect, which apps use to place a focused-item overlay; without this override the overlay
     * cannot track the row's item layout. See `resolveRowItemSubpart` for the id mapping.
     *
     * Resolution is ALL this node contributes: there is intentionally no `getSubBoundingRect` override.
     * `Node.getSubBoundingRect` re-expresses the resolved item component's own rect, and a device reports
     * exactly that — the bare poster — for both the focused and the unfocused cells. Three separate
     * outsets are easy to conflate here, so keep them apart:
     *
     *  - the DRAWN focus frame is outset (`ArrayGrid.renderFocus` -> `focusMargins`, the 9-patch's own
     *    declared content margins). That is paint only; nothing reports it.
     *  - THIS NODE's own reported rect is outset (`rectMargins` -> `ArrayGrid.updateRect`, `marginX`/
     *    `marginY`). It does not reach an item sub-rect: `Node.getSubBoundingRect` computes
     *    `base.y + (subScene.y - this.rectToScene.y)`, and `base` (`rectToParent`/`rectLocal`) and
     *    `rectToScene` carry that outset identically, so it cancels.
     *  - an ITEM sub-rect is outset by nothing at all.
     *
     * Do NOT re-add a focus-footprint outset here. One was added once (subtracting the 9-patch top
     * margin from the focused cell) to make an overlay land on the poster; it was double-counting from
     * the day it landed, silently cancelled by a `rectToParent` bug that dropped the `rectMargins`
     * outset from `base` and left a `+marginY` residue in the expression above. Fixing that bug — so
     * the outset cancels as it should — surfaced the double subtraction as an overlay drawn one focus
     * margin too HIGH. If a focused-item overlay looks misplaced, the paint path or the app's own
     * offset is the suspect, not this rect.
     */
    protected resolveSubpart(itemNumber: string): Node | undefined {
        return resolveRowItemSubpart(itemNumber, this.rowItemComps, this.focusIndex, this.rowFocus);
    }

    private getRowItemSize(rowIndex: number): number[] {
        const itemSize = this.getValueJS("itemSize") as number[];
        // Per Roku docs, rowItemSize is indexed by absolute row; rows beyond the array reuse the
        // last entry, and an empty array falls back to itemSize.
        return this.resolveVector(this.getValueJS("rowItemSize"), rowIndex, itemSize);
    }

    private getRowItemWidth(rowIndex: number): number {
        return this.getRowItemSize(rowIndex)[0];
    }

    /**
     * Width of a single item. Uniform rows use the row's `rowItemSize.x`; a row flagged in
     * `variableWidthItems` instead takes each item's width from the `[SD/HD/FHD]ItemWidth` field of
     * its ContentNode (the resolution matching the manifest `ui_resolutions`), falling back to the
     * row's `rowItemSize.x` when an item does not specify one — per the RowList reference.
     * @param rowIndex Absolute row index.
     * @param colIndex Column (item) index within the row.
     * @param cols The row's content children.
     * @param rowItemWidth The row's uniform width (fallback and non-variable result).
     */
    private getItemWidth(rowIndex: number, colIndex: number, cols: ContentNode[], rowItemWidth: number): number {
        if (!this.resolveBoolean(this.getValueJS("variableWidthItems"), rowIndex, false)) {
            return rowItemWidth;
        }
        const itemWidth = cols[colIndex]?.getValueJS(`${sgRoot.resolution}ItemWidth`);
        return typeof itemWidth === "number" && itemWidth > 0 ? itemWidth : rowItemWidth;
    }

    private getRowItemSpacing(rowIndex: number): number[] {
        let fallback = [0, 0];
        const itemSpacing = this.getValueJS("itemSpacing") as number[];
        if (itemSpacing?.length === 2) {
            fallback = itemSpacing;
        }
        return this.resolveVector(this.getValueJS("rowItemSpacing"), rowIndex, fallback);
    }

    /**
     * Total laid-out width of a row's items plus inter-item spacing. For variable-width rows this sums
     * each item's actual width (`getItemWidth`, which resolves the item's `[res]ItemWidth`) instead of
     * `numCols * rowItemSize.x` — an app can set `rowItemSize.x` to the whole row/bar width (e.g. SGDEX
     * ButtonBar) while the individual buttons are far narrower, so the uniform estimate hugely
     * overshoots and makes the list think its items don't fit. Reduces to the uniform formula for
     * non-variable rows.
     */
    private getTotalRowWidth(rowIndex: number, cols: ContentNode[]): number {
        const numCols = cols.length;
        if (numCols === 0) {
            return 0;
        }
        const spacing = this.getRowItemSpacing(rowIndex);
        const rowItemWidth = this.getRowItemWidth(rowIndex);
        let total = (numCols - 1) * spacing[0];
        for (let c = 0; c < numCols; c++) {
            total += this.getItemWidth(rowIndex, c, cols, rowItemWidth);
        }
        return total;
    }

    private allItemsFitOnScreen(rowIndex: number, cols: ContentNode[]): boolean {
        return this.getTotalRowWidth(rowIndex, cols) <= this.sceneRect.width;
    }

    private handleAllItemsFit(currentRow: number, numCols: number, offset: number): boolean {
        let nextCol = this.rowFocus[currentRow] + offset;
        nextCol = Math.max(0, Math.min(nextCol, numCols - 1));

        if (nextCol !== this.rowFocus[currentRow]) {
            this.rowFocus[currentRow] = nextCol;
            this.setRowItemFocused(currentRow, nextCol);
            return true;
        }
        return false;
    }

    private handleFixedFocusWrap(currentRow: number, numCols: number, offset: number): boolean {
        let nextCol = this.rowFocus[currentRow] + offset;

        if (nextCol < 0) {
            nextCol = numCols - 1;
        } else if (nextCol >= numCols) {
            nextCol = 0;
        }

        this.rowFocus[currentRow] = nextCol;
        this.setRowItemFocused(currentRow, nextCol);
        return true;
    }

    private handleFixedFocus(currentRow: number, numCols: number, offset: number): boolean {
        let nextCol = this.rowFocus[currentRow] + offset;
        nextCol = Math.max(0, Math.min(nextCol, numCols - 1));

        if (nextCol !== this.rowFocus[currentRow]) {
            this.rowFocus[currentRow] = nextCol;
            this.rowScrollOffset[currentRow] = nextCol;
            this.setRowItemFocused(currentRow, nextCol);
            return true;
        }
        return false;
    }

    private handleFloatingFocus(currentRow: number, numCols: number, rowItemWidth: number, offset: number): boolean {
        // currentRow is the absolute focused row index
        const spacing = this.getRowItemSpacing(currentRow);
        const maxVisibleItems = Math.floor(this.sceneRect.width / (rowItemWidth + spacing[0]));
        const currentFocusedCol = this.rowFocus[currentRow];
        const currentScrollOffset = this.rowScrollOffset[currentRow];
        const focusScreenPosition = currentFocusedCol - currentScrollOffset;

        let handled = false;

        if (offset > 0) {
            handled = this.handleFloatingFocusRight(
                currentRow,
                numCols,
                maxVisibleItems,
                currentFocusedCol,
                currentScrollOffset,
                focusScreenPosition
            );
        } else if (currentFocusedCol > 0) {
            handled = this.handleFloatingFocusLeft(
                currentRow,
                currentFocusedCol,
                currentScrollOffset,
                focusScreenPosition
            );
        }

        if (handled) {
            this.setRowItemFocused(currentRow, this.rowFocus[currentRow]);
        }
        return handled;
    }

    private handleFloatingFocusRight(
        currentRow: number,
        numCols: number,
        maxVisibleItems: number,
        currentFocusedCol: number,
        currentScrollOffset: number,
        focusScreenPosition: number
    ): boolean {
        if (currentFocusedCol >= numCols - 1) {
            return false;
        }

        const rightEdgeThreshold = Math.max(0, maxVisibleItems - 1);

        if (focusScreenPosition < rightEdgeThreshold) {
            this.rowFocus[currentRow] = currentFocusedCol + 1;
        } else if (currentScrollOffset + maxVisibleItems < numCols) {
            this.rowScrollOffset[currentRow] = currentScrollOffset + 1;
            this.rowFocus[currentRow] = currentFocusedCol + 1;
        } else {
            this.rowFocus[currentRow] = numCols - 1;
        }
        return true;
    }

    private handleFloatingFocusLeft(
        currentRow: number,
        currentFocusedCol: number,
        currentScrollOffset: number,
        focusScreenPosition: number
    ): boolean {
        if (focusScreenPosition > 0) {
            this.rowFocus[currentRow] = currentFocusedCol - 1;
        } else if (currentScrollOffset > 0) {
            this.rowScrollOffset[currentRow] = currentScrollOffset - 1;
            this.rowFocus[currentRow] = currentFocusedCol - 1;
        } else {
            this.rowFocus[currentRow] = 0;
        }
        return true;
    }

    protected renderContent(
        interpreter: Interpreter,
        rect: Rect,
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        if (!this.validateRenderPrerequisites()) {
            return;
        }
        const context = this.initializeRenderContext(rect, interpreter, rotation, opacity, draw2D);
        // `currRow` is the ABSOLUTE index of the first row drawn (see calculateActualRowIndex), so it
        // is what decides how far the list has scrolled internally. Per Roku, fixedFocus/fixedFocusWrap
        // pin the focused row at the list top and scroll the rows above it off screen; floatingFocus
        // instead keeps rows at fixed positions and only scrolls "if there are rows that were not
        // visible" — i.e. never once numRows covers the whole content. Applying the fixedFocus rule to
        // every style made a floatingFocus list scroll a full row pitch per Up/Down even when all its
        // rows fit, which compounds with any translation an app applies to the node itself.
        if (this.isFixedFocusMode()) {
            this.currRow = this.focusIndex;
        } else {
            this.updateListCurrRow(); // maintains this.topRow, the first visible row of the window
            this.currRow = this.topRow;
        }

        // Rows advance by their own height plus, when the label/counter band does not fit in the row's
        // slack, that band's height (see renderSingleRow). No arithmetic in updateRect can reproduce
        // that without re-measuring the label, so accumulate the extent the loop actually laid out and
        // hand it over. `itemRect.y` ends one rowSpacing past the last row, which is dropped below.
        const startY = context.itemRect.y;
        let renderedRows = 0;
        let trailingSpacing = 0;
        for (let r = 0; r < context.displayRows; r++) {
            const rowIndex = this.calculateActualRowIndex(r);
            if (rowIndex === -1) {
                break;
            }
            const fits = this.renderSingleRow(rowIndex, r, context);
            renderedRows++;
            trailingSpacing = this.calculateRowSpacing(rowIndex, context.rowSpacings, context.globalSpacing);
            if (!fits) {
                break;
            }
        }
        const margin = this.rectMargins();
        const height = renderedRows === 0 ? 0 : context.itemRect.y - startY - trailingSpacing + margin.y * 2;
        this.updateRect(rect, context.displayRows, context.itemSize, { height, firstRow: this.currRow });
    }

    private validateRenderPrerequisites(): boolean {
        if (this.content.length === 0) {
            return false;
        }
        if (this.focusIndex < 0) {
            this.focusIndex = 0;
        }
        const itemSize = this.getValueJS("itemSize") as number[];
        if (!itemSize[0] || !itemSize[1] || !this.numRows) {
            return false;
        }
        return true;
    }

    private initializeRenderContext(
        rect: Rect,
        interpreter: Interpreter,
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ): RowListRenderContext {
        const itemSize = this.getValueJS("itemSize") as number[];
        const globalSpacing = this.getValueJS("itemSpacing") as number[];
        const rowHeights = this.getValueJS("rowHeights") as number[];
        const rowSpacings = this.getValueJS("rowSpacings") as number[];
        const displayRows = Math.min(this.content.length, this.numRows);

        return {
            itemSize,
            globalSpacing,
            rowHeights,
            rowSpacings,
            displayRows,
            rowItemWidth: itemSize[0],
            rowItemHeight: itemSize[1],
            showRowLabel: true,
            itemRect: { ...rect, width: itemSize[0], height: itemSize[1] },
            interpreter,
            rect,
            rotation,
            opacity,
            draw2D,
        };
    }

    private renderSingleRow(rowIndex: number, displayRowIndex: number, context: RowListRenderContext): boolean {
        const row = this.content[rowIndex];
        const cols = this.getContentChildren(row);
        const numCols = cols.length;

        // Update row dimensions. Per Roku docs the per-row arrays are indexed by the absolute
        // row index in `content`; rows beyond rowItemSize reuse its last entry (not itemSize,
        // and not the previous row's leftover value).
        const rowItemSize = this.getRowItemSize(rowIndex);
        context.rowItemWidth = rowItemSize[0];
        context.rowItemHeight = rowItemSize[1];

        const spacing = this.getRowItemSpacing(rowIndex);
        const rowWidth = numCols * context.rowItemWidth + (numCols - 1) * spacing[0];

        // Per Roku, `itemSize`/`rowHeights` size the entire ROW; `rowItemSize` sizes the individual
        // poster. The item rect carries the poster dimensions (drives the item component's width/height
        // and the focus 9-patch); the row's own height only advances the next row down. `rowHeights`
        // falls back to `itemSize.y` for rows beyond the array (NOT the poster height) — using the
        // poster height would leave no room above it and make short rows (e.g. a grid row) overlap.
        context.itemRect.width = context.rowItemWidth;
        context.itemRect.height = context.rowItemHeight;
        const rowHeight = context.rowHeights[rowIndex] ?? context.itemSize[1] ?? context.rowItemHeight;

        // Render wrap divider if needed
        if (this.wrap && rowIndex === 0 && displayRowIndex > 0) {
            context.itemRect.y = context.itemRect.y - spacing[1];
            const divRect = { ...context.itemRect, width: rowWidth };
            const divHeight = this.renderWrapDivider(divRect, context.opacity, context.draw2D);
            context.itemRect.y += divHeight + spacing[1];
        }

        // The row label (left) and the "N of M" counter (right) sit in a band at the TOP of the row,
        // and the poster items are pushed down below it. When the band fits within the row's natural
        // slack (rowHeight - posterHeight), the row keeps its height (hero/standard rows). When it does
        // NOT fit — a dense grid row whose rowHeight falls back to itemSize.y — the row is grown by the
        // band height (see the advance below) so the pushed-down poster still never spills into the next
        // row, while the label/counter stay at the row top with the row's normal spacing above them.
        const title = row.getValueJS("title") ?? "";
        const rowTopY = context.itemRect.y;
        const showLabel = this.resolveBoolean(this.getValueJS("showRowLabel"), rowIndex, false);
        const showCounter = this.resolveBoolean(this.getValueJS("showRowCounter"), rowIndex, false);
        context.showRowLabel = showLabel;
        const labelOffset = this.resolveVector(this.getValueJS("rowLabelOffset"), rowIndex, [0, 0]);
        const hasLabel = showLabel && title.length !== 0;
        const bandHeight = hasLabel || showCounter ? this.titleHeight + (labelOffset[1] ?? 0) : 0;
        const bandFits = bandHeight <= Math.max(0, rowHeight - context.rowItemHeight);
        if (hasLabel) {
            const divRect = { ...context.itemRect, y: rowTopY, width: rowWidth };
            this.renderRowDivider(title, divRect, context.opacity, rowIndex, context.draw2D);
        }
        context.itemRect.y = rowTopY + bandHeight;

        // Apply horizontal offset and render items
        const xOffset = this.getRowXOffset(rowIndex);
        context.itemRect.x = context.rect.x + xOffset;

        // Clip the row items to the list's own horizontal bounds (x .. x + itemSize.width) ONLY when the
        // row content is wider than the row — otherwise everything already fits and no clip is needed.
        // When clipping, matching a real device: a poster that extends past the row's right edge is cut
        // off there (aligned with the row counter) instead of bleeding over the screen, and a wrapped
        // partial item on the left is cut at the list's left edge. The bounds are widened by the focus
        // feedback margin so the focused item's indicator (which outsets the poster) is not clipped. The
        // label and counter are drawn outside this clip.
        const clip = xOffset + rowWidth > context.itemSize[0];
        if (clip) {
            const focusMargin = this.getValueJS("drawFocusFeedback") ? this.marginX : 0;
            context.draw2D?.pushClip({
                x: context.rect.x - focusMargin,
                y: this.sceneRect.y,
                width: context.itemSize[0] + focusMargin * 2,
                height: this.sceneRect.height,
            });
        }
        try {
            // Row items are app components: an error escaping their BrightScript must not strand the
            // row clip on the canvas for the rest of the frame.
            this.renderRowContent(rowIndex, cols, context.rowItemWidth, spacing, context.itemRect, context);
        } finally {
            if (clip) {
                context.draw2D?.popClip();
            }
        }

        // Render the "N of M" row counter in the label band at the row top, AFTER the items.
        this.renderRowCounter(rowIndex, numCols, rowTopY, context);

        // Prepare for next row: advance by the ROW height (not the poster height) from the row top,
        // grown by the band height when the band did not fit in the row's slack so a labeled short row
        // (e.g. the first "The Grid" row) does not overlap the next.
        context.itemRect.x = context.rect.x;
        const rowSpacing = this.calculateRowSpacing(rowIndex, context.rowSpacings, context.globalSpacing);
        context.itemRect.y = rowTopY + rowHeight + (bandFits ? 0 : bandHeight) + rowSpacing;

        // Stop only once the next row starts BELOW the viewport — everything after it is off screen.
        // A row entirely ABOVE the viewport must not end the pass: this used to test the next row for
        // intersection with the scene, which was safe only while rendering always began at the focused
        // (on-screen) row. With floatingFocus the pass begins at the window's top row, so an app that
        // scrolls by translating the list itself can park earlier rows off the top — and a full row of
        // clearance up there would abort the pass before reaching the focused row, blanking it and
        // every row below it.
        return context.itemRect.y < this.sceneRect.y + this.sceneRect.height;
    }

    private getRowXOffset(rowIndex: number): number {
        const focusXOffset = this.getValueJS("focusXOffset") as number[];
        if (!focusXOffset || focusXOffset.length === 0) {
            return 0;
        }

        // Per Roku docs, focusXOffset is indexed by absolute row; extra rows reuse the last value.
        const index = Math.min(rowIndex, focusXOffset.length - 1);
        return focusXOffset[index] ?? 0;
    }

    private renderRowContent(
        rowIndex: number,
        cols: ContentNode[],
        rowItemWidth: number,
        spacing: number[],
        itemRect: Rect,
        context: RowListRenderContext
    ): void {
        const allItemsFitOnScreen = this.allItemsFitOnScreen(rowIndex, cols);
        const rowFocusStyle = (this.getValueJS("rowFocusAnimationStyle") as string).toLowerCase();

        this.rowScrollOffset[rowIndex] ??= 0;

        const renderMode = this.determineRenderMode(allItemsFitOnScreen, rowFocusStyle);

        this.renderRowItems(rowIndex, cols, itemRect, spacing, rowItemWidth, renderMode, context);
    }

    private calculateRowSpacing(rowIndex: number, rowSpacings: number[], globalSpacing: number[]): number {
        // Per Roku, the vertical gap between rows is rowSpacings[row], falling back to itemSpacing.y
        // (globalSpacing[1]) for rows beyond the array — and defaults to 0. The full row height
        // (rowHeights / itemSize.y) already accounts for each row's visual extent, so no implicit
        // spacing is added on top of it.
        return rowSpacings[rowIndex] ?? globalSpacing[1] ?? 0;
    }

    private calculateActualRowIndex(displayRowIndex: number): number {
        let rowIndex = this.currRow + displayRowIndex;
        if (this.wrap) {
            if (rowIndex >= this.content.length) {
                rowIndex = rowIndex % this.content.length;
            }
            if (rowIndex < 0) {
                rowIndex += this.content.length;
            }
        } else if (rowIndex >= this.content.length || rowIndex < 0) {
            return -1;
        }
        return rowIndex;
    }

    private determineRenderMode(allItemsFitOnScreen: boolean, rowFocusStyle: string): string {
        if (allItemsFitOnScreen && rowFocusStyle !== RowFocusStyle.Fixed) {
            return "allItemsFit";
        } else if (rowFocusStyle === RowFocusStyle.Wrap) {
            return "wrapMode";
        } else {
            return "scrollMode";
        }
    }

    private renderRowItems(
        rowIndex: number,
        cols: ContentNode[],
        itemRect: Rect,
        spacing: number[],
        rowItemWidth: number,
        renderMode: string,
        context: RowListRenderContext
    ): void {
        const numCols = cols.length;

        // Calculate startCol based on render mode
        let startCol: number;
        if (renderMode === "allItemsFit") {
            startCol = 0;
        } else if (renderMode === "wrapMode") {
            startCol = this.rowFocus[rowIndex] ?? 0;
        } else {
            startCol = this.rowScrollOffset[rowIndex] ?? 0;
        }

        // With variable-width items the uniform maxVisibleItems estimate can undercount how many
        // narrower items fit, cutting off the tail of the row; render through the last column and let
        // the right-edge break below stop the loop once an item lands off-screen.
        const variableWidth = this.resolveBoolean(this.getValueJS("variableWidthItems"), rowIndex, false);
        const maxVisibleItems = Math.ceil((this.sceneRect.width + spacing[0]) / (rowItemWidth + spacing[0]));
        const endCol =
            renderMode === "wrapMode" || variableWidth ? numCols : Math.min(startCol + maxVisibleItems, numCols);

        // In wrap mode the focused item sits at the fixed focus offset; the row wraps in BOTH
        // directions, so the tail end of the preceding (wrapped) item is partially visible in the
        // margin to the LEFT of the focused item — matching a real device's fixedFocusWrap. This only
        // happens when the focus offset leaves room to the left of the focused item: the preceding item
        // is clipped to the LIST's own left edge (context.rect.x), not the scene's. With the default
        // focusXOffset of 0 the focused item sits at the list's left edge, so no preceding item shows.
        if (renderMode === "wrapMode") {
            const pitch = rowItemWidth + spacing[0];
            let leftX = itemRect.x - pitch;
            for (let k = 1; pitch > 0 && k <= numCols && leftX + rowItemWidth > context.rect.x; k++) {
                const colIndex = (((startCol - k) % numCols) + numCols) % numCols;
                this.renderRowItemComponent(
                    context.interpreter,
                    rowIndex,
                    colIndex,
                    cols,
                    { ...itemRect, x: leftX },
                    context.rotation,
                    context.opacity,
                    context.draw2D
                );
                leftX -= pitch;
            }
        }

        for (let c = 0; c < (renderMode === "wrapMode" ? numCols : endCol - startCol); c++) {
            let colIndex = startCol + c;

            if (renderMode === "wrapMode" && colIndex >= numCols) {
                colIndex = colIndex % numCols;
            }

            if (colIndex >= cols.length) {
                break;
            }

            // Size the slot to this specific item (a no-op for uniform rows) so the item component is
            // sized correctly and the next item advances by this item's own width — otherwise variable
            // items are positioned on a uniform pitch and overlap (or leave gaps).
            itemRect.width = this.getItemWidth(rowIndex, colIndex, cols, rowItemWidth);
            this.renderRowItemComponent(
                context.interpreter,
                rowIndex,
                colIndex,
                cols,
                itemRect,
                context.rotation,
                context.opacity,
                context.draw2D
            );
            itemRect.x += itemRect.width + spacing[0];

            if (itemRect.x > this.sceneRect.x + this.sceneRect.width) {
                break;
            }
        }
    }

    private itemCompFailureLogged = false;

    /** Writes a single error (not one per slot/frame) when item components cannot be created. */
    private logItemCompFailure() {
        if (this.itemCompFailureLogged) {
            return;
        }
        this.itemCompFailureLogged = true;
        const itemCompName = this.getValueJS("itemComponentName") ?? "";
        BrsDevice.stderr.write(
            `error,[sg.rowlist.create.fail] Failed to create item component: ${
                itemCompName || "missing 'itemComponentName'"
            }`
        );
    }

    protected renderRowItemComponent(
        interpreter: Interpreter,
        rowIndex: number,
        colIndex: number,
        cols: ContentNode[],
        itemRect: Rect,
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        const content = cols[colIndex];
        const nodeFocus = sgRoot.focused === this;

        // Sum the row's actual (possibly variable) item widths to decide whether it all fits.
        const allItemsFitOnScreen = this.allItemsFitOnScreen(rowIndex, cols);

        // Determine focus behavior based on animation style and screen fit
        let focused = false;
        const rowFocusStyle = (this.getValueJS("rowFocusAnimationStyle") as string).toLowerCase();

        if (rowFocusStyle === RowFocusStyle.Wrap && !allItemsFitOnScreen) {
            // Items don't fit and we're using fixedFocusWrap - focus stays on first visible item
            focused = this.focusIndex === rowIndex && colIndex === this.rowFocus[rowIndex];
        } else {
            // Items fit on screen OR not using fixedFocusWrap - focus floats to individual items
            focused = this.focusIndex === rowIndex && this.rowFocus[rowIndex] === colIndex;
        }

        if (!this.rowItemComps[rowIndex]?.[colIndex]) {
            const itemComp = this.createItemComponent(interpreter, itemRect, content);
            this.rowItemComps[rowIndex] ??= [];
            if (itemComp instanceof Group) {
                this.rowItemComps[rowIndex][colIndex] = itemComp;
            }
        }
        // Update the component's focus state
        const itemComp = this.rowItemComps[rowIndex][colIndex];
        if (!itemComp) {
            // Item component creation failed (e.g. an unresolvable itemComponentName): skip the
            // slot instead of crashing the whole render pass on the undefined reference.
            this.logItemCompFailure();
            return;
        }
        // Re-apply the per-item size every frame. The item component's width/height are otherwise
        // only set at creation time (createItemComponent); if item [0] is first created while the
        // list is still using its full-width `itemSize` fallback (before the app assigns the real
        // `rowItemSize`), it would stay frozen at full row width — stretching the first poster.
        // `itemRect` carries the authoritative per-item dimensions (see initializeRowRenderContext).
        itemComp.setValue("width", new Float(itemRect.width), false);
        itemComp.setValue("height", new Float(itemRect.height), false);
        itemComp.setValue("rowHasFocus", BrsBoolean.from(this.focusIndex === rowIndex), false);
        itemComp.setValue(this.focusField, BrsBoolean.from(nodeFocus), false);
        // itemHasFocus is true only when this item is the focused column AND the list itself has
        // focus. Per the RowList reference, "if the RowList does not focus, all itemHasFocus fields
        // ... should be false". Gating on nodeFocus makes the field transition (and its observers
        // fire) when the list gains/loses focus while the same item stays the focused column —
        // otherwise a button focused on the first render never shows its focused state once the list
        // is focused afterwards (focusPercent stays 1, so a focusPercent observer never re-fires).
        itemComp.setValue("itemHasFocus", BrsBoolean.from(focused && nodeFocus), false);
        // rowItemComps[][] is keyed by POSITION, not by content identity — see the matching comment
        // in ArrayGrid.renderItemComponent. A reorder only dirties the container ContentNode, so
        // content.changed alone misses "this cell now holds a different object".
        const currentContent = itemComp.getValue("itemContent");
        if (content.changed || currentContent !== content) {
            itemComp.setValue("itemContent", content, true);
            content.changed = false;
        }
        itemComp.setValue("focusPercent", new Float(focused ? 1 : 0), false);
        itemComp.setValue("rowFocusPercent", new Float(this.focusIndex === rowIndex ? 1 : 0), false);

        const drawFocus = this.getValueJS("drawFocusFeedback");
        const drawFocusOnTop = this.getValueJS("drawFocusFeedbackOnTop");
        if (focused && drawFocus && !drawFocusOnTop) {
            this.renderFocus(itemRect, opacity, nodeFocus, draw2D);
        }
        const itemOrigin = [itemRect.x, itemRect.y];
        itemComp.renderNode(interpreter, itemOrigin, rotation, opacity, draw2D);
        if (focused && drawFocus && drawFocusOnTop) {
            this.renderFocus(itemRect, opacity, nodeFocus, draw2D);
        }
    }

    /**
     * Renders the "current_item of total_items" counter on the right edge of the row. Per Roku, the
     * counter is only shown for the FOCUSED row, and only when `showRowCounter` is true for that row
     * (an empty array means no counters). `showRowCounterForShortRows` (default true) suppresses it on
     * rows whose items all fit on screen. The counter uses the same font/color as the row label.
     */
    private renderRowCounter(rowIndex: number, numCols: number, topY: number, context: RowListRenderContext): void {
        if (rowIndex !== this.focusIndex || numCols === 0) {
            return;
        }
        if (!this.resolveBoolean(this.getValueJS("showRowCounter"), rowIndex, false)) {
            return;
        }
        const showShortRows = (this.getValueJS("showRowCounterForShortRows") as boolean) ?? true;
        if (!showShortRows && this.allItemsFitOnScreen(rowIndex, this.getContentChildren(this.content[rowIndex]))) {
            return;
        }
        const font = this.getValue("rowLabelFont") as Font;
        const color = this.getValueJS("rowLabelColor");
        const labelOffset = this.resolveVector(this.getValueJS("rowLabelOffset"), rowIndex, [0, 0]);
        // Right edge is inset from the list's right edge by rowCounterRightOffset, or (when unset) by the
        // row label's left offset so the counter mirrors the title's margin.
        const rightInset = (this.getValueJS("rowCounterRightOffset") as number) || (labelOffset[0] ?? 0);
        const listWidth = context.itemSize[0] || this.sceneRect.width;
        const rightEdge = context.rect.x + listWidth - rightInset;
        const counterText = `${(this.rowFocus[rowIndex] ?? 0) + 1} of ${numCols}`;
        const drawFont = font.createDrawFont();
        if (!(drawFont instanceof RoFont)) {
            return;
        }
        // Draw directly rather than via `drawText`: that helper caches measured text in `cachedLines`
        // keyed by row index, which the row label already uses for the SAME index — sharing it makes the
        // counter overwrite the label (and vice-versa). The counter text also changes as the focused
        // column moves, so it must be re-measured every frame, not cached.
        const measured = drawFont.measureText(counterText);
        const textX = rightEdge - measured.width;
        const textY = topY + Math.max(0, (this.titleHeight - measured.height) / 2);
        context.draw2D?.doDrawRotatedText(counterText, textX, textY, color, context.opacity, drawFont, 0);
    }

    protected renderRowDivider(title: string, itemRect: Rect, opacity: number, rowIndex: number, draw2D?: IfDraw2D) {
        const offset = this.resolveVector(this.getValueJS("rowLabelOffset"), rowIndex, [0, 0]);
        const divRect = {
            ...itemRect,
            x: itemRect.x + (offset[0] ?? 0),
            height: this.titleHeight,
        };

        if (title.length !== 0) {
            const font = this.getValue("rowLabelFont") as Font;
            const color = this.getValueJS("rowLabelColor");
            // Draw directly rather than via `drawText`: that helper caches the measured text in
            // `cachedLines` keyed by row index and only refreshes it when the RowList node itself is
            // marked dirty. The label text comes from the row's ContentNode `title`, which can change
            // without dirtying the RowList, so a title updated after the first render would keep drawing
            // the stale cached value. Re-measuring every frame keeps the label in sync with the content
            // (and matches how the row counter is drawn).
            const drawFont = font.createDrawFont();
            if (drawFont instanceof RoFont) {
                const measured = drawFont.measureText(title, divRect.width, "...");
                const textY = divRect.y + Math.max(0, (this.titleHeight - measured.height) / 2);
                draw2D?.doDrawRotatedText(measured.text, divRect.x, textY, color, opacity, drawFont, 0);
            }
        }

        // Return height of title plus vertical offset (spacing between title and items)
        return this.titleHeight + (offset[1] ?? 0);
    }

    protected refreshContent() {
        this.content.length = 0;
        const content = this.getValue("content");
        if (!(content instanceof ContentNode)) {
            this.parsedContentNode = undefined;
            return;
        }
        // Reset per-row horizontal focus/scroll only when a genuinely new content tree is assigned.
        // A plain re-parse (any descendant ContentNode marked changed) must preserve them, otherwise
        // horizontal navigation is wiped back to column 0 on the next render.
        if (content !== this.parsedContentNode) {
            this.parsedContentNode = content;
            this.rowFocus.length = 0;
            this.rowScrollOffset.length = 0;
        }
        const rows = this.getContentChildren(content);
        let itemIndex = 0;
        for (const row of rows) {
            const content = row.getNodeChildren();
            if (content.length === 0) {
                continue;
            }
            this.rowFocus[itemIndex] ??= 0;
            this.rowScrollOffset[itemIndex] ??= 0; // Initialize scroll offset (preserve existing)
            itemIndex++;
            this.content.push(row);
        }
    }
}
