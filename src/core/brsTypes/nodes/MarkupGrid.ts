import { FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { ArrayGrid } from "./ArrayGrid";
import { BrsString, ContentNode, customNodeExists, Int32, jsValueOf } from "..";
import { IfDraw2D, Rect, RectRect } from "../interfaces/IfDraw2D";
import { Interpreter } from "../../interpreter";
import { BrsDevice } from "../../device/BrsDevice";

export class MarkupGrid extends ArrayGrid {
    readonly defaultFields: FieldModel[] = [
        { name: "itemComponentName", type: "string", value: "" },
        { name: "drawFocusFeedbackOnTop", type: "boolean", value: "true" },
        { name: "vertFocusAnimationStyle", type: "string", value: "fixedFocusWrap" },
    ];
    protected readonly focusUri = "common:/images/focus_grid.9.png";
    protected readonly marginX: number;
    protected readonly marginY: number;
    protected readonly gap: number;
    protected wrap: boolean;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "MarkupGrid") {
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
        const style = jsValueOf(this.getFieldValue("vertFocusAnimationStyle")) as string;
        this.wrap = style.toLowerCase() === "fixedfocuswrap";
        this.hasNinePatch = true;
        this.focusField = "gridHasFocus";
    }

    protected handleUpDown(key: string) {
        let handled = false;
        let offset: number;
        const numCols = jsValueOf(this.getFieldValue("numColumns")) as number;
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
        if (nextIndex >= 0 && nextIndex < this.content.length) {
            const itemIndex = this.metadata[nextIndex]?.index ?? nextIndex;
            this.set(new BrsString("animateToItem"), new Int32(itemIndex));
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
        const nextIndex = this.focusIndex + offset;
        if (nextIndex >= 0 && nextIndex < this.content.length && this.itemComps?.[nextIndex]) {
            const numCols = jsValueOf(this.getFieldValue("numColumns")) as number;
            const currentRow = Math.floor(this.focusIndex / numCols);
            const nextRow = Math.floor(nextIndex / numCols);
            const item = this.itemComps[nextIndex];
            if (currentRow === nextRow && item.nodeSubtype !== "Group") {
                const itemIndex = this.metadata[nextIndex]?.index ?? nextIndex;
                this.set(new BrsString("animateToItem"), new Int32(itemIndex));
                handled = true;
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
            return;
        } else if (this.focusIndex < 0) {
            this.focusIndex = 0;
        }
        const hasSections = this.metadata.length > 0;
        const itemCompName = this.getFieldValueJS("itemComponentName") as string;
        if (!customNodeExists(interpreter, new BrsString(itemCompName))) {
            BrsDevice.stderr.write(
                `warning,[sg.markupgrid.create.fail] Failed to create markup item ${itemCompName}`
            );
            return;
        }
        const itemSize = this.getFieldValueJS("itemSize") as number[];
        const numRows = this.getFieldValueJS("numRows") as number;
        const numCols = this.getFieldValueJS("numColumns") as number;
        if (itemSize[0] === 0 || itemSize[1] === 0 || numRows === 0 || numCols === 0) {
            return;
        }
        const itemRect = { ...rect, width: itemSize[0], height: itemSize[1] };
        const spacing = this.getFieldValueJS("itemSpacing") as number[];
        const columnWidths = this.getFieldValueJS("columnWidths") as number[];
        const columnSpacings = this.getFieldValueJS("columnSpacings") as number[];
        const rowHeights = this.getFieldValueJS("rowHeights") as number[];
        const rowSpacings = this.getFieldValueJS("rowSpacings") as number[];
        this.currRow = this.updateCurrRow();
        let lastIndex = -1;
        const displayRows = Math.min(Math.ceil(this.content.length / numCols), numRows);
        let sectionIndex = 0;
        const rowWidth = numCols * itemSize[0] + (numCols - 1) * spacing[0];
        for (let r = 0; r < displayRows; r++) {
            const rowIndex = this.getIndex(r - this.currRow);
            itemRect.height = rowHeights[rowIndex / numCols] ?? itemSize[1];
            if (!hasSections && this.wrap && rowIndex < lastIndex && r > 0) {
                const divRect = { ...itemRect, width: rowWidth };
                const divHeight = this.renderWrapDivider(divRect, opacity, draw2D);
                itemRect.y += divHeight + spacing[1];
            } else if (hasSections && this.wrap && this.metadata[rowIndex]?.divider && r > 0) {
                const divRect = { ...itemRect, width: rowWidth };
                const divText = this.metadata[rowIndex].sectionTitle;
                const divHeight = this.renderSectionDivider(
                    divText,
                    divRect,
                    opacity,
                    sectionIndex,
                    draw2D
                );
                sectionIndex++;
                itemRect.y += divHeight + spacing[1];
            }
            for (let c = 0; c < numCols; c++) {
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
        this.updateRect(rect, numCols, displayRows, itemSize);
    }
}
