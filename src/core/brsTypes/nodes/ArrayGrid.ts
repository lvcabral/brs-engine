import { FieldKind, FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { Group } from "./Group";
import {
    BrsBoolean,
    BrsInvalid,
    BrsString,
    BrsType,
    brsValueOf,
    ContentNode,
    createNodeByType,
    Float,
    Font,
    Int32,
    isBrsNumber,
    isBrsString,
    jsValueOf,
    rootObjects,
    RoSGNode,
} from "..";
import { IfDraw2D, Rect } from "../interfaces/IfDraw2D";
import { Interpreter } from "../../interpreter";
import { rotateTranslation } from "../../scenegraph/SGUtil";

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
        { name: "focusable", type: "boolean", value: "true" },
        { name: "focusRow", type: "integer", value: "0", alwaysNotify: true },
        { name: "focusColumn", type: "integer", value: "0", alwaysNotify: true },
        { name: "horizFocusAnimationStyle", type: "string", value: "floatingFocus" },
        { name: "vertFocusAnimationStyle", type: "string", value: "floatingFocus" },
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
        { name: "jumpToItem", type: "integer", value: "0" },
        { name: "animateToItem", type: "integer", value: "0" },
        { name: "currFocusRow", type: "float", value: "0.0" },
        { name: "currFocusColumn", type: "float", value: "0.0" },
        { name: "currFocusSection", type: "float", value: "0.0" },
    ];
    protected readonly dividerUri = "common:/images/dividerHorizontal.9.png";
    protected readonly content: RoSGNode[] = [];
    protected readonly metadata: ArrayGrid.Metadata[] = [];
    protected readonly itemComps: Group[] = [];
    protected readonly marginX: number;
    protected readonly marginY: number;
    protected readonly gap: number;
    protected readonly lineHeight: number;
    protected focusIndex: number = 0;
    protected currRow: number = 0;
    protected wrap: boolean = false;
    protected lastPressHandled: string;
    protected hasNinePatch: boolean;
    protected focusField: string;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "ArrayGrid") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.setFieldValue("content", new ContentNode());
        if (this.resolution === "FHD") {
            this.marginX = 36;
            this.marginY = 6;
            this.lineHeight = 4.5;
            this.setFieldValue("wrapDividerHeight", new Float(36));
            this.setFieldValue("sectionDividerHeight", new Float(60));
            this.setFieldValue("sectionDividerMinWidth", new Float(126));
            this.setFieldValue("sectionDividerSpacing", new Float(15));
        } else {
            this.marginX = 24;
            this.marginY = 4;
            this.lineHeight = 3;
            this.setFieldValue("wrapDividerHeight", new Float(24));
            this.setFieldValue("sectionDividerHeight", new Float(40));
            this.setFieldValue("sectionDividerMinWidth", new Float(117));
            this.setFieldValue("sectionDividerSpacing", new Float(10));
        }
        this.gap = this.marginX / 2;
        this.setFieldValue("wrapDividerBitmapUri", new BrsString(this.dividerUri));
        this.setFieldValue("sectionDividerBitmapUri", new BrsString(this.dividerUri));
        const style = this.getFieldValueJS("vertFocusAnimationStyle") as string;
        this.wrap = style.toLowerCase() === "fixedfocuswrap";
        this.lastPressHandled = "";
        this.hasNinePatch = false;
        this.focusField = "listHasFocus";
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.getValue().toLowerCase();
        if (fieldName === "content") {
            const retValue = super.set(index, value, alwaysNotify, kind);
            this.itemComps.length = 0;
            this.refreshContent();
            let focus = -1;
            if (value instanceof ContentNode && value.getNodeChildren().length) {
                focus = 0;
            }
            this.set(new BrsString("jumpToItem"), new Int32(focus));
            return retValue;
        } else if (["jumptoitem", "animatetoitem"].includes(fieldName) && isBrsNumber(value)) {
            const newFocus = this.findContentIndex(jsValueOf(value));
            if (newFocus > -1) {
                const focusedIndex = this.getFieldValueJS("itemFocused") as number;
                const nodeFocus = rootObjects.focused === this;
                this.updateItemFocus(this.focusIndex, false, nodeFocus);
                this.focusIndex = newFocus;
                this.updateItemFocus(this.focusIndex, true, nodeFocus);
                super.set(new BrsString("itemUnfocused"), new Int32(focusedIndex));
                super.set(new BrsString("itemFocused"), value);
            }
        } else if (fieldName === "vertfocusanimationstyle") {
            const style = value.toString().toLowerCase();
            if (["fixedfocuswrap", "floatingfocus", "fixedfocus"].includes(style)) {
                this.wrap = style === "fixedfocuswrap";
            } else {
                // Invalid vertFocusAnimationStyle
                return BrsInvalid.Instance;
            }
        } else if (
            fieldName === "horizfocusanimationstyle" &&
            !["fixedfocuswrap", "floatingfocus"].includes(value.toString().toLowerCase())
        ) {
            // Invalid horizFocusAnimationStyle
            return BrsInvalid.Instance;
        }
        const result = super.set(index, value, alwaysNotify, kind);
        const rowFields = ["vertfocusanimationstyle", "numrows", "focusrow"];
        // Update the current row if some fields changed
        if (rowFields.includes(index.getValue().toLowerCase())) {
            this.currRow = this.updateCurrRow();
        }
        return result;
    }

    private findContentIndex(index: number) {
        if (index < 0 || index >= this.content.length) {
            return -1;
        } else if (this.metadata.length > 0) {
            return this.metadata.findIndex((item) => item.index === index);
        }
        return index;
    }

    private updateItemFocus(index: number, focus: boolean, nodeFocus: boolean) {
        this.itemComps[index]?.set(new BrsString("itemHasFocus"), BrsBoolean.from(focus));
        this.itemComps[index]?.set(new BrsString(this.focusField), BrsBoolean.from(nodeFocus));
        this.itemComps[index]?.set(new BrsString("focusPercent"), new Float(focus ? 1 : 0));
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
            this.set(new BrsString("itemSelected"), new Int32(index));
        }
        return false;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = angle !== 0 ? rotateTranslation(nodeTrans, angle) : nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rect = { x: drawTrans[0], y: drawTrans[1], ...size };
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();
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
        const content = this.content[index];
        if (!(content instanceof ContentNode)) {
            return;
        }
        const nodeFocus = rootObjects.focused === this;
        const focused = index === this.focusIndex;
        if (!this.itemComps[index]) {
            const itemComp = this.createItemComponent(interpreter, itemRect, content);
            if (itemComp instanceof Group) {
                this.itemComps[index] = itemComp;
            }
        }
        if (content.changed) {
            this.itemComps[index].set(new BrsString("itemContent"), content, true);
            content.changed = false;
        }
        this.updateItemFocus(index, focused, nodeFocus);
        const drawFocus = this.getFieldValueJS("drawFocusFeedback");
        const drawFocusOnTop = this.getFieldValueJS("drawFocusFeedbackOnTop");
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
        const dividerHeight = this.getFieldValueJS("sectionDividerHeight") as number;
        const dividerSpacing = this.getFieldValueJS("sectionDividerSpacing") as number;
        const divRect = { ...itemRect, height: dividerHeight };
        let margin = 0;
        if (title.length !== 0) {
            const font = this.getFieldValue("sectionDividerFont") as Font;
            const color = this.getFieldValueJS("sectionDividerTextColor");
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
        const dividerHeight = this.getFieldValueJS("wrapDividerHeight") as number;
        if (bmp?.isValid()) {
            const height = bmp.ninePatch ? this.lineHeight : bmp.height;
            const topOffset = Math.round((dividerHeight - height) / 2);
            const rect = { ...itemRect, y: itemRect.y + topOffset, height: height };
            this.drawImage(bmp, rect, 0, opacity, draw2D);
        }
        return dividerHeight;
    }

    protected refreshContent() {
        const numCols = (this.getFieldValueJS("numColumns") as number) || 1;
        this.content.length = 0;
        this.metadata.length = 0;
        const content = this.getFieldValue("content");
        if (!(content instanceof ContentNode)) {
            return;
        }
        const sections = content.getNodeChildren();
        let itemIndex = 0;
        for (const section of sections) {
            if (section.getFieldValueJS("ContentType")?.toLowerCase() === "section") {
                itemIndex = this.processSection(section, itemIndex, numCols);
            }
        }
        if (this.content.length === 0 && sections.length > 0) {
            this.content.push(...sections);
        }
    }

    private processSection(section: RoSGNode, itemIndex: number, numCols: number) {
        const content = section.getNodeChildren();
        if (content.length === 0) {
            return itemIndex;
        }
        content.forEach((_item, index) => {
            const metadata = { index: itemIndex, divider: false, sectionTitle: "" };
            if (index === 0) {
                metadata.divider = true;
                metadata.sectionTitle = section.getFieldValueJS("title") ?? "";
            }
            this.metadata.push(metadata);
            itemIndex++;
        });
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
        const itemCompName = this.getFieldValueJS("itemComponentName") ?? "";
        const itemComp = createNodeByType(interpreter, new BrsString(itemCompName));
        if (itemComp instanceof Group) {
            itemComp.setFieldValue("width", brsValueOf(itemRect.width));
            itemComp.setFieldValue("height", brsValueOf(itemRect.height));
            itemComp.set(new BrsString("itemContent"), content, true);
        }
        return itemComp;
    }

    protected updateCurrRow() {
        const numCols = (this.getFieldValueJS("numColumns") as number) || 1;
        const focusRow = this.getFieldValueJS("focusRow") as number;
        if (!this.wrap) {
            const currentFocus = Math.floor(this.focusIndex / numCols);
            const numRows = this.getFieldValueJS("numRows") as number;

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

    protected updateRect(rect: Rect, numCols: number, numRows: number, itemSize: number[]) {
        rect.x = rect.x - (this.hasNinePatch ? this.marginX : 0);
        rect.y = rect.y - (this.hasNinePatch ? this.marginY : 0);
        rect.width = numCols * (itemSize[0] + (this.hasNinePatch ? this.marginX * 2 : 0));
        rect.height = numRows * (itemSize[1] + (this.hasNinePatch ? this.marginY * 2 : 0));
    }

    protected getIndex(offset: number = 0, currIndex?: number) {
        currIndex = currIndex ?? this.focusIndex;
        const numCols = (this.getFieldValueJS("numColumns") as number) || 1;
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
}
