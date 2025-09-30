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
    protected wrapCol: boolean;
    private titleHeight: number;

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
        const rowStyle = this.getFieldValueJS("rowFocusAnimationStyle") as string;
        this.wrapCol = rowStyle.toLowerCase() === "fixedfocuswrap";
        this.numRows = this.getFieldValueJS("numRows") as number;
        this.numCols = this.getFieldValueJS("numColumns") as number;
        this.rowFocus = [];
        this.hasNinePatch = true;
        this.focusField = "rowListHasFocus";
        const font = this.getFieldValue("rowLabelFont") as Font;
        const drawFont = font.createDrawFont();
        this.titleHeight = drawFont.measureTextHeight();

        // Initialize focus properly
        this.focusIndex = 0;
        this.rowFocus[0] = 0;
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.getValue().toLowerCase();
        if (fieldName === "rowfocusanimationstyle") {
            const style = value.toString().toLowerCase();
            if (["fixedfocuswrap", "floatingfocus", "fixedfocus"].includes(style)) {
                this.wrapCol = style === "fixedfocuswrap";
            } else {
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
        if (oldRow !== rowIndex) {
            super.set(new BrsString("itemUnfocused"), new Int32(oldRow));
        }
        this.focusIndex = rowIndex;
        this.rowFocus[rowIndex] = colIndex;
        super.set(new BrsString("itemFocused"), new Int32(rowIndex));
        super.set(new BrsString("rowItemFocused"), new RoArray([new Int32(rowIndex), new Int32(colIndex)]));
    }

    protected updateRowItemFocus(rowIndex: number, colIndex: number, focus: boolean, nodeFocus: boolean) {
        // Only update if the component exists
        const itemComp = this.rowItemComps[rowIndex]?.[colIndex];
        if (!itemComp) {
            return;
        }
        for (let r = 0; r < this.rowItemComps.length; r++) {
            for (let c = 0; c < this.rowItemComps[r]?.length; c++) {
                const itemComp = this.rowItemComps[r]?.[c];
                if (!itemComp) {
                    continue;
                }
                const itemFocus = r === rowIndex && c === colIndex && focus;
                itemComp.set(new BrsString("itemHasFocus"), BrsBoolean.from(itemFocus));
                itemComp.set(new BrsString("focusPercent"), new Float(itemFocus ? 1 : 0));
                const rowFocus = r === rowIndex && focus;
                itemComp.set(new BrsString("rowHasFocus"), BrsBoolean.from(rowFocus));
                itemComp.set(new BrsString("rowFocusPercent"), new Float(rowFocus ? 1 : 0));
                itemComp.set(new BrsString(this.focusField), BrsBoolean.from(nodeFocus));
            }
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
        let nextCol = this.rowFocus[currentRow] + offset;
        const numCols = this.content[currentRow]?.getNodeChildren().length ?? 0;
        if (nextCol < 0) {
            if (this.wrapCol) {
                nextCol = (nextCol + numCols) % numCols;
            } else {
                nextCol = 0;
            }
        } else if (nextCol >= numCols) {
            if (this.wrapCol) {
                nextCol = nextCol % numCols;
            } else {
                nextCol = numCols - 1;
            }
        }
        if (nextCol >= 0 && nextCol < numCols) {
            const rowItem = new RoArray([new Int32(currentRow), new Int32(nextCol)]);
            this.set(new BrsString("jumpToRowItem"), rowItem);
            handled = true;
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
        // const rowItemSpacings = this.getFieldValueJS("rowItemSpacing") ?? [[]];
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
            for (let c = 0; c < numCols; c++) {
                let colIndex = this.rowFocus[r] + c;
                if (colIndex >= numCols) {
                    if (this.wrapCol) {
                        colIndex = colIndex % numCols;
                    } else {
                        break;
                    }
                }
                if (colIndex >= cols.length) {
                    break;
                }
                this.renderRowItemComponent(interpreter, rowIndex, colIndex, itemRect, rotation, opacity, draw2D);
                // itemRect.x += itemRect.width + (rowItemSpacing[r][0] ?? spacing[0]);
                itemRect.x += itemRect.width + spacing[0];
                // if (!RectRect(this.sceneRect, itemRect)) {
                //     break;
                // }
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

        // Fix: Use this.rowFocus[this.focusIndex] instead of this.rowFocus[rowIndex]
        const focused = this.focusIndex === rowIndex && this.rowFocus[this.focusIndex] === colIndex;

        if (!this.rowItemComps[rowIndex]?.[colIndex]) {
            const itemComp = this.createItemComponent(interpreter, itemRect, content);
            if (this.rowItemComps[rowIndex] === undefined) {
                this.rowItemComps[rowIndex] = [];
            }
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
            const size = this.drawText(
                title,
                font,
                color,
                opacity,
                divRect,
                "left",
                "center",
                0,
                draw2D,
                "...",
                textLine
            );
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
            itemIndex++;
            this.content.push(row);
        }
    }
}
