import {
    AAMember,
    Interpreter,
    BrsBoolean,
    BrsString,
    BrsType,
    Float,
    Int32,
    isBrsNumber,
    isBrsString,
    IfDraw2D,
    Rect,
} from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { createNodeByType } from "../factory/NodeFactory";
import { brsValueOf, jsValueOf } from "../factory/Serializer";
import { sgRoot } from "../SGRoot";
import { ContentNode } from "./ContentNode";
import { Font } from "./Font";
import { rotateTranslation } from "../SGUtil";

export enum FocusStyle {
    FixedFocusWrap = "fixedFocusWrap",
    FloatingFocus = "floatingFocus",
    FixedFocus = "fixedFocus",
}

const ValidVertStyles = new Set(Object.values(FocusStyle).map((style) => style.toLowerCase()));
const ValidHorizStyles = new Set(
    [FocusStyle.FixedFocusWrap, FocusStyle.FloatingFocus].map((style) => style.toLowerCase())
);

export declare namespace ArrayGrid {
    type Metadata = {
        index: number;
        divider: boolean;
        sectionTitle: string;
    };
}

export class ArrayGrid extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "content", type: "node" },
        { name: "itemSize", type: "vector2d", value: "[0,0]" },
        { name: "itemSpacing", type: "vector2d", value: "[0,0]" },
        { name: "numRows", type: "integer", value: "0" },
        { name: "numColumns", type: "integer", value: "0" },
        { name: "focusRow", type: "integer", value: "0", alwaysNotify: true },
        { name: "focusColumn", type: "integer", value: "0", alwaysNotify: true },
        { name: "horizFocusAnimationStyle", type: "string", value: FocusStyle.FloatingFocus },
        { name: "vertFocusAnimationStyle", type: "string", value: FocusStyle.FloatingFocus },
        { name: "drawFocusFeedbackOnTop", type: "boolean", value: "false" },
        { name: "drawFocusFeedback", type: "boolean", value: "true" },
        { name: "fadeFocusFeedbackWhenAutoScrolling", type: "boolean", value: "false" },
        { name: "currFocusFeedbackOpacity", type: "float", value: "0" },
        { name: "focusBitmapUri", type: "string", value: "" },
        { name: "focusFootprintBitmapUri", type: "string", value: "" },
        { name: "focusBitmapBlendColor", type: "color", value: "0xFFFFFFFF" },
        { name: "focusFootprintBlendColor", type: "color", value: "0xFFFFFFFF" },
        { name: "wrapDividerBitmapUri", type: "string", value: "" },
        { name: "wrapDividerWidth", type: "float", value: "0" },
        { name: "wrapDividerHeight", type: "float", value: "36" },
        { name: "fixedLayout", type: "boolean", value: "false" },
        { name: "numRenderPasses", type: "integer", value: "1" },
        { name: "rowHeights", type: "floatarray", value: "[]" },
        { name: "columnWidths", type: "floatarray", value: "[]" },
        { name: "rowSpacings", type: "floatarray", value: "[]" },
        { name: "columnSpacings", type: "array", value: "[]" },
        { name: "sectionDividerBitmapUri", type: "string", value: "" },
        { name: "sectionDividerFont", type: "font", value: "font:SmallestSystemFont" },
        { name: "sectionDividerTextColor", type: "color", value: "0xddddddff" },
        { name: "sectionDividerSpacing", type: "float", value: "0.0" },
        { name: "sectionDividerWidth", type: "float", value: "0.0" },
        { name: "sectionDividerHeight", type: "float", value: "40" },
        { name: "sectionDividerMinWidth", type: "float", value: "0.0" },
        { name: "sectionDividerLeftOffset", type: "float", value: "0.0" },
        { name: "itemClippingRect", type: "rect2d", value: "[0.0,0.0,0.0,0.0]" },
        { name: "itemSelected", type: "integer", value: "-1", alwaysNotify: true },
        { name: "itemFocused", type: "integer", value: "-1", alwaysNotify: true },
        { name: "itemUnfocused", type: "integer", value: "-1", alwaysNotify: true },
        { name: "jumpToItem", type: "integer", value: "-1", alwaysNotify: true },
        { name: "animateToItem", type: "integer", value: "-1", alwaysNotify: true },
        { name: "currFocusRow", type: "float", value: "0.0" },
        { name: "currFocusColumn", type: "float", value: "0.0" },
        { name: "currFocusSection", type: "float", value: "0.0" },
    ];
    protected readonly dividerUri = "common:/images/dividerHorizontal.9.png";
    protected readonly content: ContentNode[] = [];
    protected readonly metadata: ArrayGrid.Metadata[] = [];
    protected readonly itemComps: Group[] = [];
    protected readonly marginX: number;
    protected readonly marginY: number;
    protected readonly gap: number;
    protected readonly lineHeight: number;
    protected focusIndex: number = 0;
    protected numRows: number = 0;
    protected numCols: number = 0;
    protected currRow: number = 0;
    protected topRow: number = 0;
    protected wrap: boolean = false;
    protected lastPressHandled: string;
    protected hasNinePatch: boolean;
    protected focusField: string;
    protected vertFocusAnimationStyleName: string;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.ArrayGrid) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.setValueSilent("content", new ContentNode());
        if (this.resolution === "FHD") {
            this.marginX = 36;
            this.marginY = 6;
            this.lineHeight = 4.5;
            this.setValueSilent("wrapDividerHeight", new Float(36));
            this.setValueSilent("sectionDividerHeight", new Float(60));
            this.setValueSilent("sectionDividerMinWidth", new Float(126));
            this.setValueSilent("sectionDividerSpacing", new Float(15));
        } else {
            this.marginX = 24;
            this.marginY = 4;
            this.lineHeight = 3;
            this.setValueSilent("wrapDividerHeight", new Float(24));
            this.setValueSilent("sectionDividerHeight", new Float(40));
            this.setValueSilent("sectionDividerMinWidth", new Float(117));
            this.setValueSilent("sectionDividerSpacing", new Float(10));
        }
        this.gap = this.marginX / 2;
        this.setValueSilent("focusable", BrsBoolean.True);
        this.setValueSilent("wrapDividerBitmapUri", new BrsString(this.dividerUri));
        this.setValueSilent("sectionDividerBitmapUri", new BrsString(this.dividerUri));
        const style = (this.getValueJS("vertFocusAnimationStyle") as string) ?? FocusStyle.FloatingFocus;
        this.vertFocusAnimationStyleName = style.toLowerCase();
        this.wrap = this.vertFocusAnimationStyleName === FocusStyle.FixedFocusWrap.toLowerCase();
        this.lastPressHandled = "";
        this.hasNinePatch = false;
        this.focusField = "listHasFocus";
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "content" && value instanceof ContentNode) {
            super.setValue(index, value, alwaysNotify, kind);
            this.itemComps.length = 0;
            this.refreshContent();
            if (this.content.length > 0) {
                this.setFocusedItem(0);
            }
            return;
        } else if (["jumptoitem", "animatetoitem"].includes(fieldName) && isBrsNumber(value)) {
            this.setFocusedItem(jsValueOf(value));
        } else if (fieldName === "numrows" && isBrsNumber(value)) {
            this.numRows = jsValueOf(value) as number;
        } else if (fieldName === "numcolumns" && isBrsNumber(value)) {
            this.numCols = jsValueOf(value) as number;
        } else if (fieldName === "vertfocusanimationstyle" && isBrsString(value)) {
            const style = value.toString().toLowerCase();
            if (ValidVertStyles.has(style)) {
                this.vertFocusAnimationStyleName = style;
                this.wrap = style === FocusStyle.FixedFocusWrap.toLowerCase();
            } else {
                // Invalid vertFocusAnimationStyle
                return;
            }
        } else if (
            fieldName === "horizfocusanimationstyle" &&
            isBrsString(value) &&
            !ValidHorizStyles.has(value.toString().toLowerCase())
        ) {
            // Invalid horizFocusAnimationStyle
            return;
        }
        super.setValue(index, value, alwaysNotify, kind);
        const rowFields = ["vertfocusanimationstyle", "numrows", "focusrow"];
        // Update the current row if some fields changed
        if (rowFields.includes(fieldName)) {
            this.currRow = this.updateCurrRow();
        }
    }

    protected setFocusedItem(index: number) {
        const newFocus = this.findContentIndex(index);
        if (newFocus === -1) {
            return;
        }
        const focusedIndex = this.getValueJS("itemFocused") as number;
        const nodeFocus = sgRoot.focused === this;
        this.updateItemFocus(this.focusIndex, false, nodeFocus);
        super.setValue("itemUnfocused", new Int32(focusedIndex));
        this.focusIndex = newFocus;
        this.updateItemFocus(this.focusIndex, true, nodeFocus);
        super.setValue("itemFocused", new Int32(index));
    }

    protected findContentIndex(index: number) {
        if (index < 0 || index >= this.content.length) {
            return -1;
        } else if (this.metadata.length > 0) {
            return this.metadata.findIndex((item) => item.index === index);
        }
        return index;
    }

    protected updateItemFocus(index: number, focus: boolean, nodeFocus: boolean) {
        const itemComp = this.itemComps[index];
        if (!itemComp) return;
        itemComp.setValue("itemHasFocus", BrsBoolean.from(focus));
        itemComp.setValue(this.focusField, BrsBoolean.from(nodeFocus));
        itemComp.setValue("focusPercent", new Float(focus ? 1 : 0));
    }

    handleKey(key: string, press: boolean): boolean {
        if (!press && this.lastPressHandled === key) {
            this.lastPressHandled = "";
            return true;
        }
        let handled = false;
        if (key === "up" || key === "down") {
            handled = press ? this.handleUpDown(key) : false;
        } else if (key === "left" || key === "right") {
            handled = press ? this.handleLeftRight(key) : false;
        } else if (key === "rewind" || key === "fastforward") {
            handled = press ? this.handlePageUpDown(key) : false;
        } else if (key === "OK") {
            handled = this.handleOK(press);
        }
        this.lastPressHandled = handled && key !== "OK" ? key : "";
        return handled;
    }

    protected handleUpDown(_key: string) {
        return false;
    }

    protected handleLeftRight(_key: string) {
        return false;
    }

    protected handlePageUpDown(_key: string) {
        return false;
    }

    protected handleOK(press: boolean) {
        if (press) {
            const index = this.metadata[this.focusIndex]?.index ?? this.focusIndex;
            this.setValue("itemSelected", new Int32(index));
        }
        return false;
    }

    protected getContentItem(index: number): ContentNode {
        if (this.content[index] instanceof ContentNode) {
            return this.content[index];
        }
        return new ContentNode();
    }

    protected getContentChildren(content: ContentNode): ContentNode[] {
        return content.getNodeChildren().map((child) => {
            if (child instanceof ContentNode) {
                return child;
            }
            return new ContentNode();
        });
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = angle === 0 ? nodeTrans.slice() : rotateTranslation(nodeTrans, angle);
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rect = { x: drawTrans[0], y: drawTrans[1], ...size };
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();
        const content = this.getValue("content");
        if (content instanceof ContentNode && content.changed) {
            this.refreshContent();
            content.changed = false;
        }
        this.renderContent(interpreter, rect, rotation, opacity, draw2D);
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateParentRects(origin, angle);
        this.isDirty = false;
    }

    protected renderContent(
        _interpreter: Interpreter,
        _rect: Rect,
        _rotation: number,
        _opacity: number,
        _draw2D?: IfDraw2D
    ) {
        // To be overwritten by derivate classes
    }

    protected renderItemComponent(
        interpreter: Interpreter,
        index: number,
        itemRect: Rect,
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        const content = this.getContentItem(index);
        const nodeFocus = sgRoot.focused === this;
        const focused = index === this.focusIndex;
        if (!this.itemComps[index]) {
            const itemComp = this.createItemComponent(interpreter, itemRect, content);
            if (itemComp instanceof Group) {
                this.itemComps[index] = itemComp;
            }
        }
        if (content.changed) {
            this.itemComps[index].setValue("itemContent", content, true);
            content.changed = false;
        }
        this.updateItemFocus(index, focused, nodeFocus);
        const drawFocus = this.getValueJS("drawFocusFeedback");
        const drawFocusOnTop = this.getValueJS("drawFocusFeedbackOnTop");
        if (focused && drawFocus && !drawFocusOnTop) {
            this.renderFocus(itemRect, opacity, nodeFocus, draw2D);
        }
        const itemOrigin = [itemRect.x, itemRect.y];
        this.itemComps[index].renderNode(interpreter, itemOrigin, rotation, opacity, draw2D);
        if (focused && drawFocus && drawFocusOnTop) {
            this.renderFocus(itemRect, opacity, nodeFocus, draw2D);
        }
    }

    protected renderFocus(itemRect: Rect, opacity: number, nodeFocus: boolean, draw2D?: IfDraw2D) {
        const bmpUri = nodeFocus ? "focusBitmapUri" : "focusFootprintBitmapUri";
        const bmp = this.getBitmap(bmpUri);
        if (!bmp?.isValid()) {
            return;
        }
        this.hasNinePatch = bmp.ninePatch;
        let focusRect = bmp.ninePatch
            ? {
                  x: itemRect.x - this.marginX,
                  y: itemRect.y - this.marginY,
                  width: itemRect.width + this.marginX * 2,
                  height: itemRect.height + this.marginY * 2,
              }
            : itemRect;
        this.drawImage(bmp, focusRect, 0, opacity, draw2D);
    }

    protected renderSectionDivider(
        title: string,
        itemRect: Rect,
        opacity: number,
        textLine: number,
        draw2D?: IfDraw2D
    ) {
        const dividerHeight = this.getValueJS("sectionDividerHeight") as number;
        const dividerSpacing = this.getValueJS("sectionDividerSpacing") as number;
        const divRect = { ...itemRect, height: dividerHeight };
        let margin = 0;
        if (title.length !== 0) {
            const font = this.getValue("sectionDividerFont") as Font;
            const color = this.getValueJS("sectionDividerTextColor");
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
            margin = size.width + dividerSpacing;
        }
        const bmp = this.getBitmap("sectionDividerBitmapUri");
        if (bmp?.isValid()) {
            const height = bmp.ninePatch ? this.lineHeight : bmp.height;
            const rect = {
                x: divRect.x + margin,
                y: divRect.y + Math.round((dividerHeight - height) / 2),
                width: divRect.width - margin,
                height: height,
            };
            this.drawImage(bmp, rect, 0, opacity, draw2D);
        }
        return dividerHeight;
    }

    protected renderWrapDivider(itemRect: Rect, opacity: number, draw2D?: IfDraw2D) {
        const bmp = this.getBitmap("wrapDividerBitmapUri");
        const dividerHeight = this.getValueJS("wrapDividerHeight") as number;
        if (bmp?.isValid()) {
            const height = bmp.ninePatch ? this.lineHeight : bmp.height;
            const topOffset = Math.round((dividerHeight - height) / 2);
            const rect = { ...itemRect, y: itemRect.y + topOffset, height: height };
            this.drawImage(bmp, rect, 0, opacity, draw2D);
        }
        return dividerHeight;
    }

    protected refreshContent() {
        this.content.length = 0;
        this.metadata.length = 0;
        const content = this.getValue("content");
        if (!(content instanceof ContentNode)) {
            return;
        }
        const sections = this.getContentChildren(content);
        let itemIndex = 0;
        for (const section of sections) {
            if (section.getValueJS("ContentType")?.toLowerCase() === "section") {
                itemIndex = this.processSection(section, itemIndex);
            }
        }
        if (this.content.length === 0 && sections.length > 0) {
            this.content.push(...sections);
        }
    }

    protected processSection(section: ContentNode, itemIndex: number) {
        const content = this.getContentChildren(section);
        const numCols = this.numCols || 1;
        if (content.length === 0) {
            return itemIndex;
        }
        for (const [index, _item] of content.entries()) {
            const metadata = { index: itemIndex, divider: false, sectionTitle: "" };
            if (index === 0) {
                metadata.divider = true;
                metadata.sectionTitle = section.getValueJS("title") ?? "";
            }
            this.metadata.push(metadata);
            itemIndex++;
        }
        this.content.push(...content);
        // check if the items count is multiple of numCols, otherwise fill with empty nodes
        const remainder = content.length % numCols;
        if (remainder > 0) {
            const emptyContent = new ContentNode("_placeholder_");
            const emptyMetadata = { index: -1, divider: false, sectionTitle: "" };
            for (let i = 0; i < numCols - remainder; i++) {
                this.content.push(emptyContent);
                this.metadata.push(emptyMetadata);
            }
        }
        return itemIndex;
    }

    protected createItemComponent(interpreter: Interpreter, itemRect: Rect, content: ContentNode) {
        if (content.name === "_placeholder_") {
            return new Group();
        }
        const itemCompName = this.getValueJS("itemComponentName") ?? "";
        const itemComp = createNodeByType(itemCompName, interpreter);
        if (itemComp instanceof Group) {
            itemComp.setNodeParent(this);
            itemComp.setValue("width", brsValueOf(itemRect.width));
            itemComp.setValue("height", brsValueOf(itemRect.height));
            itemComp.setValue("itemContent", content);
        }
        return itemComp;
    }

    protected isFixedFocusMode() {
        return (
            this.vertFocusAnimationStyleName === FocusStyle.FixedFocusWrap.toLowerCase() ||
            this.vertFocusAnimationStyleName === FocusStyle.FixedFocus.toLowerCase()
        );
    }

    protected getRenderRowIndex(rowPosition: number) {
        const numCols = Math.max(1, this.numCols || 1);
        if (this.isFixedFocusMode() && !this.wrap) {
            const focusRow = Math.floor(this.focusIndex / numCols);
            const totalRows = Math.max(1, Math.ceil(this.content.length / numCols));
            const desiredRow = focusRow + (rowPosition - this.currRow);
            if (desiredRow < 0 || desiredRow >= totalRows) {
                return -1;
            }
            return desiredRow * numCols;
        }
        return this.getIndex(rowPosition - this.currRow);
    }

    protected updateCurrRow() {
        const numCols = this.numCols || 1;
        const focusRow = this.getValueJS("focusRow") as number;
        const fixedFocus = this.isFixedFocusMode();
        if (!this.wrap && !fixedFocus) {
            const currentFocus = Math.floor(this.focusIndex / numCols);
            const numRows = this.getValueJS("numRows") as number;

            if (currentFocus >= 0 && currentFocus < numRows) {
                return currentFocus;
            }

            const rowStep1 = Math.min(this.currRow, numRows - 1);
            const rowStep2 = Math.max(0, rowStep1);
            const rowStep3 = Math.max(rowStep2, focusRow);
            return Math.min(rowStep3, currentFocus);
        }
        return focusRow;
    }

    protected updateListCurrRow() {
        if (this.wrap || this.isFixedFocusMode()) {
            this.topRow = 0;
            return this.updateCurrRow();
        }

        const numCols = this.numCols || 1;
        if (numCols <= 0) {
            this.topRow = 0;
            return 0;
        }

        const totalRows = Math.ceil(this.content.length / numCols);
        if (totalRows <= 0) {
            this.topRow = 0;
            return 0;
        }

        const desiredRows = Number.isFinite(this.numRows) && this.numRows > 0 ? Math.floor(this.numRows) : totalRows;
        const visibleRows = Math.max(1, Math.min(desiredRows, totalRows));

        let focusRowIndex = Math.floor(this.focusIndex / numCols);
        focusRowIndex = Math.max(0, Math.min(focusRowIndex, totalRows - 1));

        if (focusRowIndex < this.topRow) {
            this.topRow = focusRowIndex;
        } else if (focusRowIndex > this.topRow + (visibleRows - 1)) {
            this.topRow = focusRowIndex - (visibleRows - 1);
        }

        const maxTopRow = Math.max(0, totalRows - visibleRows);
        this.topRow = Math.max(0, Math.min(this.topRow, maxTopRow));

        return Math.max(0, focusRowIndex - this.topRow);
    }

    protected clampTopRow() {
        const numCols = this.numCols || 1;
        if (numCols <= 0) {
            this.topRow = 0;
            return;
        }

        const totalRows = Math.ceil(this.content.length / numCols);
        if (totalRows <= 0) {
            this.topRow = 0;
            return;
        }

        const desiredRows = Number.isFinite(this.numRows) && this.numRows > 0 ? Math.floor(this.numRows) : totalRows;
        const visibleRows = Math.max(1, Math.min(desiredRows, totalRows));
        const maxTopRow = Math.max(0, totalRows - visibleRows);
        this.topRow = Math.max(0, Math.min(this.topRow, maxTopRow));
    }

    protected updateRect(rect: Rect, numRows: number, itemSize: number[]) {
        const numCols = this.numCols || 1;
        rect.x = rect.x - (this.hasNinePatch ? this.marginX : 0);
        rect.y = rect.y - (this.hasNinePatch ? this.marginY : 0);
        rect.width = numCols * (itemSize[0] + (this.hasNinePatch ? this.marginX * 2 : 0));
        rect.height = numRows * (itemSize[1] + (this.hasNinePatch ? this.marginY * 2 : 0));
    }

    protected getIndex(offset: number = 0, currIndex?: number) {
        currIndex = currIndex ?? this.focusIndex;
        const numCols = this.numCols || 1;
        const focusRow = Math.floor(currIndex / numCols);
        const maxRows = Math.ceil(this.content.length / numCols);

        let nextRow = focusRow + offset;

        if (this.wrap) {
            nextRow = (nextRow + maxRows) % maxRows;
        } else if (nextRow >= maxRows) {
            nextRow = maxRows - 1;
        } else if (nextRow < 0) {
            nextRow = 0;
        }
        return nextRow * numCols;
    }

    protected resolveBoolean(values: any, index: number, fallback: boolean) {
        if (!Array.isArray(values) || values.length === 0) {
            return fallback;
        }
        if (index < values.length) {
            return Boolean(values[index]);
        }
        return Boolean(values.at(-1));
    }

    protected resolveVector(values: any, index: number, fallback: number[]) {
        if (!Array.isArray(values) || values.length === 0) {
            return fallback;
        }
        if (values.length === 2 && typeof values[0] === "number" && typeof values[1] === "number") {
            return [Number(values[0]) || 0, Number(values[1]) || 0];
        }
        const select = index < values.length ? values[index] : values.at(-1);
        if (Array.isArray(select) && select.length >= 2) {
            return [Number(select[0]) || 0, Number(select[1]) || 0];
        }
        return fallback;
    }

    protected resolveNumber(values: any, index: number, fallback: number) {
        if (!Array.isArray(values) || values.length === 0) {
            return fallback;
        }
        if (index < values.length) {
            const value = Number(values[index]);
            return Number.isFinite(value) && value > 0 ? value : fallback;
        }
        const lastValue = Number(values.at(-1));
        return Number.isFinite(lastValue) && lastValue > 0 ? lastValue : fallback;
    }

    protected resolveColor(values: any, index: number, fallback: number) {
        if (!Array.isArray(values) || values.length === 0) {
            return fallback;
        }
        if (index < values.length) {
            return Number(values[index]) || fallback;
        }
        return Number(values.at(-1)) || fallback;
    }
}
