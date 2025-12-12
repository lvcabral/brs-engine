import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { AAMember, Interpreter, BrsDevice, BrsString, Int32, IfDraw2D, Rect, RectRect } from "brs-engine";
import { ArrayGrid } from "./ArrayGrid";
import { ContentNode } from "./ContentNode";
import { customNodeExists } from "../factory/SGNodeFactory";
import { jsValueOf } from "../factory/serialization";

export class MarkupGrid extends ArrayGrid {
    readonly defaultFields: FieldModel[] = [
        { name: "itemComponentName", type: "string", value: "" },
        { name: "drawFocusFeedbackOnTop", type: "boolean", value: "true" },
        { name: "vertFocusAnimationStyle", type: "string", value: "fixedFocusWrap" },
        { name: "numRows", type: "integer", value: "12" },
        { name: "numColumns", type: "integer", value: "1" },
    ];
    protected readonly focusUri = "common:/images/focus_grid.9.png";
    protected readonly marginX: number;
    protected readonly marginY: number;
    protected readonly gap: number;

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
        const style = this.getValueJS("vertFocusAnimationStyle") as string;
        this.wrap = style.toLowerCase() === "fixedfocuswrap";
        this.numRows = this.getValueJS("numRows") as number;
        this.numCols = this.getValueJS("numColumns") as number;
        this.hasNinePatch = true;
        this.focusField = "gridHasFocus";
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
        if (nextIndex >= 0 && nextIndex < this.content.length) {
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

    protected handleLeftRight(key: string) {
        let handled = false;
        const offset = key === "left" ? -1 : 1;
        const nextIndex = this.focusIndex + offset;
        if (nextIndex >= 0 && nextIndex < this.content.length && this.itemComps?.[nextIndex]) {
            const numCols = jsValueOf(this.getValue("numColumns")) as number;
            const currentRow = Math.floor(this.focusIndex / numCols);
            const nextRow = Math.floor(nextIndex / numCols);
            const item = this.itemComps[nextIndex];
            if (currentRow === nextRow && item.nodeSubtype !== "Group") {
                const itemIndex = this.metadata[nextIndex]?.index ?? nextIndex;
                this.setValue("animateToItem", new Int32(itemIndex));
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
        const itemCompName = this.getValueJS("itemComponentName") as string;
        if (!customNodeExists(itemCompName)) {
            BrsDevice.stderr.write(`warning,[sg.markupgrid.create.fail] Failed to create markup item ${itemCompName}`);
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
            const rowIndex = this.getIndex(r - this.currRow);
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
            for (let c = 0; c < this.numCols; c++) {
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
