import {
    BrsBoolean,
    BrsInvalid,
    BrsString,
    BrsType,
    brsValueOf,
    ContentNode,
    customNodeExists,
    Float,
    Font,
    Group,
    Int32,
    isBrsNumber,
    isBrsString,
    jsValueOf,
    RoArray,
    sgRoot,
} from "..";
import { BrsDevice } from "../../device/BrsDevice";
import { Interpreter } from "../../interpreter";
import { AAMember } from "../components/RoAssociativeArray";
import { IfDraw2D, Rect } from "../interfaces/IfDraw2D";
import { ArrayGrid } from "./ArrayGrid";
import { FieldKind, FieldModel } from "./Field";

interface RowMetrics {
    rowHeight: number;
    itemHeight: number;
    itemWidth: number;
    spacingX: number;
    spacingY: number;
    itemYOffset: number;
    focusPercent: number;
}

export class ZoomRowList extends ArrayGrid {
    readonly defaultFields: FieldModel[] = [
        { name: "itemComponentName", type: "string", value: "" },
        { name: "numRows", type: "integer", value: "12" },
        { name: "numColumns", type: "integer", value: "1" },
        { name: "rowWidth", type: "float", value: "0.0" },
        { name: "rowHeight", type: "floatarray", value: "[]" },
        { name: "rowZoomHeight", type: "floatarray", value: "[]" },
        { name: "spacingAfterRow", type: "float", value: "0.0" },
        { name: "rowItemSpacing", type: "array", value: "[]" },
        { name: "rowItemYOffset", type: "array", value: "[]" },
        { name: "rowItemZoomYOffset", type: "array", value: "[]" },
        { name: "rowItemHeight", type: "floatarray", value: "[]" },
        { name: "rowItemZoomHeight", type: "floatarray", value: "[]" },
        { name: "rowItemAspectRatio", type: "floatarray", value: "[]" },
        { name: "spacingAfterRowItem", type: "floatarray", value: "[]" },
        { name: "useDefaultAspectRatio", type: "boolarray", value: "[]" },
        { name: "showRowTitle", type: "boolarray", value: "[]" },
        { name: "rowTitleOffset", type: "array", value: "[]" },
        { name: "rowTitleFont", type: "font" },
        { name: "rowTitleColor", type: "array", value: "[]" },
        { name: "showRowCounter", type: "boolarray", value: "[]" },
        { name: "rowCounterOffset", type: "array", value: "[]" },
        { name: "rowCounterFont", type: "font" },
        { name: "rowCounterColor", type: "array", value: "[]" },
        { name: "showRowCounterForShortRows", type: "bool", value: "true" },
        { name: "rowDecorationComponentName", type: "array", value: "[]" },
        { name: "rowFocusAnimationStyle", type: "string", value: "fixedFocusWrap" },
        { name: "wrap", type: "boolean", value: "true" },
        { name: "rowSelected", type: "integer", value: "-1", alwaysNotify: true },
        { name: "rowFocused", type: "integer", value: "-1", alwaysNotify: true },
        { name: "rowUnfocused", type: "integer", value: "-1", alwaysNotify: true },
        { name: "rowItemSelected", type: "array", value: "[]", alwaysNotify: true },
        { name: "rowItemFocused", type: "array", value: "[]", alwaysNotify: true },
        { name: "scrollingStatus", type: "boolean", value: "false", alwaysNotify: true },
        { name: "rowsRendered", type: "array", value: "[]", alwaysNotify: true },
        { name: "rowItemsRendered", type: "array", value: "[]", alwaysNotify: true },
        { name: "currFocusRow", type: "float", value: "-1.0", alwaysNotify: true },
        { name: "jumpToRow", type: "integer", value: "-1", alwaysNotify: true },
        { name: "jumpToRowItem", type: "array", value: "[]", alwaysNotify: true },
        { name: "animateToRow", type: "integer", value: "-1", alwaysNotify: true },
        { name: "remainZoomedAboveFocus", type: "string", value: "focusIsAtTop" },
        { name: "fadeOutAboveFocus", type: "string", value: "focusIsAtTop" },
    ];

    protected readonly focusUri = "common:/images/focus_grid.9.png";
    protected readonly marginX: number;
    protected readonly marginY: number;
    protected readonly rowItemComps: Group[][] = [[]];
    protected readonly rowFocus: number[] = [];
    protected readonly rowScrollOffset: number[] = [];
    private readonly defaultAspectRatio = 1.7777778;
    private readonly defaultRowHeight: number;
    private readonly defaultRowZoomHeight: number;
    private readonly defaultItemHeight: number;
    private readonly defaultItemZoomHeight: number;
    private readonly defaultItemSpacing: number;
    private readonly defaultRowSpacing: number;
    private readonly defaultItemYOffset: number;
    private readonly defaultItemZoomYOffset: number;
    private readonly defaultRowTitleOffset: number[];
    private readonly titleHeight: number;
    private readonly counterRightInset: number;
    private rowFocusStyle: string = "fixedfocuswrap";

    constructor(initializedFields: AAMember[] = [], readonly name: string = "ZoomRowList") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.setFieldValue("focusBitmapUri", new BrsString(this.focusUri));
        this.setFieldValue("wrapDividerBitmapUri", new BrsString(this.dividerUri));

        if (this.resolution === "FHD") {
            this.marginX = 15;
            this.marginY = 15;
        } else {
            this.marginX = 10;
            this.marginY = 10;
        }
        const heightScale = this.sceneRect.height > 0 ? this.sceneRect.height / 720 : 1;
        const fontValue = this.getFieldValue("rowTitleFont");
        let measuredTitleHeight = this.resolution === "FHD" ? 36 : 24;
        if (fontValue instanceof Font) {
            measuredTitleHeight = fontValue.createDrawFont().measureTextHeight();
        }
        this.titleHeight = measuredTitleHeight;
        this.defaultRowHeight = Math.max(1, Math.round(220 * heightScale));
        this.defaultRowZoomHeight = Math.max(this.defaultRowHeight + 1, Math.round(320 * heightScale));
        this.defaultItemHeight = Math.max(1, Math.round(170 * heightScale));
        this.defaultItemZoomHeight = Math.max(this.defaultItemHeight + 1, Math.round(250 * heightScale));
        this.defaultItemSpacing = Math.max(12, Math.round(20 * heightScale));
        this.defaultRowSpacing = Math.max(this.marginY * 2, Math.round(48 * heightScale));
        const baseTitleGap = 0;
        const zoomExtraGap = Math.max(6, Math.round(10 * heightScale));
        this.defaultRowTitleOffset = [this.marginX, 0];
        this.defaultItemYOffset = baseTitleGap;
        this.defaultItemZoomYOffset = zoomExtraGap;
        this.counterRightInset = Math.max(this.marginX * 2, Math.round(72 * heightScale));
        const configuredSpacing = this.getFieldValueJS("itemSpacing") as number[];
        if (
            !Array.isArray(configuredSpacing) ||
            configuredSpacing.length < 2 ||
            (configuredSpacing[0] === 0 && configuredSpacing[1] === 0)
        ) {
            this.setFieldValue("itemSpacing", brsValueOf([this.defaultItemSpacing, this.defaultRowSpacing]));
        }
        this.hasNinePatch = true;
        this.focusField = "zoomRowListHasFocus";
        this.numRows = this.getFieldValueJS("numRows") as number;
        this.numCols = this.getFieldValueJS("numColumns") as number;
        const wrapField = this.getFieldValueJS("wrap");
        this.wrap = typeof wrapField === "boolean" ? wrapField : true;
        const vertStyleRaw = (this.getFieldValueJS("vertFocusAnimationStyle") as string) ?? "fixedFocus";
        const configuredRowStyle = (this.getFieldValueJS("rowFocusAnimationStyle") as string) ?? "fixedFocus";
        this.rowFocusStyle = this.wrap
            ? "fixedfocuswrap"
            : configuredRowStyle.toLowerCase() || vertStyleRaw.toLowerCase();

        this.focusIndex = 0;
        this.rowFocus[0] = 0;
        this.rowScrollOffset[0] = 0;
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.getValue().toLowerCase();
        if (fieldName === "jumptorow" && isBrsNumber(value)) {
            const next = jsValueOf(value) as number;
            if (Number.isFinite(next) && next >= 0) {
                this.setFocusedRow(Math.floor(next));
            }
        } else if (fieldName === "animatetorow" && isBrsNumber(value)) {
            const next = jsValueOf(value) as number;
            if (Number.isFinite(next) && next >= 0) {
                this.setFocusedRow(Math.floor(next));
            }
        } else if (fieldName === "jumptorowitem" && value instanceof RoArray) {
            const coords = jsValueOf(value) as any[];
            if (typeof coords[0] === "number" && typeof coords[1] === "number") {
                this.setFocusedItem(coords[0], coords[1]);
            }
        } else if (fieldName === "rowfocusanimationstyle" && isBrsString(value)) {
            const style = value.toString().toLowerCase();
            if (!["fixedfocuswrap", "floatingfocus", "fixedfocus"].includes(style)) {
                return BrsInvalid.Instance;
            }
            this.rowFocusStyle = style;
            if (style === "fixedfocuswrap") {
                this.wrap = true;
            }
        } else if (fieldName === "wrap") {
            const boolValue = Boolean(jsValueOf(value));
            this.wrap = boolValue;
            if (!this.wrap && this.rowFocusStyle === "fixedfocuswrap") {
                this.rowFocusStyle = "fixedfocus";
            }
        }
        return super.set(index, value, alwaysNotify, kind);
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
            super.set(new BrsString("itemUnfocused"), new Int32(previousRow));
            super.set(new BrsString("rowUnfocused"), new Int32(previousRow));
        }
        this.focusIndex = rowIndex;
        this.rowFocus[rowIndex] = colIndex;
        this.rowScrollOffset[rowIndex] ??= 0;
        const metrics = this.getRowMetrics(rowIndex);
        this.updateRowScrollOffset(rowIndex, colIndex, metrics, rowContent.length);
        this.currRow = rowIndex;
        super.set(new BrsString("itemFocused"), new Int32(rowIndex));
        super.set(new BrsString("rowFocused"), new Int32(rowIndex));
        super.set(new BrsString("rowItemFocused"), new RoArray([new Int32(rowIndex), new Int32(colIndex)]));
        super.set(new BrsString("currFocusRow"), new Float(rowIndex));
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
            this.setFieldValue("scrollingStatus", BrsBoolean.True);
            this.focusIndex = next;
            this.rowFocus[next] ??= 0;
            this.setFocusedItem(next, this.rowFocus[next]);
            super.set(new BrsString("currFocusRow"), new Float(next));
            handled = true;
        }
        this.setFieldValue("scrollingStatus", BrsBoolean.False);
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
        if (nextCol < 0) {
            nextCol = this.wrap ? (numCols + nextCol) % numCols : 0;
        } else if (nextCol >= numCols) {
            nextCol = this.wrap ? nextCol % numCols : numCols - 1;
        }
        if (nextCol !== this.rowFocus[currentRow]) {
            this.rowFocus[currentRow] = nextCol;
            const metrics = this.getRowMetrics(currentRow);
            this.updateRowScrollOffset(currentRow, nextCol, metrics, numCols);
            super.set(new BrsString("rowItemFocused"), new RoArray([new Int32(currentRow), new Int32(nextCol)]));
            this.setFieldValue("scrollingStatus", BrsBoolean.True);
            this.setFieldValue("scrollingStatus", BrsBoolean.False);
            return true;
        }
        return false;
    }

    protected handleOK(press: boolean) {
        if (press && this.focusIndex >= 0 && this.focusIndex < this.rowFocus.length) {
            const currentRow = this.focusIndex;
            const currentCol = this.rowFocus[currentRow] ?? 0;
            this.set(new BrsString("rowItemSelected"), brsValueOf([currentRow, currentCol]));
            this.set(new BrsString("rowSelected"), new Int32(currentRow));
        }
        return false;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();

        const rect = { x: drawTrans[0], y: drawTrans[1], ...this.getDimensions() };
        this.renderContent(interpreter, rect, rotation, opacity, draw2D);
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateParentRects(origin, angle);
        this.isDirty = false;
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

        this.rowFocusStyle = (
            (this.getFieldValueJS("rowFocusAnimationStyle") as string) ?? this.rowFocusStyle
        ).toLowerCase();

        const totalRows = this.content.length;
        const displayRows = this.getDisplayRowCount(totalRows);
        if (displayRows === 0) {
            return;
        }

        const canWrap = this.canWrapRows(displayRows);
        const startRow = canWrap ? this.normalizeRowIndex(this.focusIndex) : this.clampRowIndex(this.focusIndex);

        this.currRow = startRow;
        let currentY = rect.y;
        let firstRenderedRow = -1;
        let lastRenderedRow = -1;
        const rowItemsRendered: Int32[] = [];

        for (let displayIndex = 0; displayIndex < displayRows; displayIndex++) {
            let rowIndex = canWrap ? this.normalizeRowIndex(startRow + displayIndex) : startRow + displayIndex;

            if (!canWrap && rowIndex >= totalRows) {
                break;
            }
            const metrics = this.getRowMetrics(rowIndex);
            const rowWidth = this.getRowWidthFallback(rect.width);
            const rowLeft = rect.x + this.marginX;
            const screenRight = this.sceneRect.x + this.sceneRect.width;
            let interiorWidth = rowWidth - this.marginX * 2;
            if (interiorWidth <= 0) {
                interiorWidth = rowWidth > 0 ? rowWidth : this.sceneRect.width;
            }
            if (screenRight > rowLeft) {
                interiorWidth = Math.min(interiorWidth, screenRight - rowLeft);
            }
            if (interiorWidth <= 0) {
                interiorWidth = metrics.itemWidth;
            }
            let rowTop = currentY;
            if (canWrap && rowIndex === 0 && displayIndex > 0) {
                rowTop -= metrics.spacingY;
                const dividerRect = {
                    x: rect.x,
                    y: rowTop,
                    width: rowWidth,
                    height: Math.max(metrics.spacingY, 1),
                };
                const dividerHeight = this.renderWrapDivider(dividerRect, opacity, draw2D);
                rowTop += dividerHeight + metrics.spacingY;
            }

            const rowRect = {
                x: rect.x,
                y: rowTop,
                width: rowWidth,
                height: metrics.rowHeight,
            };

            const triple = this.renderRow(
                interpreter,
                rowIndex,
                rowRect,
                metrics,
                rowWidth,
                interiorWidth,
                rotation,
                opacity,
                draw2D
            );

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
            this.setFieldValue("rowsRendered", rowsRendered);
        }
        if (rowItemsRendered.length) {
            this.setFieldValue("rowItemsRendered", new RoArray(rowItemsRendered));
        }
    }

    private validateRenderPrerequisites(): boolean {
        if (this.content.length === 0) {
            return false;
        }
        if (this.focusIndex < 0) {
            this.focusIndex = 0;
        }
        const itemCompName = this.getFieldValueJS("itemComponentName") as string;
        if (!customNodeExists(new BrsString(itemCompName))) {
            BrsDevice.stderr.write(`warning,[sg.zoomrowlist.create.fail] Failed to create item ${itemCompName}`);
            return false;
        }
        return true;
    }

    protected refreshContent() {
        this.content.length = 0;
        const content = this.getFieldValue("content");
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
            this.rowScrollOffset[index] ??= 0;
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

        const displayRows = this.getDisplayRowCount();
        const canWrap = this.canWrapRows(displayRows);
        this.currRow = canWrap ? this.normalizeRowIndex(this.focusIndex) : this.clampRowIndex(this.focusIndex);
    }

    private renderRow(
        interpreter: Interpreter,
        rowIndex: number,
        rect: Rect,
        metrics: RowMetrics,
        rowWidth: number,
        interiorWidth: number,
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ): [number, number, number] | undefined {
        const rowContent = this.getRowContent(rowIndex);
        if (rowContent.length === 0) {
            return undefined;
        }

        const titleHeight = this.renderRowTitle(rowIndex, rect, metrics, rowWidth, interiorWidth, opacity, draw2D);
        const counterHeight = this.renderRowCounter(rowIndex, rect, metrics, rowWidth, interiorWidth, opacity, draw2D);
        const rowY = rect.y + Math.max(titleHeight, counterHeight) + metrics.itemYOffset;

        const itemRect: Rect = {
            x: rect.x + this.marginX,
            y: rowY,
            width: metrics.itemWidth,
            height: metrics.itemHeight,
        };

        const renderMode = this.determineRenderMode(rowIndex, rowContent.length, metrics, interiorWidth);
        let startCol = this.getStartColumn(rowIndex, rowContent.length, renderMode);
        const maxVisibleItems = this.getMaxVisibleItems(metrics.itemWidth, metrics.spacingX, interiorWidth);
        if (renderMode === "scroll") {
            const maxStart = Math.max(rowContent.length - maxVisibleItems, 0);
            startCol = Math.max(0, Math.min(startCol, maxStart));
            this.rowScrollOffset[rowIndex] = startCol;
        }
        const endCol =
            renderMode === "wrap" ? rowContent.length : Math.min(startCol + maxVisibleItems, rowContent.length);

        let firstCol = -1;
        let lastCol = -1;

        for (let c = 0; c < (renderMode === "wrap" ? rowContent.length : endCol - startCol); c++) {
            let colIndex = startCol + c;
            if (renderMode === "wrap" && colIndex >= rowContent.length) {
                colIndex = colIndex % rowContent.length;
            }
            if (colIndex >= rowContent.length) {
                break;
            }

            this.renderRowItemComponent(
                interpreter,
                rowIndex,
                colIndex,
                rowContent,
                itemRect,
                rotation,
                opacity,
                draw2D
            );

            firstCol = firstCol === -1 ? colIndex : firstCol;
            lastCol = colIndex;

            itemRect.x += itemRect.width + metrics.spacingX;
            if (itemRect.x > rect.x + this.marginX + interiorWidth) {
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

    private determineRenderMode(rowIndex: number, numCols: number, metrics: RowMetrics, availableWidth: number) {
        const maxWidth = availableWidth > 0 ? availableWidth : this.sceneRect.width;
        const totalWidth = numCols * metrics.itemWidth + (numCols - 1) * metrics.spacingX;
        if (maxWidth > 0 && totalWidth <= maxWidth) {
            return "fit";
        }
        const configuredStyle = (this.getFieldValueJS("rowFocusAnimationStyle") as string)?.toLowerCase();
        const style = this.wrap ? "fixedfocuswrap" : configuredStyle ?? "fixedfocus";
        if (style === "fixedfocuswrap") {
            return "wrap";
        }
        return "scroll";
    }

    private getStartColumn(rowIndex: number, numCols: number, mode: string) {
        if (mode === "fit") {
            return 0;
        } else if (mode === "wrap") {
            return this.rowFocus[rowIndex] ?? 0;
        }
        this.rowScrollOffset[rowIndex] ??= 0;
        return this.rowScrollOffset[rowIndex];
    }

    private getMaxVisibleItems(itemWidth: number, spacing: number, availableWidth: number) {
        if (itemWidth <= 0) {
            return 1;
        }
        const width = availableWidth > 0 ? availableWidth : this.sceneRect.width;
        if (width <= 0) {
            return 1;
        }
        return Math.ceil((width + spacing) / (itemWidth + spacing));
    }

    private updateRowScrollOffset(
        rowIndex: number,
        colIndex: number,
        metrics: RowMetrics | undefined,
        numCols: number
    ) {
        const safeMetrics = metrics ?? this.getRowMetrics(rowIndex);
        let availableWidth = this.getRowWidthFallback();
        availableWidth = availableWidth > 0 ? availableWidth - this.marginX * 2 : this.sceneRect.width;
        if (availableWidth <= 0) {
            availableWidth = this.sceneRect.width;
        }
        const mode = this.determineRenderMode(rowIndex, numCols, safeMetrics, availableWidth);
        if (mode !== "scroll") {
            this.rowScrollOffset[rowIndex] = 0;
            return;
        }
        const maxVisible = Math.max(
            1,
            this.getMaxVisibleItems(safeMetrics.itemWidth, safeMetrics.spacingX, availableWidth)
        );
        const maxStart = Math.max(numCols - maxVisible, 0);
        let offset = this.rowScrollOffset[rowIndex] ?? 0;
        if (colIndex < offset) {
            offset = colIndex;
        } else if (colIndex >= offset + maxVisible) {
            offset = colIndex - maxVisible + 1;
        }
        offset = Math.max(0, Math.min(offset, maxStart));
        this.rowScrollOffset[rowIndex] = offset;
    }

    private getDisplayRowCount(totalRows: number = this.content.length): number {
        if (totalRows === 0) {
            return 0;
        }
        const configured = this.numRows || totalRows;
        if (configured <= 0) {
            return Math.min(totalRows, 1);
        }
        return Math.min(configured, totalRows);
    }

    private canWrapRows(displayRows: number): boolean {
        return this.wrap && displayRows > 0 && this.content.length >= displayRows;
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

    private getRowItemSpacing(rowIndex: number): [number, number] {
        const fallback: [number, number] = [this.defaultItemSpacing, this.defaultRowSpacing];
        const rowItemSpacing = this.getFieldValueJS("rowItemSpacing") as number[][];
        if (Array.isArray(rowItemSpacing) && rowItemSpacing.length > 0) {
            const index = Math.min(rowIndex, rowItemSpacing.length - 1);
            const candidate = rowItemSpacing[index];
            if (Array.isArray(candidate) && candidate.length >= 2) {
                const spacingX = Number(candidate[0]);
                const spacingY = Number(candidate[1]);
                return [spacingX > 0 ? spacingX : fallback[0], spacingY > 0 ? spacingY : fallback[1]];
            }
        }
        const itemSpacing = this.getFieldValueJS("itemSpacing") as number[];
        if (Array.isArray(itemSpacing) && itemSpacing.length >= 2) {
            const spacingX = Number(itemSpacing[0]);
            const spacingY = Number(itemSpacing[1]);
            return [spacingX > 0 ? spacingX : fallback[0], spacingY > 0 ? spacingY : fallback[1]];
        }
        const spacingOverride = this.getFieldValueJS("spacingAfterRowItem");
        if (Array.isArray(spacingOverride) && spacingOverride.length > 0) {
            const index = Math.min(rowIndex, spacingOverride.length - 1);
            const candidate = Number(spacingOverride[index]);
            if (Number.isFinite(candidate) && candidate > 0) {
                return [candidate, fallback[1]];
            }
        } else if (typeof spacingOverride === "number" && spacingOverride > 0) {
            return [spacingOverride, fallback[1]];
        }
        return fallback;
    }

    private getRowWidthFallback(rectWidth?: number): number {
        const configured = this.getFieldValueJS("rowWidth");
        if (typeof configured === "number" && configured > 0) {
            return configured;
        }
        if (typeof rectWidth === "number" && rectWidth > 0) {
            return rectWidth;
        }
        const widthField = this.getFieldValueJS("width");
        if (typeof widthField === "number" && widthField > 0) {
            return widthField;
        }
        if (this.sceneRect.width > 0) {
            return this.sceneRect.width;
        }
        const estimated = this.defaultItemZoomHeight * this.defaultAspectRatio * 5 + this.marginX * 2;
        return Math.max(estimated, this.defaultItemHeight * this.defaultAspectRatio * 3 + this.marginX * 2);
    }

    private getRowMetrics(rowIndex: number): RowMetrics {
        const focusPercent = this.focusIndex === rowIndex ? 1 : 0;
        const baseRowHeight = this.resolveNumber(this.getFieldValueJS("rowHeight"), rowIndex, this.defaultRowHeight);
        const zoomRowHeight = this.resolveNumber(
            this.getFieldValueJS("rowZoomHeight"),
            rowIndex,
            this.defaultRowZoomHeight
        );
        const rowHeight = this.lerp(baseRowHeight, zoomRowHeight, focusPercent);
        const baseItemHeight = this.resolveNumber(
            this.getFieldValueJS("rowItemHeight"),
            rowIndex,
            this.defaultItemHeight
        );
        const zoomItemHeight = this.resolveNumber(
            this.getFieldValueJS("rowItemZoomHeight"),
            rowIndex,
            this.defaultItemZoomHeight
        );
        const itemHeight = this.lerp(baseItemHeight, zoomItemHeight, focusPercent);
        const safeItemHeight = itemHeight > 0 ? itemHeight : Math.max(baseItemHeight, 1);
        const aspectRatio = this.resolveNumber(
            this.getFieldValueJS("rowItemAspectRatio"),
            rowIndex,
            this.defaultAspectRatio
        );
        const spacing = this.getRowItemSpacing(rowIndex);
        const spacingX = spacing[0];
        const rawSpacingAfterRow = this.getFieldValueJS("spacingAfterRow");
        const spacingY =
            typeof rawSpacingAfterRow === "number" && rawSpacingAfterRow > 0
                ? rawSpacingAfterRow
                : Math.max(spacing[1], this.defaultRowSpacing);
        const offsetBase = this.resolveNumber(
            this.getFieldValueJS("rowItemYOffset"),
            rowIndex,
            this.defaultItemYOffset
        );
        const offsetZoom = this.resolveNumber(
            this.getFieldValueJS("rowItemZoomYOffset"),
            rowIndex,
            this.defaultItemZoomYOffset
        );
        const itemYOffset = this.lerp(offsetBase, offsetZoom, focusPercent);
        let effectiveAspect = aspectRatio > 0 ? aspectRatio : this.defaultAspectRatio;
        const useDefaultAspect = this.resolveBoolean(this.getFieldValueJS("useDefaultAspectRatio"), rowIndex, true);
        if (!useDefaultAspect) {
            const rowChildren = this.getRowContent(rowIndex);
            if (rowChildren.length) {
                const firstAspect = rowChildren[0].getFieldValueJS("aspectRatio");
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
        const focused = this.focusIndex === rowIndex && this.rowFocus[rowIndex] === colIndex;

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

        const itemComp = this.rowItemComps[rowIndex][colIndex];
        if (itemComp) {
            itemComp.set(new BrsString("itemHasFocus"), BrsBoolean.from(focused));
            itemComp.set(new BrsString("focusPercent"), new Float(focused ? 1 : 0));
            itemComp.set(new BrsString("rowHasFocus"), BrsBoolean.from(this.focusIndex === rowIndex));
            itemComp.set(new BrsString("rowFocusPercent"), new Float(this.focusIndex === rowIndex ? 1 : 0));
            itemComp.set(new BrsString(this.focusField), BrsBoolean.from(nodeFocus));
            itemComp.setFieldValue("width", brsValueOf(itemRect.width));
            itemComp.setFieldValue("height", brsValueOf(itemRect.height));
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

    private resolveNumber(values: any, index: number, fallback: number) {
        if (!Array.isArray(values) || values.length === 0) {
            return fallback;
        }
        if (index < values.length) {
            const value = Number(values[index]);
            return Number.isFinite(value) && value > 0 ? value : fallback;
        }
        const lastValue = Number(values[values.length - 1]);
        return Number.isFinite(lastValue) && lastValue > 0 ? lastValue : fallback;
    }

    private renderRowTitle(
        rowIndex: number,
        rect: Rect,
        metrics: RowMetrics,
        rowWidth: number,
        interiorWidth: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        const show = this.resolveBoolean(this.getFieldValueJS("showRowTitle"), rowIndex, true);
        if (!show) {
            return 0;
        }
        const row = this.content[rowIndex];
        const title = row.getFieldValueJS("title") ?? "";
        if (!title) {
            return 0;
        }
        const rawOffsets = this.getFieldValueJS("rowTitleOffset") as number[][];
        const offset = this.resolveVector(rawOffsets, rowIndex, this.defaultRowTitleOffset);
        const color = this.resolveColor(this.getFieldValueJS("rowTitleColor"), rowIndex, 0xffffffff);
        const fontValue = this.getFieldValue("rowTitleFont");
        if (!(fontValue instanceof Font)) {
            return 0;
        }
        const drawFont = fontValue.createDrawFont();
        const configuredRowWidth = rowWidth > 0 ? rowWidth : this.getRowWidthFallback(rowWidth);
        let availableInterior = interiorWidth;
        if (!Number.isFinite(availableInterior) || availableInterior <= 0) {
            availableInterior = Math.max(configuredRowWidth - this.marginX * 2, metrics.itemWidth);
        }
        const baseX = rect.x + this.marginX + (offset[0] ?? 0);
        const rightEdge = rect.x + this.marginX + availableInterior;
        const availableWidth = Math.max(rightEdge - baseX, metrics.itemWidth);
        const textRect = {
            x: baseX,
            y: rect.y + (offset[1] ?? 0),
            width: availableWidth,
            height: drawFont.measureTextHeight(),
        };
        this.drawText(title, fontValue, color, opacity, textRect, "left", "center", 0, draw2D, "...", rowIndex);
        return textRect.height + (offset[1] ?? 0);
    }

    private renderRowCounter(
        rowIndex: number,
        rect: Rect,
        metrics: RowMetrics,
        rowWidth: number,
        interiorWidth: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        const show = this.resolveBoolean(this.getFieldValueJS("showRowCounter"), rowIndex, false);
        const row = this.content[rowIndex];
        const items = row.getNodeChildren().length;
        if (!show && rowIndex !== this.focusIndex) {
            return 0;
        }
        if (items === 0) {
            return 0;
        }
        const showShortRows = (this.getFieldValueJS("showRowCounterForShortRows") as boolean) ?? true;
        const configuredRowWidth = rowWidth > 0 ? rowWidth : this.getRowWidthFallback(rowWidth);
        let availableInterior = interiorWidth;
        if (!Number.isFinite(availableInterior) || availableInterior <= 0) {
            availableInterior = Math.max(configuredRowWidth - this.marginX * 2, configuredRowWidth);
        }
        const totalWidth = items * metrics.itemWidth + (items - 1) * metrics.spacingX;
        if (!showShortRows && totalWidth < availableInterior) {
            return 0;
        }
        const rawOffsets = this.getFieldValueJS("rowCounterOffset") as number[][];
        const offset = this.resolveVector(rawOffsets, rowIndex, [this.marginX, this.defaultRowTitleOffset[1]]);
        const color = this.resolveColor(this.getFieldValueJS("rowCounterColor"), rowIndex, 0xffffffff);
        const counterFontValue = this.getFieldValue("rowCounterFont");
        let fontToUse: Font | undefined;
        if (counterFontValue instanceof Font) {
            fontToUse = counterFontValue;
        } else {
            const titleFont = this.getFieldValue("rowTitleFont");
            if (titleFont instanceof Font) {
                fontToUse = titleFont;
            }
        }
        if (!fontToUse) {
            return 0;
        }
        const drawFont = fontToUse.createDrawFont();
        const counterText = `${this.rowFocus[rowIndex] + 1} of ${items}`;
        const screenRight = this.sceneRect.x + this.sceneRect.width;
        const baseX = Math.max(rect.x + this.marginX + (offset[0] ?? 0), rect.x + this.marginX);
        const rightEdge = screenRight - this.counterRightInset;
        const maxWidthByScreen = Math.max(rightEdge - baseX, 0);
        const maxWidthByInterior = Math.max(availableInterior - (offset[0] ?? 0), 0);
        const availableWidth = Math.max(Math.min(maxWidthByScreen, maxWidthByInterior), 0);
        if (availableWidth <= 0) {
            return 0;
        }
        const textRect = {
            x: baseX,
            y: rect.y + (offset[1] ?? 0),
            width: availableWidth,
            height: drawFont.measureTextHeight(),
        };
        if (textRect.width <= 0) {
            return 0;
        }
        this.drawText(counterText, fontToUse, color, opacity, textRect, "right", "center", 0, draw2D);
        return textRect.height + (offset[1] ?? 0);
    }

    private resolveBoolean(values: any, index: number, fallback: boolean) {
        if (!Array.isArray(values) || values.length === 0) {
            return fallback;
        }
        if (index < values.length) {
            return Boolean(values[index]);
        }
        return Boolean(values[values.length - 1]);
    }

    private resolveVector(values: any, index: number, fallback: number[]) {
        if (!Array.isArray(values) || values.length === 0) {
            return fallback;
        }
        const select = index < values.length ? values[index] : values[values.length - 1];
        if (Array.isArray(select) && select.length >= 2) {
            return [Number(select[0]) || 0, Number(select[1]) || 0];
        }
        return fallback;
    }

    private resolveColor(values: any, index: number, fallback: number) {
        if (!Array.isArray(values) || values.length === 0) {
            return fallback;
        }
        if (index < values.length) {
            return Number(values[index]) || fallback;
        }
        return Number(values[values.length - 1]) || fallback;
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
