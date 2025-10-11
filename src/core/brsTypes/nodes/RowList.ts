import {
    BrsBoolean,
    BrsInvalid,
    BrsString,
    BrsType,
    ContentNode,
    customNodeExists,
    Float,
    Font,
    Group,
    Int32,
    isBrsString,
    jsValueOf,
    RoArray,
    rootObjects,
} from "..";
import { BrsDevice } from "../../device/BrsDevice";
import { Interpreter } from "../../interpreter";
import { AAMember } from "../components/RoAssociativeArray";
import { IfDraw2D, Rect, RectRect } from "../interfaces/IfDraw2D";
import { ArrayGrid } from "./ArrayGrid";
import { FieldKind, FieldModel } from "./Field";

export class RowList extends ArrayGrid {
    readonly defaultFields: FieldModel[] = [
        { name: "itemComponentName", type: "string", value: "" },
        { name: "rowTitleComponentName", type: "string", value: "" },
        { name: "numRows", type: "integer", value: "1" },
        { name: "numColumns", type: "integer", value: "1" },
        { name: "rowItemSize", type: "array", value: "[]" },
        { name: "rowItemSpacing", type: "array", value: "[]" },
        { name: "rowItemSelected", type: "array", value: "[]" },
        { name: "rowItemFocused", type: "array", value: "[]" },
        { name: "jumpToRowItem", type: "array", value: "[]" },
        { name: "focusXOffset", type: "array", value: "[0,0]" },
        { name: "rowLabelOffset", type: "array", value: "[[0,0]]" },
        { name: "rowLabelColor", type: "color", value: "0xffffffff" },
        { name: "rowLabelFont", type: "font" },
        { name: "showRowLabel", type: "boolarray", value: "[]" },
        { name: "rowCounterRightOffset", type: "float", value: "0" },
        { name: "showRowCounter", type: "boolarray", value: "[]" },
        { name: "showRowCounterForShortRows", type: "bool", value: "true" },
        { name: "indefiniteRowItemCount", type: "boolarray", value: "[]" },
        { name: "variableWidthItems", type: "boolarray", value: "[]" },
        { name: "rowFocusAnimationStyle", type: "string", value: "floatingFocus" },
        { name: "vertFocusAnimationStyle", type: "string", value: "fixedFocus" },
    ];
    protected readonly focusUri = "common:/images/focus_grid.9.png";
    protected readonly marginX: number;
    protected readonly marginY: number;
    protected readonly gap: number;
    protected readonly rowItemComps: Group[][] = [[]];
    protected readonly rowFocus: number[];
    protected readonly rowScrollOffset: number[] = []; // Track scroll offset per row for floating focus
    private readonly titleHeight: number;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "RowList") {
        super([], name);

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
        this.setFieldValue("focusBitmapUri", new BrsString(this.focusUri));
        this.setFieldValue("wrapDividerBitmapUri", new BrsString(this.dividerUri));
        const vertStyle = this.getFieldValueJS("vertFocusAnimationStyle") as string;
        this.wrap = vertStyle.toLowerCase() === "fixedfocuswrap";
        this.numRows = this.getFieldValueJS("numRows") as number;
        this.numCols = this.getFieldValueJS("numColumns") as number;
        this.rowFocus = [];
        this.rowScrollOffset = []; // Initialize scroll offset tracking
        this.hasNinePatch = true;
        this.focusField = "rowListHasFocus";
        const font = this.getFieldValue("rowLabelFont") as Font;
        const drawFont = font.createDrawFont();
        this.titleHeight = drawFont.measureTextHeight();

        // Initialize focus properly
        this.focusIndex = 0;
        this.rowFocus[0] = 0;
        this.rowScrollOffset[0] = 0;
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.getValue().toLowerCase();
        if (fieldName === "rowfocusanimationstyle") {
            const style = value.toString().toLowerCase();
            if (!["fixedfocuswrap", "floatingfocus", "fixedfocus"].includes(style)) {
                // Invalid rowFocusAnimationStyle
                return BrsInvalid.Instance;
            }
        } else if (fieldName === "jumptorowitem" && value instanceof RoArray) {
            const rowItem = jsValueOf(value) as any[];
            if (typeof rowItem[0] === "number" && typeof rowItem[1] === "number") {
                this.setFocusedItem(rowItem[0], rowItem[1]);
            }
        } else if (["horizfocusanimationstyle", "numcolumns"].includes(fieldName)) {
            // Invalid fields for RowList
            return BrsInvalid.Instance;
        }
        return super.set(index, value, alwaysNotify, kind);
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
            super.set(new BrsString("itemUnfocused"), new Int32(oldRow));
        }

        this.focusIndex = rowIndex;
        this.rowFocus[rowIndex] = colIndex;

        // Get the row focus animation style to determine scrolling behavior
        const rowFocusStyle = this.getFieldValueJS("rowFocusAnimationStyle") as string;

        // Initialize scroll offset if not set - ensure it starts at 0 for first visit
        const isFirstVisit = this.rowScrollOffset[rowIndex] === undefined || this.rowScrollOffset[rowIndex] === null;
        if (isFirstVisit) {
            this.rowScrollOffset[rowIndex] = 0;
        }

        const itemSize = this.getFieldValueJS("itemSize") as number[];
        const spacing = this.getFieldValueJS("itemSpacing") as number[];
        const rowItemSize = this.getFieldValueJS("rowItemSize") as number[][];
        const rowItemWidth = rowItemSize[rowIndex]?.[0] ?? itemSize[0];
        const cols = this.content[rowIndex]?.getNodeChildren();
        const numCols = cols?.length ?? 0;
        const totalRowWidth = numCols * rowItemWidth + (numCols - 1) * spacing[0];
        const allItemsFitOnScreen = totalRowWidth <= this.sceneRect.width;

        // Adjust scroll offset based on animation style
        if (allItemsFitOnScreen) {
            // All items fit, no scrolling needed - always use floating focus behavior
            this.rowScrollOffset[rowIndex] = 0;
        } else if (rowFocusStyle === "fixedFocusWrap") {
            // For fixedFocusWrap, no scroll offset (focus wraps around)
            this.rowScrollOffset[rowIndex] = 0;
        } else if (rowFocusStyle === "fixedFocus") {
            // For fixedFocus, focus always stays at first visible position (left edge)
            // Scroll offset equals focused column so focus appears at position 0
            this.rowScrollOffset[rowIndex] = colIndex;
        } else if (rowFocusStyle === "floatingFocus") {
            // floatingFocus: ensure focused item is visible
            // Allow partial visibility - use ceil to include partially visible items
            const maxVisibleItems = Math.ceil((this.sceneRect.width + spacing[0]) / (rowItemWidth + spacing[0]));

            if (isChangingRow) {
                // When changing to a different row
                if (isFirstVisit) {
                    // First time visiting this row - calculate initial scroll position
                    if (colIndex === 0) {
                        // Explicitly focusing first item - start from beginning
                        this.rowScrollOffset[rowIndex] = 0;
                    } else if (colIndex < maxVisibleItems) {
                        // Focused item fits in the "floating" visible area - no scroll needed
                        this.rowScrollOffset[rowIndex] = 0;
                    } else {
                        // Focused item is beyond floating area - scroll to show it at right edge
                        this.rowScrollOffset[rowIndex] = Math.max(0, colIndex - maxVisibleItems + 1);
                    }
                }
                // else: Returning to a previously visited row - preserve saved scroll offset
            } else if (colIndex < this.rowScrollOffset[rowIndex]) {
                // Focused item is before visible area, scroll left
                this.rowScrollOffset[rowIndex] = colIndex;
            } else if (colIndex >= this.rowScrollOffset[rowIndex] + maxVisibleItems) {
                // Focused item is after visible area, scroll right to show it at the right edge
                this.rowScrollOffset[rowIndex] = colIndex - maxVisibleItems + 1;
            }
        }

        super.set(new BrsString("itemFocused"), new Int32(rowIndex));
        super.set(new BrsString("rowItemFocused"), new RoArray([new Int32(rowIndex), new Int32(colIndex)]));
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
            const rowItem = new RoArray([new Int32(nextRow), new Int32(this.rowFocus[nextRow] ?? 0)]);
            this.set(new BrsString("jumpToRowItem"), rowItem);
            handled = true;
            this.currRow += this.wrap ? 0 : offset;
        }
        return handled;
    }

    protected handlePageUpDown(key: string) {
        return this.handleUpDown(key);
    }

    protected handleLeftRight(key: string) {
        let handled = false;
        const offset = key === "left" ? -1 : 1;
        const currentRow = this.focusIndex;
        const cols = this.content[currentRow]?.getNodeChildren();
        const numCols = cols?.length ?? 0;

        if (numCols <= 1) {
            return false; // No horizontal movement possible
        }

        // Initialize scroll offset for this row if not set
        this.rowScrollOffset[currentRow] ??= 0;

        // Check if all items fit on screen to determine wrap behavior
        const itemSize = this.getFieldValueJS("itemSize") as number[];
        const spacing = this.getFieldValueJS("itemSpacing") as number[];
        const rowItemSize = this.getFieldValueJS("rowItemSize") as number[][];

        // Calculate display row index (relative to currRow, not absolute row index)
        let displayRowIndex = currentRow - this.currRow;
        if (this.wrap && displayRowIndex < 0) {
            displayRowIndex += this.content.length;
        }

        const rowItemWidth = rowItemSize[displayRowIndex]?.[0] ?? itemSize[0];
        const totalRowWidth = numCols * rowItemWidth + (numCols - 1) * spacing[0];
        const allItemsFitOnScreen = totalRowWidth <= this.sceneRect.width;
        const rowFocusStyle = this.getFieldValueJS("rowFocusAnimationStyle") as string;

        if (allItemsFitOnScreen) {
            // Items fit on screen: Normal column movement (no wrapping, no scrolling)
            let nextCol = this.rowFocus[currentRow] + offset;
            nextCol = Math.max(0, Math.min(nextCol, numCols - 1));

            if (nextCol !== this.rowFocus[currentRow]) {
                this.rowFocus[currentRow] = nextCol;
                super.set(new BrsString("rowItemFocused"), new RoArray([new Int32(currentRow), new Int32(nextCol)]));
                handled = true;
            }
        } else if (rowFocusStyle === "fixedFocusWrap") {
            // fixedFocusWrap: Wrap around, focus stays at first visible position
            let nextCol = this.rowFocus[currentRow] + offset;

            if (nextCol < 0) {
                nextCol = numCols - 1;
            } else if (nextCol >= numCols) {
                nextCol = 0;
            }

            this.rowFocus[currentRow] = nextCol;
            super.set(new BrsString("rowItemFocused"), new RoArray([new Int32(currentRow), new Int32(nextCol)]));
            handled = true;
        } else if (rowFocusStyle === "fixedFocus") {
            // fixedFocus: Focus stays at first visible position, content scrolls
            let nextCol = this.rowFocus[currentRow] + offset;
            nextCol = Math.max(0, Math.min(nextCol, numCols - 1));

            if (nextCol !== this.rowFocus[currentRow]) {
                this.rowFocus[currentRow] = nextCol;
                this.rowScrollOffset[currentRow] = nextCol; // Scroll to keep focus at left edge
                super.set(new BrsString("rowItemFocused"), new RoArray([new Int32(currentRow), new Int32(nextCol)]));
                handled = true;
            }
        } else {
            // floatingFocus: Focus floats until it reaches screen edges, then scrolls
            // Allow partial visibility - use ceil to include partially visible items
            const maxVisibleItems = Math.ceil((this.sceneRect.width + spacing[0]) / (rowItemWidth + spacing[0]));
            const currentFocusedCol = this.rowFocus[currentRow];
            const currentScrollOffset = this.rowScrollOffset[currentRow];

            // Calculate focus position on screen (relative to visible items)
            const focusScreenPosition = currentFocusedCol - currentScrollOffset;

            if (offset > 0) {
                // Moving right
                if (currentFocusedCol < numCols - 1) {
                    // Not at the last item yet
                    const rightEdgeThreshold = Math.max(0, maxVisibleItems - 1);

                    if (focusScreenPosition < rightEdgeThreshold) {
                        // Focus can still move right without scrolling
                        this.rowFocus[currentRow] = currentFocusedCol + 1;
                    } else if (currentScrollOffset + maxVisibleItems < numCols) {
                        // Focus is at right edge, scroll the content
                        this.rowScrollOffset[currentRow] = currentScrollOffset + 1;
                        this.rowFocus[currentRow] = currentFocusedCol + 1;
                    } else {
                        // Already showing last items, just move focus to last item
                        this.rowFocus[currentRow] = numCols - 1;
                    }
                    handled = true;
                }
            } else if (currentFocusedCol > 0) {
                // Moving left
                // Not at the first item yet
                if (focusScreenPosition > 0) {
                    // Focus can still move left without scrolling
                    this.rowFocus[currentRow] = currentFocusedCol - 1;
                } else if (currentScrollOffset > 0) {
                    // Focus is at left edge, scroll the content
                    this.rowScrollOffset[currentRow] = currentScrollOffset - 1;
                    this.rowFocus[currentRow] = currentFocusedCol - 1;
                } else {
                    // Already at start, just move focus to first item
                    this.rowFocus[currentRow] = 0;
                }
                handled = true;
            }
            if (handled) {
                super.set(
                    new BrsString("rowItemFocused"),
                    new RoArray([new Int32(currentRow), new Int32(this.rowFocus[currentRow])])
                );
            }
        }

        return handled;
    }

    protected renderContent(
        interpreter: Interpreter,
        rect: Rect,
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        if (this.content.length === 0) {
            console.debug("RowList has no content to render.");
            return;
        } else if (this.focusIndex < 0) {
            this.focusIndex = 0;
        }
        const itemCompName = this.getFieldValueJS("itemComponentName") as string;
        if (!customNodeExists(new BrsString(itemCompName))) {
            BrsDevice.stderr.write(`warning,[sg.rowlist.create.fail] Failed to create markup item ${itemCompName}`);
            return;
        }
        const itemSize = this.getFieldValueJS("itemSize") as number[];
        if (!itemSize[0] || !itemSize[1] || !this.numRows) {
            return;
        }
        const spacing = this.getFieldValueJS("itemSpacing") as number[];
        const rowItemSize = this.getFieldValueJS("rowItemSize") as number[][];
        const rowHeights = this.getFieldValueJS("rowHeights") as number[];
        const rowSpacings = this.getFieldValueJS("rowSpacings") as number[];
        this.currRow = this.focusIndex;
        const displayRows = Math.min(this.content.length, this.numRows);
        let rowItemWidth = itemSize[0];
        let rowItemHeight = itemSize[1];
        let showRowLabel = true;
        const itemRect = { ...rect, width: rowItemWidth, height: rowItemHeight };
        for (let r = 0; r < displayRows; r++) {
            let rowIndex = this.currRow + r;
            if (this.wrap) {
                if (rowIndex >= this.content.length) {
                    rowIndex = rowIndex % this.content.length;
                }
                if (rowIndex < 0) {
                    rowIndex += this.content.length;
                }
            } else if (rowIndex >= this.content.length) {
                if (this.content.length === 0) {
                    break;
                }
                rowIndex = this.content.length - 1;
            }
            const row = this.content[rowIndex];
            const cols = row.getNodeChildren();
            const numCols = cols.length;
            rowItemWidth = rowItemSize[r]?.[0] ?? rowItemWidth;
            rowItemHeight = rowItemSize[r]?.[1] ?? rowItemHeight;
            const rowWidth = numCols * rowItemWidth + (numCols - 1) * spacing[0];
            itemRect.width = rowItemWidth;
            itemRect.height = rowHeights[r] ?? rowItemHeight;
            if (this.wrap && rowIndex === 0 && r > 0) {
                itemRect.y = itemRect.y - spacing[1];
                const divRect = { ...itemRect, width: rowWidth };
                const divHeight = this.renderWrapDivider(divRect, opacity, draw2D);
                itemRect.y += divHeight + spacing[1];
            }
            const title = row.getFieldValueJS("title") ?? "";
            showRowLabel = this.getFieldValueJS("showRowLabel")?.[rowIndex] ?? showRowLabel;
            if (title.length !== 0 && showRowLabel) {
                const divRect = { ...itemRect, width: rowWidth };
                const divHeight = this.renderRowDivider(title, divRect, opacity, rowIndex, draw2D);
                itemRect.y += divHeight;
            }

            // Check if all items fit on screen to determine rendering behavior
            const totalRowWidth = numCols * rowItemWidth + (numCols - 1) * spacing[0];
            const allItemsFitOnScreen = totalRowWidth <= this.sceneRect.width;
            const rowFocusStyle = this.getFieldValueJS("rowFocusAnimationStyle") as string;

            // Initialize scroll offset for this row if not set
            this.rowScrollOffset[rowIndex] ??= 0;

            let startCol: number; // First column to render
            let renderMode: string; // allItemsFit, wrapMode, or scrollMode

            if (allItemsFitOnScreen) {
                // All items fit: render from column 0
                startCol = 0;
                renderMode = "allItemsFit";
            } else if (rowFocusStyle === "fixedFocusWrap") {
                // Fixed focus wrap: render items starting from focused position
                startCol = this.rowFocus[rowIndex] ?? 0;
                renderMode = "wrapMode";
            } else {
                // floatingFocus or fixedFocus: render from scroll offset
                startCol = this.rowScrollOffset[rowIndex] ?? 0;
                renderMode = "scrollMode";
            }

            const maxVisibleItems = Math.ceil((this.sceneRect.width + spacing[0]) / (rowItemWidth + spacing[0]));
            const endCol = renderMode === "wrapMode" ? numCols : Math.min(startCol + maxVisibleItems, numCols);

            for (let c = 0; c < (renderMode === "wrapMode" ? numCols : endCol - startCol); c++) {
                let colIndex = startCol + c;

                if (renderMode === "wrapMode" && colIndex >= numCols) {
                    // In wrapMode, wrap around to beginning
                    colIndex = colIndex % numCols;
                }

                if (colIndex >= cols.length) {
                    break;
                }

                this.renderRowItemComponent(interpreter, rowIndex, colIndex, itemRect, rotation, opacity, draw2D);
                itemRect.x += itemRect.width + spacing[0];

                // Stop if we've gone past the screen
                if (itemRect.x > this.sceneRect.x + this.sceneRect.width) {
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

    protected renderRowItemComponent(
        interpreter: Interpreter,
        rowIndex: number,
        colIndex: number,
        itemRect: Rect,
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        const cols = this.content[rowIndex]?.getNodeChildren();
        const content = cols?.[colIndex];
        if (!(content instanceof ContentNode)) {
            return;
        }
        const nodeFocus = rootObjects.focused === this;

        // Check if all items in this row fit on screen by checking if last item fits
        const numCols = cols.length;
        const rowItemWidth = itemRect.width;
        const spacing = this.getFieldValueJS("itemSpacing") as number[];
        const lastItemX =
            itemRect.x - colIndex * (rowItemWidth + spacing[0]) + (numCols - 1) * (rowItemWidth + spacing[0]);
        const lastItemRightEdge = lastItemX + rowItemWidth;
        const allItemsFitOnScreen = lastItemRightEdge <= this.sceneRect.width;

        // Determine focus behavior based on animation style and screen fit
        let focused = false;
        const rowFocusStyle = this.getFieldValueJS("rowFocusAnimationStyle") as string;

        if (rowFocusStyle === "fixedFocusWrap" && !allItemsFitOnScreen) {
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
        if (content.changed) {
            this.rowItemComps[rowIndex][colIndex].set(new BrsString("itemContent"), content, true);
            content.changed = false;
        }

        // Update the component's focus state
        const itemComp = this.rowItemComps[rowIndex][colIndex];
        if (itemComp) {
            itemComp.set(new BrsString("itemHasFocus"), BrsBoolean.from(focused));
            itemComp.set(new BrsString("focusPercent"), new Float(focused ? 1 : 0));
            itemComp.set(new BrsString("rowHasFocus"), BrsBoolean.from(this.focusIndex === rowIndex));
            itemComp.set(new BrsString("rowFocusPercent"), new Float(this.focusIndex === rowIndex ? 1 : 0));
            itemComp.set(new BrsString(this.focusField), BrsBoolean.from(nodeFocus));
        }

        const drawFocus = this.getFieldValueJS("drawFocusFeedback");
        const drawFocusOnTop = this.getFieldValueJS("drawFocusFeedbackOnTop");
        if (focused && drawFocus && !drawFocusOnTop) {
            this.renderFocus(itemRect, opacity, nodeFocus, draw2D);
        }
        const itemOrigin = [itemRect.x, itemRect.y];
        this.rowItemComps[rowIndex][colIndex].renderNode(interpreter, itemOrigin, rotation, opacity, draw2D);
        if (focused && drawFocus && drawFocusOnTop) {
            this.renderFocus(itemRect, opacity, nodeFocus, draw2D);
        }
    }

    protected renderRowDivider(title: string, itemRect: Rect, opacity: number, textLine: number, draw2D?: IfDraw2D) {
        const rowOffset = this.getFieldValueJS("rowLabelOffset") as number[][];
        const divRect = { ...itemRect, height: this.titleHeight };
        if (title.length !== 0) {
            const font = this.getFieldValue("rowLabelFont") as Font;
            const color = this.getFieldValueJS("rowLabelColor");
            this.drawText(title, font, color, opacity, divRect, "left", "center", 0, draw2D, "...", textLine);
        }
        return this.titleHeight + (rowOffset?.[textLine]?.[1] ?? 0);
    }

    protected refreshContent() {
        this.content.length = 0;
        const content = this.getFieldValue("content");
        if (!(content instanceof ContentNode)) {
            return;
        }
        const rows = content.getNodeChildren() as ContentNode[];
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
