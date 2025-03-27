import { FieldKind, FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { ArrayGrid } from "./ArrayGrid";
import { Font } from "./Font";
import {
    BrsInvalid,
    BrsString,
    BrsType,
    brsValueOf,
    ContentNode,
    Int32,
    jsValueOf,
    RoBitmap,
    rootObjects,
    RoSGNode,
    ValueKind,
} from "..";
import { Interpreter } from "../..";
import { IfDraw2D, Rect } from "../interfaces/IfDraw2D";
import { rotateTranslation } from "../../scenegraph/SGUtil";

export class LabelList extends ArrayGrid {
    readonly defaultFields: FieldModel[] = [
        { name: "textHorizAlign", type: "string", value: "left" },
        { name: "color", type: "color", value: "0xddddddff" },
        { name: "focusedColor", type: "color", value: "0x262626ff" },
        { name: "font", type: "font" },
        { name: "focusedFont", type: "font", value: "font:MediumBoldSystemFont" },
        { name: "sectionDividerFont", type: "font", value: "font:SmallestSystemFont" },
        { name: "numRows", type: "integer", value: "12" },
        { name: "vertFocusAnimationStyle", type: "string", value: "fixedFocusWrap" },
    ];

    protected readonly focusUri = "common:/images/focus_list.9.png";
    protected readonly footprintUri = "common:/images/focus_footprint.9.png";
    protected readonly dividerUri = "common:/images/dividerHorizontal.9.png";
    protected readonly margin: number;
    protected readonly gap: number;
    protected wrap: boolean;
    protected currRow: number;
    protected listLength: number;
    protected hasNinePatch: boolean;
    protected lastPressHandled: string;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "LabelList") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (rootObjects.rootScene?.ui.resolution === "FHD") {
            this.margin = 36;
            this.setFieldValue("itemSize", brsValueOf([510, 72]));
        } else {
            this.margin = 24;
            this.setFieldValue("itemSize", brsValueOf([340, 48]));
        }
        this.gap = this.margin / 2;
        this.setFieldValue("focusBitmapUri", new BrsString(this.focusUri));
        this.setFieldValue("focusFootprintBitmapUri", new BrsString(this.footprintUri));
        this.setFieldValue("wrapDividerBitmapUri", new BrsString(this.dividerUri));
        this.setFieldValue("sectionDividerBitmapUri", new BrsString(this.dividerUri));

        const style = jsValueOf(this.getFieldValue("vertFocusAnimationStyle")) as string;
        this.wrap = style.toLowerCase() !== "floatingfocus";
        this.hasNinePatch = true;
        this.lastPressHandled = "";
        this.currRow = this.updateCurrRow();
        this.listLength = 0;
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (index.kind !== ValueKind.String) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.value.toLowerCase();
        if (fieldName === "vertfocusanimationstyle") {
            if (["fixedfocuswrap", "floatingfocus"].includes(value.toString().toLowerCase())) {
                this.wrap = value.toString().toLowerCase() !== "floatingfocus";
            } else {
                // Invalid vertFocusAnimationStyle
                return BrsInvalid.Instance;
            }
        } else if (fieldName === "horizfocusanimationstyle") {
            // Invalid field for LabelList
            return BrsInvalid.Instance;
        }
        const result = super.set(index, value, alwaysNotify, kind);
        // Update the current row if some fields changed
        if (["vertfocusanimationstyle", "numrows", "focusrow"].includes(fieldName)) {
            this.currRow = this.updateCurrRow();
        }
        return result;
    }

    handleKey(key: string, press: boolean): boolean {
        if (!press && this.lastPressHandled === key) {
            this.lastPressHandled = "";
            return true;
        }
        let handled = false;
        if (key === "up" || key === "down") {
            handled = press ? this.handleUpDown(key) : false;
        } else if (key === "rewind" || key === "fastforward") {
            handled = press ? this.handlePageUpDown(key) : false;
        } else if (key === "OK") {
            handled = this.handleOK(press);
        }
        this.lastPressHandled = handled ? key : "";
        return handled;
    }

    protected handleUpDown(key: string) {
        let handled = false;
        const offset = key === "up" ? -1 : 1;
        const nextIndex = this.getIndex(offset);
        if (nextIndex !== this.focusIndex) {
            this.set(new BrsString("animateToItem"), new Int32(nextIndex));
            handled = true;
            this.currRow += this.wrap ? 0 : offset;
        }
        return handled;
    }

    protected handlePageUpDown(key: string) {
        let handled = false;
        let nextIndex: number;
        if (this.wrap) {
            const step = Math.max(1, jsValueOf(this.getFieldValue("numRows")) - 2);
            const offset = key === "rewind" ? -step : step;
            nextIndex = this.getIndex(offset);
        } else {
            const content = this.getFieldValue("content") as ContentNode;
            const childCount = content.getNodeChildren().length;
            nextIndex = key === "rewind" ? 0 : childCount - 1;
            this.currRow = key === "rewind" ? 0 : jsValueOf(this.getFieldValue("numRows")) - 1;
        }
        if (nextIndex !== this.focusIndex) {
            this.set(new BrsString("animateToItem"), new Int32(nextIndex));
            handled = true;
        }
        return handled;
    }

    protected handleOK(press: boolean) {
        if (!press) {
            return false;
        }
        this.set(new BrsString("itemSelected"), new Int32(this.focusIndex));
        return true;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const { items, dividers } = this.getListItems();
        if (items.length === 0) {
            return;
        }
        const hasSections = dividers.length > 0;
        const nodeFocus = rootObjects.focused === this;
        const nodeTrans = this.getTranslation();
        const drawTrans = angle !== 0 ? rotateTranslation(nodeTrans, angle) : nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        const rotation = angle + this.getRotation();
        const itemSize = jsValueOf(this.getFieldValue("itemSize")) as number[];
        const numRows = jsValueOf(this.getFieldValue("numRows")) as number;
        const displayRows = Math.min(this.listLength, numRows);
        let focusRow = jsValueOf(this.getFieldValue("focusRow"));
        if (!this.wrap) {
            this.currRow = Math.max(0, Math.min(this.currRow, numRows - 1));
            this.currRow = Math.min(Math.max(this.currRow, focusRow), this.focusIndex);
        } else {
            this.currRow = focusRow;
        }
        let lastIndex = -1;
        const itemRect = { ...rect, width: itemSize[0], height: itemSize[1] };
        for (let r = 0; r < displayRows; r++) {
            const index = this.getIndex(r - this.currRow);
            const focused = index === this.focusIndex;
            const item = items[index];
            if (item instanceof ContentNode) {
                if (!hasSections && this.wrap && index < lastIndex && !focused) {
                    this.renderWrapDivider(itemRect, draw2D);
                } else if (hasSections && dividers[index] !== "" && !focused) {
                    this.renderSectionDivider(dividers[index].substring(1), itemRect, draw2D);
                }
                this.renderItem(index, item, itemRect, nodeFocus, focused, draw2D);
            }
            itemRect.y += itemSize[1] + 1;
            lastIndex = index;
        }
        rect.x = rect.x - (this.hasNinePatch ? this.margin : 0);
        rect.y = rect.y - (this.hasNinePatch ? 4 : 0);
        rect.width = itemSize[0] + (this.hasNinePatch ? this.margin * 2 : 0);
        rect.height = displayRows * (itemSize[1] + (this.hasNinePatch ? 9 : 0));
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, draw2D);
        this.updateParentRects(origin, angle);
    }

    protected renderItem(
        _: number,
        item: ContentNode,
        rect: Rect,
        nodeFocus: boolean,
        itemFocus: boolean,
        draw2D?: IfDraw2D
    ) {
        const icons = ["HDListItemIconUrl", "HDListItemIconSelectedUrl"];
        const iconSize = item.getIconSize(icons);
        const text = jsValueOf(item.getFieldValue("title"));
        const iconGap = iconSize[0] > 0 ? iconSize[0] + this.gap : 0;
        const iconIndex = itemFocus ? 1 : 0;
        const bmp = iconGap > 0 ? item.getBitmap(icons[iconIndex]) : undefined;
        if (!itemFocus) {
            this.renderUnfocused(text, rect, iconGap, false, bmp, draw2D);
        } else {
            this.renderFocused(text, rect, nodeFocus, iconGap, false, bmp, draw2D);
        }
    }

    protected renderUnfocused(
        text: string,
        rect: Rect,
        iconGap: number,
        iconColor: boolean,
        iconBmp?: RoBitmap,
        draw2D?: IfDraw2D
    ) {
        const font = this.getFieldValue("font") as Font;
        const color = jsValueOf(this.getFieldValue("color"));
        const align = jsValueOf(this.getFieldValue("textHorizAlign"));
        const textRect = { ...rect, x: rect.x + iconGap };
        if (iconBmp) {
            this.renderIcon(iconBmp, rect, draw2D, iconColor ? color : undefined);
        }
        this.drawText(text, font, color, textRect, align, "center", 0, draw2D);
    }

    protected renderFocused(
        text: string,
        rect: Rect,
        nodeFocus: boolean,
        iconGap: number,
        iconColor: boolean,
        iconBmp?: RoBitmap,
        draw2D?: IfDraw2D
    ) {
        const font = this.getFieldValue(nodeFocus ? "focusedFont" : "font") as Font;
        const color = jsValueOf(this.getFieldValue(nodeFocus ? "focusedColor" : "color"));
        const align = jsValueOf(this.getFieldValue("textHorizAlign"));
        const textRect = { ...rect, x: rect.x + iconGap };
        const drawFocus = jsValueOf(this.getFieldValue("drawFocusFeedback"));
        const drawFocusOnTop = jsValueOf(this.getFieldValue("drawFocusFeedbackOnTop"));
        if (drawFocus && !drawFocusOnTop) {
            this.renderFocus(rect, nodeFocus, draw2D);
        }
        if (iconBmp) {
            this.renderIcon(iconBmp, rect, draw2D, iconColor ? color : undefined);
        }
        this.drawText(text, font, color, textRect, align, "center", 0, draw2D);
        if (drawFocus && drawFocusOnTop) {
            this.renderFocus(rect, nodeFocus, draw2D);
        }
        this.hasNinePatch = this.hasNinePatch && drawFocus;
    }

    protected renderIcon(bmp: RoBitmap, rect: Rect, draw2D?: IfDraw2D, color?: number) {
        const iconY = rect.y + (rect.height / 2 - bmp.height / 2);
        const iconRect = { ...rect, y: iconY, width: bmp.width, height: bmp.height };
        this.drawImage(bmp, iconRect, 0, draw2D, color);
    }

    protected renderFocus(itemRect: Rect, nodeFocus: boolean, draw2D?: IfDraw2D) {
        const focusBitmap = this.getBitmap("focusBitmapUri");
        const focusFootprint = this.getBitmap("focusFootprintBitmapUri");
        this.hasNinePatch = (focusBitmap?.ninePatch || focusFootprint?.ninePatch) === true;
        const ninePatchRect = {
            x: itemRect.x - 24,
            y: itemRect.y - 4,
            width: itemRect.width + 48,
            height: itemRect.height + 9,
        };
        if (nodeFocus && focusBitmap) {
            const rect = focusBitmap.ninePatch ? ninePatchRect : itemRect;
            this.drawImage(focusBitmap, rect, 0, draw2D);
        } else if (!nodeFocus && focusFootprint) {
            const rect = focusFootprint.ninePatch ? ninePatchRect : itemRect;
            this.drawImage(focusFootprint, rect, 0, draw2D);
        }
    }

    protected renderSectionDivider(title: string, itemRect: Rect, draw2D?: IfDraw2D) {
        const dividerHeight = jsValueOf(this.getFieldValue("sectionDividerHeight")) as number;
        const dividerSpacing = jsValueOf(this.getFieldValue("sectionDividerSpacing")) as number;
        const divRect = { ...itemRect, height: dividerHeight };
        let margin = 0;
        if (title.length !== 0) {
            const font = this.getFieldValue("sectionDividerFont") as Font;
            const color = jsValueOf(this.getFieldValue("sectionDividerTextColor"));
            const size = this.drawText(title, font, color, divRect, "left", "center", 0, draw2D);
            margin = size.width + dividerSpacing;
        }
        const bmp = this.getBitmap("sectionDividerBitmapUri");
        if (bmp?.isValid()) {
            const rect = {
                x: divRect.x + margin,
                y: divRect.y + dividerHeight / 2 - 1,
                width: divRect.width - margin,
                height: 2,
            };
            this.drawImage(bmp, rect, 0, draw2D);
        }
        itemRect.y += dividerHeight;
    }

    protected renderWrapDivider(itemRect: Rect, draw2D?: IfDraw2D) {
        const bmp = this.getBitmap("wrapDividerBitmapUri");
        const dividerHeight = jsValueOf(this.getFieldValue("wrapDividerHeight"));
        if (bmp?.isValid()) {
            const rect = { ...itemRect, y: itemRect.y + dividerHeight / 2 - 1, height: 2 };
            this.drawImage(bmp, rect, 0, draw2D);
        }
        itemRect.y += dividerHeight;
    }

    protected getListItems() {
        const content = this.getFieldValue("content") as ContentNode;
        const sections = content.getNodeChildren();
        const items: RoSGNode[] = [];
        const dividers: string[] = [];
        for (const section of sections) {
            if (section.getFieldValue("ContentType").toString().toLowerCase() === "section") {
                const sectItems = section.getNodeChildren();
                const sectDivs = new Array(sectItems.length).fill("");
                sectDivs[0] = "-" + section.getFieldValue("title").toString();
                dividers.push(...sectDivs);
                items.push(...sectItems);
            }
        }
        if (items.length === 0 && sections.length > 0) {
            items.push(...sections);
        }
        this.listLength = items.length;
        return { items, dividers };
    }

    protected getIndex(offset: number = 0) {
        const index = this.focusIndex + offset;
        if (this.wrap) {
            return (index + this.listLength) % this.listLength;
        }
        if (index >= this.listLength) {
            return this.listLength - 1;
        } else if (index < 0) {
            return 0;
        }
        return index;
    }

    protected updateCurrRow() {
        if (this.wrap) {
            return jsValueOf(this.getFieldValue("focusRow"));
        }
        return jsValueOf(this.getFieldValue("numRows")) - 1;
    }
}
