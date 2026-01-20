import {
    AAMember,
    Interpreter,
    BrsBoolean,
    BrsDevice,
    BrsString,
    BrsType,
    Float,
    Int32,
    isNumberComp,
    RoArray,
    IfDraw2D,
    Rect,
    RoFont,
} from "brs-engine";
import { sgRoot } from "../SGRoot";
import { ContentNode } from "./ContentNode";
import { customNodeExists } from "../factory/NodeFactory";
import { brsValueOf, jsValueOf } from "../factory/Serializer";
import { Font } from "./Font";
import { Group } from "./Group";
import { ArrayGrid, FocusStyle } from "./ArrayGrid";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";

interface RowMetrics {
    rowHeight: number;
    itemHeight: number;
    itemWidth: number;
    spacingX: number;
    spacingY: number;
    itemYOffset: number;
    focusPercent: number;
}

const ValidFocusStyles = new Set(Object.values(FocusStyle).map((style) => style.toLowerCase()));

const RowFocusStyleWrap = FocusStyle.FixedFocusWrap.toLowerCase();

export class ZoomRowList extends ArrayGrid {
    readonly defaultFields: FieldModel[] = [
        { name: "itemComponentName", type: "string", value: "" },
        { name: "numRows", type: "integer", value: "12" },
        { name: "numColumns", type: "integer", value: "1" },
        { name: "rowWidth", type: "float", value: "0.0" },
        { name: "rowHeight", type: "floatarray", value: "[]" },
        { name: "rowZoomHeight", type: "floatarray", value: "[]" },
        { name: "spacingAfterRow", type: "float", value: "0.0" },
        { name: "rowItemYOffset", type: "floatarray", value: "[]" },
        { name: "rowItemZoomYOffset", type: "floatarray", value: "[]" },
        { name: "rowItemHeight", type: "floatarray", value: "[]" },
        { name: "rowItemZoomHeight", type: "floatarray", value: "[]" },
        { name: "rowItemAspectRatio", type: "floatarray", value: "[]" },
        { name: "spacingAfterRowItem", type: "floatarray", value: "[]" },
        { name: "useDefaultAspectRatio", type: "boolarray", value: "[]" },
        { name: "showRowTitle", type: "boolarray", value: "[]" },
        { name: "rowTitleOffset", type: "array", value: "[]" },
        { name: "rowTitleFont", type: "font", value: "font:SmallestSystemFont" },
        { name: "rowTitleColor", type: "colorarray", value: "[]" },
        { name: "showRowCounter", type: "boolarray", value: "[]" },
        { name: "rowCounterOffset", type: "array", value: "[]" },
        { name: "rowCounterFont", type: "font", value: "font:SmallestSystemFont" },
        { name: "rowCounterColor", type: "colorarray", value: "[]" },
        { name: "showRowCounterForShortRows", type: "bool", value: "true" },
        { name: "rowDecorationComponentName", type: "array", value: "[]" },
        { name: "rowFocusAnimationStyle", type: "string", value: FocusStyle.FixedFocusWrap },
        { name: "wrap", type: "boolean", value: "true" },
        { name: "drawFocusFeedbackOnTop", type: "boolean", value: "true" },
        { name: "rowSelected", type: "integer", value: "-1", alwaysNotify: true },
        { name: "rowFocused", type: "integer", value: "-1", alwaysNotify: true },
        { name: "rowUnfocused", type: "integer", value: "-1", alwaysNotify: true },
        { name: "rowItemSelected", type: "intarray", value: "[]", alwaysNotify: true },
        { name: "rowItemFocused", type: "intarray", value: "[]", alwaysNotify: true },
        { name: "scrollingStatus", type: "boolean", value: "false", alwaysNotify: true },
        { name: "rowsRendered", type: "intarray", value: "[]", alwaysNotify: true },
        { name: "rowItemsRendered", type: "intarray", value: "[]", alwaysNotify: true },
        { name: "currFocusRow", type: "float", value: "-1.0", alwaysNotify: true },
        { name: "jumpToRow", type: "integer", value: "-1", alwaysNotify: true },
        { name: "jumpToRowItem", type: "intarray", value: "[]", alwaysNotify: true },
        { name: "animateToRow", type: "integer", value: "-1", alwaysNotify: true },
        { name: "remainZoomedAboveFocus", type: "string", value: "focusIsAtTop" },
        { name: "fadeOutAboveFocus", type: "string", value: "focusIsAtTop" },
    ];

    protected readonly focusUri = "common:/images/focus_grid.9.png";
    // Margins only applies to the focus indicator
    protected readonly marginX: number;
    protected readonly marginY: number;
    protected readonly gap: number;
    protected readonly rowItemComps: Group[][] = [[]];
    protected readonly rowFocus: number[] = [];
    private readonly defaultAspectRatio = 16 / 9;
    private readonly defaultRowHeight: number;
    private readonly defaultRowZoomHeight: number;
    private readonly defaultItemSpacing: number;
    private readonly defaultRowSpacing: number;
    private readonly defaultItemYOffset: number;
    private readonly defaultItemZoomYOffset: number;
    private itemComponentErrorLogged = false;
    private nodeWidth: number;
    private rowWidth: number;
    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.ZoomRowList) {
        super([], name);
        this.setExtendsType(name, SGNodeType.ArrayGrid);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.setValueSilent("focusBitmapUri", new BrsString(this.focusUri));
        this.setValueSilent("wrapDividerBitmapUri", new BrsString(this.dividerUri));

        if (this.resolution === "FHD") {
            this.marginX = 18;
            this.marginY = 18;
            this.defaultRowHeight = 204;
            this.defaultRowZoomHeight = 321;
            this.defaultRowSpacing = 80;
            this.defaultItemSpacing = 21;
            this.setValueSilent("wrapDividerHeight", new Float(54));
        } else {
            this.marginX = 12;
            this.marginY = 12;
            this.defaultRowHeight = 214;
            this.defaultRowZoomHeight = 136;
            this.defaultRowSpacing = 53;
            this.defaultItemSpacing = 14;
            this.setValueSilent("wrapDividerHeight", new Float(36));
        }
        this.gap = this.marginX / 2;
        this.defaultItemYOffset = 0;
        this.defaultItemZoomYOffset = 0;
        this.hasNinePatch = true;
        this.focusField = "zoomRowListHasFocus";
        const rowFocusStyle = (this.getValueJS("rowFocusAnimationStyle") as string) ?? FocusStyle.FixedFocusWrap;
        this.wrap = rowFocusStyle.toLowerCase() === RowFocusStyleWrap;
        this.focusIndex = 0;
        this.rowFocus[0] = 0;
        this.nodeWidth = this.sceneRect.width;
        this.rowWidth = 0;
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "content") {
            super.setValue(index, value, alwaysNotify, kind);
            this.rowItemComps.length = 0;
            this.rowItemComps.push([]);
            this.refreshContent();
            if (this.content.length > 0) {
                this.setFocusedItem(0);
            }
            return;
        } else if (["jumptorow", "animatetorow"].includes(fieldName) && isNumberComp(value)) {
            const next = jsValueOf(value) as number;
            if (Number.isFinite(next) && next >= 0) {
                this.setFocusedRow(Math.floor(next));
            }
        } else if (fieldName === "jumptorowitem" && value instanceof RoArray) {
            const coords = jsValueOf(value) as any[];
            if (typeof coords[0] === "number" && typeof coords[1] === "number") {
                this.setFocusedItem(coords[0], coords[1]);
            }
        } else if (fieldName === "rowfocusanimationstyle" && value instanceof BrsString) {
            const style = value.toString().toLowerCase();
            if (!ValidFocusStyles.has(style)) {
                return;
            }
            this.wrap = style === RowFocusStyleWrap;
        } else if (fieldName === "wrap" && value instanceof BrsBoolean) {
            this.wrap = value.toBoolean();
        } else if (fieldName === "rowwidth" && isNumberComp(value)) {
            this.rowWidth = jsValueOf(value) as number;
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    protected setFocusedRow(rowIndex: number) {
        if (rowIndex < 0 || rowIndex >= this.content.length) {
            return;
        }
        this.setFocusedItem(rowIndex, this.rowFocus[rowIndex] ?? 0);
    }

    protected setFocusedItem(rowIndex: number, colIndex: number = -1) {
        if (this.content.length === 0) {
            return;
        }
        if (rowIndex < 0 || rowIndex >= this.content.length) {
            return;
        }
        const rowContent = this.getRowContent(rowIndex);
        const numCols = rowContent.length;
        if (colIndex === -1) {
            colIndex = this.rowFocus[rowIndex] ?? 0;
        }
        if (numCols > 0) {
            colIndex = Math.max(0, Math.min(colIndex, numCols - 1));
        } else {
            colIndex = 0;
        }
        const previousRow = this.focusIndex;
        if (previousRow !== rowIndex) {
            super.setValue("rowUnfocused", new Int32(previousRow));
        }
        this.focusIndex = rowIndex;
        this.rowFocus[rowIndex] = colIndex;
        this.currRow = rowIndex;
        super.setValue("rowFocused", new Int32(rowIndex));
        super.setValue("rowItemFocused", new RoArray([new Int32(rowIndex), new Int32(colIndex)]));
        super.setValue("currFocusRow", new Float(rowIndex));
    }

    protected handleUpDown(key: string) {
        let handled = false;
        let offset = 0;
        if (key === "up") {
            offset = -1;
        } else if (key === "down") {
            offset = 1;
        } else if (key === "rewind") {
            offset = -Math.min(this.content.length - 1, 6);
        } else if (key === "fastforward") {
            offset = Math.min(this.content.length - 1, 6);
        } else {
            return false;
        }
        let next = this.focusIndex + offset;
        if (this.wrap) {
            if (this.content.length === 0) {
                return false;
            }
            next = (next + this.content.length) % this.content.length;
        }
        if (next >= 0 && next < this.content.length) {
            super.setValue("scrollingStatus", BrsBoolean.True);
            this.focusIndex = next;
            this.rowFocus[next] ??= 0;
            this.setFocusedItem(next, this.rowFocus[next]);
            super.setValue("currFocusRow", new Float(next));
            handled = true;
        }
        super.setValue("scrollingStatus", BrsBoolean.False);
        return handled;
    }

    protected handlePageUpDown(key: string) {
        return this.handleUpDown(key);
    }

    protected handleLeftRight(key: string) {
        const offset = key === "left" ? -1 : 1;
        const currentRow = this.focusIndex;
        const rowContent = this.getRowContent(currentRow);
        const numCols = rowContent.length;
        if (numCols === 0) {
            return false;
        }
        this.rowFocus[currentRow] ??= 0;
        let nextCol = this.rowFocus[currentRow] + offset;
        const canWrapItems = this.canWrapItems(numCols, this.getRowMetrics(currentRow), this.nodeWidth);
        if (nextCol < 0) {
            nextCol = canWrapItems ? (numCols + nextCol) % numCols : 0;
        } else if (nextCol >= numCols) {
            nextCol = canWrapItems ? nextCol % numCols : numCols - 1;
        }
        if (nextCol !== this.rowFocus[currentRow]) {
            this.rowFocus[currentRow] = nextCol;
            super.setValue("rowItemFocused", new RoArray([new Int32(currentRow), new Int32(nextCol)]));
            super.setValue("scrollingStatus", BrsBoolean.True);
            super.setValue("scrollingStatus", BrsBoolean.False);
            return true;
        }
        return false;
    }

    protected handleOK(press: boolean) {
        if (press && this.focusIndex >= 0 && this.focusIndex < this.rowFocus.length) {
            const currentRow = this.focusIndex;
            const currentCol = this.rowFocus[currentRow] ?? 0;
            super.setValue("rowItemSelected", brsValueOf([currentRow, currentCol]));
            super.setValue("rowSelected", new Int32(currentRow));
            return true;
        }
        return false;
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
        const totalRows = this.content.length;
        const canWrap = this.canWrapRows(totalRows);
        const startRow = canWrap ? this.normalizeRowIndex(this.focusIndex) : this.clampRowIndex(this.focusIndex);

        this.currRow = startRow;
        let currentY = rect.y;
        let firstRenderedRow = -1;
        let lastRenderedRow = -1;
        const rowItemsRendered: Int32[] = [];

        for (let displayIndex = 0; displayIndex < totalRows; displayIndex++) {
            let rowIndex = canWrap ? this.normalizeRowIndex(startRow + displayIndex) : startRow + displayIndex;

            if (!canWrap && rowIndex >= totalRows) {
                break;
            }
            const metrics = this.getRowMetrics(rowIndex);
            const screenRight = this.sceneRect.x + this.sceneRect.width;
            this.nodeWidth = screenRight - rect.x;
            if (this.rowWidth <= 0) {
                this.refreshRowWidth(this.nodeWidth);
            }
            let rowTop = currentY;
            if (canWrap && rowIndex === 0 && displayIndex > 0) {
                rowTop -= metrics.spacingY * 0.3;
                const dividerRect = {
                    x: rect.x,
                    y: rowTop,
                    width: this.rowWidth,
                    height: Math.max(metrics.spacingY, 1),
                };
                const dividerHeight = this.renderWrapDivider(dividerRect, opacity, draw2D);
                rowTop += dividerHeight + metrics.spacingY * 0.3;
            }

            const rowRect = {
                x: rect.x,
                y: rowTop,
                width: this.rowWidth,
                height: metrics.rowHeight,
            };

            const triple = this.renderRow(interpreter, rowIndex, rowRect, metrics, rotation, opacity, draw2D);

            if (triple) {
                rowItemsRendered.push(new Int32(triple[0]), new Int32(triple[1]), new Int32(triple[2]));
            }

            firstRenderedRow = firstRenderedRow === -1 ? rowIndex : firstRenderedRow;
            lastRenderedRow = rowIndex;

            currentY = rowTop + metrics.rowHeight + metrics.spacingY;
            if (this.sceneRect.height > 0 && currentY > this.sceneRect.y + this.sceneRect.height) {
                break;
            }
        }

        if (firstRenderedRow !== -1) {
            const rowsRendered = new RoArray([new Int32(firstRenderedRow), new Int32(lastRenderedRow)]);
            this.setValueSilent("rowsRendered", rowsRendered);
        }
        if (rowItemsRendered.length) {
            this.setValueSilent("rowItemsRendered", new RoArray(rowItemsRendered));
        }
    }

    private validateRenderPrerequisites(): boolean {
        if (this.content.length === 0) {
            return false;
        }
        if (this.focusIndex < 0) {
            this.focusIndex = 0;
        }
        const itemCompName = this.getValueJS("itemComponentName") as string;
        if (!customNodeExists(itemCompName)) {
            if (!this.itemComponentErrorLogged) {
                const name = itemCompName.trim() || "missing 'itemComponentName'";
                BrsDevice.stderr.write(`error,[sg.zoomrowlist.create.fail] Failed to create item: ${name}`);
                this.itemComponentErrorLogged = true;
            }
            return false;
        }
        return true;
    }

    protected refreshContent() {
        this.content.length = 0;
        const content = this.getValue("content");
        if (!(content instanceof ContentNode)) {
            return;
        }
        const rows = this.getContentChildren(content);
        for (const [index, row] of rows.entries()) {
            const children = row.getNodeChildren();
            if (children.length === 0) {
                continue;
            }
            this.rowFocus[index] ??= 0;
            this.content.push(row);
        }

        if (this.content.length === 0) {
            this.focusIndex = 0;
            this.currRow = 0;
            return;
        }

        if (this.focusIndex >= this.content.length) {
            this.focusIndex = this.content.length - 1;
        }

        const canWrap = this.canWrapRows(this.content.length);
        this.currRow = canWrap ? this.normalizeRowIndex(this.focusIndex) : this.clampRowIndex(this.focusIndex);
    }

    private renderRow(
        interpreter: Interpreter,
        rowIndex: number,
        rect: Rect,
        metrics: RowMetrics,
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ): [number, number, number] | undefined {
        const rowContent = this.getRowContent(rowIndex);
        if (rowContent.length === 0) {
            return undefined;
        }

        const titleHeight = this.renderRowTitle(rowIndex, rect, this.nodeWidth, opacity, draw2D);
        const counterHeight = this.renderRowCounter(rowIndex, rect, metrics, this.nodeWidth, opacity, draw2D);
        const rowY = rect.y + Math.max(titleHeight, counterHeight) + metrics.itemYOffset;

        const itemRect: Rect = {
            x: rect.x,
            y: rowY,
            width: metrics.itemWidth,
            height: metrics.itemHeight,
        };

        const canWrapItems = this.canWrapItems(rowContent.length, metrics, this.nodeWidth);
        let startCol = canWrapItems ? this.rowFocus[rowIndex] ?? 0 : 0;
        const maxVisibleItems = this.getMaxVisibleItems(metrics.itemWidth, metrics.spacingX, this.nodeWidth);
        const endCol = canWrapItems ? rowContent.length : Math.min(startCol + maxVisibleItems, rowContent.length);

        let firstCol = -1;
        let lastCol = -1;

        for (let c = 0; c < (canWrapItems ? rowContent.length : endCol - startCol); c++) {
            let colIndex = startCol + c;
            if (canWrapItems && colIndex >= rowContent.length) {
                colIndex = colIndex % rowContent.length;
            }
            if (colIndex >= rowContent.length) {
                break;
            }

            this.renderRowItemComponent(
                interpreter,
                [rowIndex, colIndex],
                rowContent,
                itemRect,
                rotation,
                opacity,
                draw2D
            );

            firstCol = firstCol === -1 ? colIndex : firstCol;
            lastCol = colIndex;

            itemRect.x += itemRect.width + metrics.spacingX;
            if (itemRect.x > rect.x + this.nodeWidth) {
                break;
            }
        }

        if (firstCol !== -1) {
            return [rowIndex, firstCol, lastCol] as [number, number, number];
        }
        return undefined;
    }

    private getRowContent(rowIndex: number) {
        const rowNode = this.content[rowIndex];
        return this.getContentChildren(rowNode);
    }

    private getMaxVisibleItems(itemWidth: number, spacing: number, availableWidth: number, ceil: boolean = true) {
        if (itemWidth <= 0) {
            return 1;
        }
        const width = availableWidth > 0 ? availableWidth : this.sceneRect.width;
        if (width <= 0) {
            return 1;
        }
        if (ceil) {
            return Math.ceil((width + spacing) / (itemWidth + spacing));
        }
        return Math.floor((width + spacing) / (itemWidth + spacing));
    }

    private canWrapRows(displayRows: number): boolean {
        return this.wrap && displayRows > 0 && this.content.length >= displayRows;
    }

    private canWrapItems(numCols: number, metrics: RowMetrics, availableWidth: number) {
        const maxWidth = availableWidth > 0 ? availableWidth : this.sceneRect.width;
        const totalWidth = numCols * metrics.itemWidth + (numCols - 1) * metrics.spacingX;
        if (maxWidth > 0 && totalWidth <= maxWidth) {
            return false;
        }
        return true;
    }

    private normalizeRowIndex(index: number): number {
        const totalRows = this.content.length;
        if (totalRows === 0) {
            return 0;
        }
        let normalized = index % totalRows;
        if (normalized < 0) {
            normalized += totalRows;
        }
        return normalized;
    }

    private clampRowIndex(index: number): number {
        if (this.content.length === 0) {
            return 0;
        }
        return Math.max(0, Math.min(index, this.content.length - 1));
    }

    private getRowItemSpacing(rowIndex: number): number {
        const fallback: number = this.defaultItemSpacing;
        const spacingAfterRowItem = this.getValueJS("spacingAfterRowItem");
        if (Array.isArray(spacingAfterRowItem) && spacingAfterRowItem.length > 0) {
            const index = Math.min(rowIndex, spacingAfterRowItem.length - 1);
            const candidate = Number(spacingAfterRowItem[index]);
            if (Number.isFinite(candidate) && candidate > 0) {
                return candidate;
            }
        }
        return fallback;
    }

    private refreshRowWidth(interiorWidth: number) {
        const configured = this.getValueJS("rowWidth");
        if (typeof configured === "number" && configured > 0) {
            this.rowWidth = configured;
            return configured;
        }
        const itemHeight = this.resolveNumber(this.getValueJS("rowItemHeight"), 0, this.defaultRowHeight);
        const aspectRatio = this.resolveNumber(this.getValueJS("rowItemAspectRatio"), 0, this.defaultAspectRatio);
        const itemWidth = itemHeight * aspectRatio;
        const spacingX = this.getRowItemSpacing(0);
        const maxVisibleItems = this.getMaxVisibleItems(itemWidth, spacingX, interiorWidth, false);
        this.rowWidth = (itemWidth + spacingX) * maxVisibleItems;
        return this.rowWidth;
    }

    private getRowMetrics(rowIndex: number): RowMetrics {
        const focusPercent = this.focusIndex === rowIndex ? 1 : 0;
        const baseRowHeight = this.resolveNumber(this.getValueJS("rowHeight"), rowIndex, this.defaultRowHeight);
        const zoomRowHeight = this.resolveNumber(this.getValueJS("rowZoomHeight"), rowIndex, this.defaultRowZoomHeight);
        const rowHeight = this.lerp(baseRowHeight, zoomRowHeight, focusPercent);
        const baseItemHeight = this.resolveNumber(this.getValueJS("rowItemHeight"), rowIndex, this.defaultRowHeight);
        const zoomItemHeight = this.resolveNumber(
            this.getValueJS("rowItemZoomHeight"),
            rowIndex,
            this.defaultRowZoomHeight
        );
        const itemHeight = this.lerp(baseItemHeight, zoomItemHeight, focusPercent);
        const safeItemHeight = itemHeight > 0 ? itemHeight : Math.max(baseItemHeight, 1);
        const aspectRatio = this.resolveNumber(
            this.getValueJS("rowItemAspectRatio"),
            rowIndex,
            this.defaultAspectRatio
        );
        const spacingX = this.getRowItemSpacing(rowIndex);
        const rawSpacingAfterRow = this.getValueJS("spacingAfterRow") as number;
        const spacingY = rawSpacingAfterRow > 0 ? rawSpacingAfterRow : this.defaultRowSpacing;
        const offsetBase = this.resolveNumber(this.getValueJS("rowItemYOffset"), rowIndex, this.defaultItemYOffset);
        const offsetZoom = this.resolveNumber(
            this.getValueJS("rowItemZoomYOffset"),
            rowIndex,
            this.defaultItemZoomYOffset
        );
        const itemYOffset = this.lerp(offsetBase, offsetZoom, focusPercent);
        let effectiveAspect = aspectRatio > 0 ? aspectRatio : this.defaultAspectRatio;
        const useDefaultAspect = this.resolveBoolean(this.getValueJS("useDefaultAspectRatio"), rowIndex, true);
        if (!useDefaultAspect) {
            const rowChildren = this.getRowContent(rowIndex);
            if (rowChildren.length) {
                const firstAspect = rowChildren[0].getValueJS("aspectRatio");
                if (typeof firstAspect === "number" && firstAspect > 0) {
                    effectiveAspect = firstAspect;
                }
            }
        }
        const itemWidth = safeItemHeight * effectiveAspect;
        const enforcedRowHeight = Math.max(rowHeight, itemYOffset + safeItemHeight);

        return {
            rowHeight: enforcedRowHeight,
            itemHeight: safeItemHeight,
            itemWidth,
            spacingX,
            spacingY,
            itemYOffset,
            focusPercent,
        };
    }

    protected renderRowItemComponent(
        interpreter: Interpreter,
        itemVector: number[],
        cols: ContentNode[],
        itemRect: Rect,
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        const rowIndex = itemVector[0];
        const colIndex = itemVector[1];
        const content = cols[colIndex];
        const nodeFocus = sgRoot.focused === this;
        const focused = this.focusIndex === rowIndex && this.rowFocus[rowIndex] === colIndex;

        if (!this.rowItemComps[rowIndex]?.[colIndex]) {
            const itemComp = this.createItemComponent(interpreter, itemRect, content);
            this.rowItemComps[rowIndex] ??= [];
            if (itemComp instanceof Group) {
                this.rowItemComps[rowIndex][colIndex] = itemComp;
            }
        }
        if (content.changed) {
            this.rowItemComps[rowIndex][colIndex].setValue("itemContent", content, true);
            content.changed = false;
        }

        const itemComp = this.rowItemComps[rowIndex][colIndex];
        if (itemComp) {
            itemComp.setValue("itemHasFocus", BrsBoolean.from(focused));
            itemComp.setValue("focusPercent", new Float(focused ? 1 : 0));
            itemComp.setValue("rowHasFocus", BrsBoolean.from(this.focusIndex === rowIndex));
            itemComp.setValue("rowFocusPercent", new Float(this.focusIndex === rowIndex ? 1 : 0));
            itemComp.setValue(this.focusField, BrsBoolean.from(nodeFocus));
            itemComp.setValueSilent("width", brsValueOf(itemRect.width));
            itemComp.setValueSilent("height", brsValueOf(itemRect.height));
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

    private renderRowTitle(rowIndex: number, rect: Rect, interiorWidth: number, opacity: number, draw2D?: IfDraw2D) {
        const show = this.resolveBoolean(this.getValueJS("showRowTitle"), rowIndex, true);
        if (!show) {
            return 0;
        }
        const row = this.content[rowIndex];
        const title = row.getValueJS("title") ?? "";
        if (!title) {
            return 0;
        }
        const rawOffsets = this.getValueJS("rowTitleOffset") as number[][];
        const offset = this.resolveVector(rawOffsets, rowIndex, [0, 0]);
        const color = this.resolveColor(this.getValueJS("rowTitleColor"), rowIndex, 0xffffffff);
        const fontValue = this.getValue("rowTitleFont");
        if (!(fontValue instanceof Font)) {
            return 0;
        }
        const drawFont = fontValue.createDrawFont();
        if (!(drawFont instanceof RoFont)) {
            return 0;
        }
        const textRect = {
            x: rect.x + offset[0],
            y: rect.y + offset[1],
            width: interiorWidth,
            height: drawFont.measureTextHeight() + this.gap,
        };
        this.drawText(title, fontValue, color, opacity, textRect, "left", "top", 0, draw2D, "", rowIndex + 1);
        return textRect.height + offset[1];
    }

    private renderRowCounter(
        rowIndex: number,
        rect: Rect,
        metrics: RowMetrics,
        interiorWidth: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        const show = this.resolveBoolean(this.getValueJS("showRowCounter"), rowIndex, false);
        const row = this.content[rowIndex];
        const items = row.getNodeChildren().length;
        if (!show && rowIndex !== this.focusIndex) {
            return 0;
        }
        if (items === 0) {
            return 0;
        }
        const showShortRows = (this.getValueJS("showRowCounterForShortRows") as boolean) ?? true;
        const totalWidth = items * metrics.itemWidth + (items - 1) * metrics.spacingX;
        if (!showShortRows && totalWidth < interiorWidth) {
            return 0;
        }
        const rawOffsets = this.getValueJS("rowCounterOffset");
        const offset = this.resolveVector(rawOffsets, rowIndex, [0, 0]);
        const color = this.resolveColor(this.getValueJS("rowCounterColor"), rowIndex, 0xffffffff);
        const counterFontValue = this.getValue("rowCounterFont");
        let fontToUse: Font | undefined;
        if (counterFontValue instanceof Font) {
            fontToUse = counterFontValue;
        } else {
            const titleFont = this.getValue("rowTitleFont");
            if (titleFont instanceof Font) {
                fontToUse = titleFont;
            }
        }
        if (!fontToUse) {
            return 0;
        }
        const drawFont = fontToUse.createDrawFont();
        if (!(drawFont instanceof RoFont)) {
            return 0;
        }
        const counterText = `${this.rowFocus[rowIndex] + 1} of ${items}`;
        const textRect = {
            x: rect.x,
            y: rect.y + offset[1],
            width: offset[0] || this.rowWidth,
            height: drawFont.measureTextHeight() + this.gap,
        };
        this.drawText(counterText, fontToUse, color, opacity, textRect, "right", "top", 0, draw2D, "", 0);
        return textRect.height + offset[1];
    }

    private lerp(a: number, b: number, t: number) {
        if (!Number.isFinite(a) && Number.isFinite(b)) {
            return b;
        }
        if (Number.isFinite(a) && !Number.isFinite(b)) {
            return a;
        }
        if (!Number.isFinite(a) && !Number.isFinite(b)) {
            return 0;
        }
        return a + (b - a) * t;
    }
}
