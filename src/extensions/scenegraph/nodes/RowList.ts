import {
    AAMember,
    Interpreter,
    BrsBoolean,
    BrsString,
    BrsType,
    Float,
    Int32,
    RoArray,
    IfDraw2D,
    Rect,
    RectRect,
    RoFont,
} from "brs-engine";
import { sgRoot } from "../SGRoot";
import { ContentNode } from "./ContentNode";
import { brsValueOf, jsValueOf } from "../factory/Serializer";
import { Font } from "./Font";
import { Group } from "./Group";
import { ArrayGrid, FocusStyle } from "./ArrayGrid";
import { FieldKind, FieldModel } from "../SGTypes";
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
            this.marginY = 33;
        } else {
            this.marginX = 22;
            this.marginY = 22;
        }
        this.gap = 0;
        this.setValueSilent("focusBitmapUri", new BrsString(this.focusUri));
        this.setValueSilent("wrapDividerBitmapUri", new BrsString(this.dividerUri));
        const vertStyle = this.getValueJS("vertFocusAnimationStyle") as string;
        this.wrap = vertStyle.toLowerCase() === RowFocusStyle.Wrap;
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

        if (isChangingRow) {
            super.setValue("itemUnfocused", new Int32(oldRow));
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
        const cols = this.content[rowIndex]?.getNodeChildren();
        const numCols = cols?.length ?? 0;
        const totalRowWidth = numCols * rowItemWidth + (numCols - 1) * spacing[0];
        const allItemsFitOnScreen = totalRowWidth <= this.sceneRect.width;

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

        super.setValue("itemFocused", new Int32(rowIndex));
        super.setValue("rowItemFocused", new RoArray([new Int32(rowIndex), new Int32(colIndex)]));
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
            this.currRow += this.wrap ? 0 : offset; // Update currRow before setFocusedItem
            this.setValue("jumpToRowItem", rowItem);
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
        const cols = this.content[currentRow]?.getNodeChildren();
        const numCols = cols?.length ?? 0;

        if (numCols <= 1) {
            return false;
        }

        this.rowScrollOffset[currentRow] ??= 0;

        const rowItemWidth = this.getRowItemWidth(currentRow);
        const allItemsFitOnScreen = this.checkIfAllItemsFitOnScreen(numCols, rowItemWidth);
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
        if (press && this.focusIndex >= 0 && this.focusIndex < this.rowFocus.length) {
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

    private getRowItemSize(rowIndex: number): number[] {
        const itemSize = this.getValueJS("itemSize") as number[];
        // Per Roku docs, rowItemSize is indexed by absolute row; rows beyond the array reuse the
        // last entry, and an empty array falls back to itemSize.
        return this.resolveVector(this.getValueJS("rowItemSize"), rowIndex, itemSize);
    }

    private getRowItemWidth(rowIndex: number): number {
        return this.getRowItemSize(rowIndex)[0];
    }

    private getRowItemSpacing(rowIndex: number): number[] {
        let fallback = [0, 0];
        const itemSpacing = this.getValueJS("itemSpacing") as number[];
        if (itemSpacing?.length === 2) {
            fallback = itemSpacing;
        }
        return this.resolveVector(this.getValueJS("rowItemSpacing"), rowIndex, fallback);
    }

    private checkIfAllItemsFitOnScreen(numCols: number, rowItemWidth: number): boolean {
        // Use the focused row's spacing (this.focusIndex is the absolute row index)
        const spacing = this.getRowItemSpacing(this.focusIndex);
        const totalRowWidth = numCols * rowItemWidth + (numCols - 1) * spacing[0];
        return totalRowWidth <= this.sceneRect.width;
    }

    private handleAllItemsFit(currentRow: number, numCols: number, offset: number): boolean {
        let nextCol = this.rowFocus[currentRow] + offset;
        nextCol = Math.max(0, Math.min(nextCol, numCols - 1));

        if (nextCol !== this.rowFocus[currentRow]) {
            this.rowFocus[currentRow] = nextCol;
            super.setValue("rowItemFocused", new RoArray([new Int32(currentRow), new Int32(nextCol)]));
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
        super.setValue("rowItemFocused", new RoArray([new Int32(currentRow), new Int32(nextCol)]));
        return true;
    }

    private handleFixedFocus(currentRow: number, numCols: number, offset: number): boolean {
        let nextCol = this.rowFocus[currentRow] + offset;
        nextCol = Math.max(0, Math.min(nextCol, numCols - 1));

        if (nextCol !== this.rowFocus[currentRow]) {
            this.rowFocus[currentRow] = nextCol;
            this.rowScrollOffset[currentRow] = nextCol;
            super.setValue("rowItemFocused", new RoArray([new Int32(currentRow), new Int32(nextCol)]));
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
            const value = new RoArray([new Int32(currentRow), new Int32(this.rowFocus[currentRow])]);
            super.setValue("rowItemFocused", value);
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
        this.currRow = this.focusIndex;

        for (let r = 0; r < context.displayRows; r++) {
            const rowIndex = this.calculateActualRowIndex(r);
            if (rowIndex === -1) {
                break;
            }
            if (!this.renderSingleRow(rowIndex, r, context)) {
                break;
            }
        }
        this.updateRect(rect, context.displayRows, context.itemSize);
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
        this.renderRowContent(rowIndex, cols, numCols, context.rowItemWidth, spacing, context.itemRect, context);
        if (clip) {
            context.draw2D?.popClip();
        }

        // Render the "N of M" row counter in the label band at the row top, AFTER the items.
        this.renderRowCounter(rowIndex, numCols, rowTopY, context);

        // Prepare for next row: advance by the ROW height (not the poster height) from the row top,
        // grown by the band height when the band did not fit in the row's slack so a labeled short row
        // (e.g. the first "The Grid" row) does not overlap the next.
        context.itemRect.x = context.rect.x;
        const rowSpacing = this.calculateRowSpacing(rowIndex, context.rowSpacings, context.globalSpacing);
        context.itemRect.y = rowTopY + rowHeight + (bandFits ? 0 : bandHeight) + rowSpacing;

        return RectRect(this.sceneRect, context.itemRect);
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
        numCols: number,
        rowItemWidth: number,
        spacing: number[],
        itemRect: Rect,
        context: RowListRenderContext
    ): void {
        const totalRowWidth = numCols * rowItemWidth + (numCols - 1) * spacing[0];
        const allItemsFitOnScreen = totalRowWidth <= this.sceneRect.width;
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

        const maxVisibleItems = Math.ceil((this.sceneRect.width + spacing[0]) / (rowItemWidth + spacing[0]));
        const endCol = renderMode === "wrapMode" ? numCols : Math.min(startCol + maxVisibleItems, numCols);

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

        // Check if all items in this row fit on screen by checking if last item fits
        const numCols = cols.length;
        const rowItemWidth = itemRect.width;
        const spacing = this.getRowItemSpacing(rowIndex);
        const lastItemX =
            itemRect.x - colIndex * (rowItemWidth + spacing[0]) + (numCols - 1) * (rowItemWidth + spacing[0]);
        const lastItemRightEdge = lastItemX + rowItemWidth;
        const allItemsFitOnScreen = lastItemRightEdge <= this.sceneRect.width;

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
        if (itemComp) {
            itemComp.setValue("rowHasFocus", BrsBoolean.from(this.focusIndex === rowIndex), false);
            itemComp.setValue(this.focusField, BrsBoolean.from(nodeFocus), false);
            itemComp.setValue("itemHasFocus", BrsBoolean.from(focused), false);
            if (content.changed) {
                itemComp.setValue("itemContent", content, true);
                content.changed = false;
            }
            itemComp.setValue("focusPercent", new Float(focused ? 1 : 0), false);
            itemComp.setValue("rowFocusPercent", new Float(this.focusIndex === rowIndex ? 1 : 0), false);
        }

        const drawFocus = this.getValueJS("drawFocusFeedback");
        const drawFocusOnTop = this.getValueJS("drawFocusFeedbackOnTop");
        if (focused && drawFocus && !drawFocusOnTop) {
            this.renderFocus(itemRect, opacity, nodeFocus, draw2D);
        }
        const itemOrigin = [itemRect.x, itemRect.y];
        this.rowItemComps[rowIndex][colIndex].renderNode(interpreter, itemOrigin, rotation, opacity, draw2D);
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
        if (!showShortRows && this.checkIfAllItemsFitOnScreen(numCols, context.rowItemWidth)) {
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
