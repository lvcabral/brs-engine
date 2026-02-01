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
    rowItemSize: number[][];
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

        const itemSize = this.getValueJS("itemSize") as number[];
        const spacing = this.getRowItemSpacing(rowIndex); // Use the actual row's spacing
        const rowItemSize = this.getValueJS("rowItemSize") as number[][];
        const rowItemWidth = rowItemSize[0]?.[0] ?? itemSize[0]; // Focused row is at display index 0
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
        if (nextRow >= 0 && nextRow < this.content.length) {
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
                return true;
            }
        }
        return false;
    }

    private getRowItemWidth(rowIndex: number): number {
        const itemSize = this.getValueJS("itemSize") as number[];
        const rowItemSize = this.getValueJS("rowItemSize") as number[][];

        // Calculate display row index (relative to currRow, not absolute row index)
        let displayRowIndex = rowIndex - this.currRow;
        if (this.wrap && displayRowIndex < 0) {
            displayRowIndex += this.content.length;
        }

        return rowItemSize[displayRowIndex]?.[0] ?? itemSize[0];
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
        const rowItemSize = this.getValueJS("rowItemSize") as number[][];
        const rowHeights = this.getValueJS("rowHeights") as number[];
        const rowSpacings = this.getValueJS("rowSpacings") as number[];
        const displayRows = Math.min(this.content.length, this.numRows);

        return {
            itemSize,
            globalSpacing,
            rowItemSize,
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

        // Update row dimensions
        context.rowItemWidth = context.rowItemSize[displayRowIndex]?.[0] ?? context.rowItemWidth;
        context.rowItemHeight = context.rowItemSize[displayRowIndex]?.[1] ?? context.rowItemHeight;

        const spacing = this.getRowItemSpacing(rowIndex);
        const rowWidth = numCols * context.rowItemWidth + (numCols - 1) * spacing[0];

        context.itemRect.width = context.rowItemWidth;
        context.itemRect.height = context.rowHeights[displayRowIndex] ?? context.rowItemHeight;

        // Render wrap divider if needed
        if (this.wrap && rowIndex === 0 && displayRowIndex > 0) {
            context.itemRect.y = context.itemRect.y - spacing[1];
            const divRect = { ...context.itemRect, width: rowWidth };
            const divHeight = this.renderWrapDivider(divRect, context.opacity, context.draw2D);
            context.itemRect.y += divHeight + spacing[1];
        }

        // Render row label if needed
        const title = row.getValueJS("title") ?? "";
        context.showRowLabel = this.getValueJS("showRowLabel")?.[rowIndex] ?? context.showRowLabel;
        if (title.length !== 0 && context.showRowLabel) {
            const divRect = { ...context.itemRect, width: rowWidth };
            const divHeight = this.renderRowDivider(title, divRect, context.opacity, displayRowIndex, context.draw2D);
            context.itemRect.y += divHeight;
        }

        // Apply horizontal offset and render items
        const xOffset = this.getRowXOffset(displayRowIndex);
        context.itemRect.x = context.rect.x + xOffset;

        this.renderRowContent(rowIndex, cols, numCols, context.rowItemWidth, spacing, context.itemRect, context);

        // Prepare for next row
        context.itemRect.x = context.rect.x;
        const rowSpacing = this.calculateRowSpacing(displayRowIndex, context.rowSpacings, context.globalSpacing);
        context.itemRect.y += context.itemRect.height + rowSpacing;

        return RectRect(this.sceneRect, context.itemRect);
    }

    private getRowXOffset(displayRowIndex: number): number {
        const focusXOffset = this.getValueJS("focusXOffset") as number[];
        if (!focusXOffset || focusXOffset.length === 0) {
            return 0;
        }

        const index = Math.min(displayRowIndex, focusXOffset.length - 1);
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

    private calculateRowSpacing(displayRowIndex: number, rowSpacings: number[], globalSpacing: number[]): number {
        const rowSpacing = rowSpacings[displayRowIndex] ?? globalSpacing[1];
        const defaultRowSpacing = this.resolution === "FHD" ? 60 : 40;
        return rowSpacing !== undefined && rowSpacing !== 0 ? rowSpacing : defaultRowSpacing;
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

    protected renderRowDivider(
        title: string,
        itemRect: Rect,
        opacity: number,
        displayRowIndex: number,
        draw2D?: IfDraw2D
    ) {
        const offset = this.resolveVector(this.getValueJS("rowLabelOffset"), displayRowIndex, [0, 0]);
        const divRect = {
            ...itemRect,
            x: itemRect.x + (offset[0] ?? 0),
            height: this.titleHeight,
        };

        if (title.length !== 0) {
            const font = this.getValue("rowLabelFont") as Font;
            const color = this.getValueJS("rowLabelColor");
            this.drawText(title, font, color, opacity, divRect, "left", "center", 0, draw2D, "...", displayRowIndex);
        }

        // Return height of title plus vertical offset (spacing between title and items)
        return this.titleHeight + (offset[1] ?? 0);
    }

    protected refreshContent() {
        this.content.length = 0;
        const content = this.getValue("content");
        if (!(content instanceof ContentNode)) {
            return;
        }
        const rows = this.getContentChildren(content);
        let itemIndex = 0;
        for (const row of rows) {
            const content = row.getNodeChildren();
            if (content.length === 0) {
                continue;
            }
            this.rowFocus[itemIndex] = 0;
            this.rowScrollOffset[itemIndex] = 0; // Initialize scroll offset
            itemIndex++;
            this.content.push(row);
        }
    }
}
