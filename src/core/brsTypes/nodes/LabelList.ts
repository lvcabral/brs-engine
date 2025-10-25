import { FieldKind, FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { ArrayGrid } from "./ArrayGrid";
import { Font } from "./Font";
import { BrsInvalid, BrsString, BrsType, brsValueOf, ContentNode, Int32, isBrsString, RoBitmap, sgRoot } from "..";
import { Interpreter } from "../..";
import { IfDraw2D, Rect, RectRect } from "../interfaces/IfDraw2D";

export class LabelList extends ArrayGrid {
    readonly defaultFields: FieldModel[] = [
        { name: "textHorizAlign", type: "string", value: "left" },
        { name: "color", type: "color", value: "0xddddddff" },
        { name: "focusedColor", type: "color", value: "0x262626ff" },
        { name: "font", type: "font" },
        { name: "focusedFont", type: "font", value: "font:MediumBoldSystemFont" },
        { name: "numRows", type: "integer", value: "12" },
        { name: "numColumns", type: "integer", value: "1" },
        { name: "vertFocusAnimationStyle", type: "string", value: "fixedFocusWrap" },
    ];

    protected readonly focusUri = "common:/images/focus_list.9.png";
    protected readonly footprintUri = "common:/images/focus_footprint.9.png";

    constructor(initializedFields: AAMember[] = [], readonly name: string = "LabelList") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (this.resolution === "FHD") {
            this.setFieldValue("itemSize", brsValueOf([510, 72]));
        } else {
            this.setFieldValue("itemSize", brsValueOf([340, 48]));
        }
        this.setFieldValue("focusBitmapUri", new BrsString(this.focusUri));
        this.setFieldValue("focusFootprintBitmapUri", new BrsString(this.footprintUri));
        const style = this.getFieldValueJS("vertFocusAnimationStyle") as string;
        this.wrap = style.toLowerCase() === "fixedfocuswrap";
        this.numRows = this.getFieldValueJS("numRows") as number;
        this.numCols = this.getFieldValueJS("numColumns") as number;
        this.hasNinePatch = true;
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.getValue().toLowerCase();
        if (fieldName === "vertfocusanimationstyle") {
            if (!["fixedfocuswrap", "floatingfocus"].includes(value.toString().toLowerCase())) {
                // Invalid vertFocusAnimationStyle
                return BrsInvalid.Instance;
            }
        } else if (["horizfocusanimationstyle", "numcolumns"].includes(fieldName)) {
            // Invalid fields for LabelList
            return BrsInvalid.Instance;
        }
        return super.set(index, value, alwaysNotify, kind);
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
            const step = Math.max(1, this.numRows - 2);
            const offset = key === "rewind" ? -step : step;
            nextIndex = this.getIndex(offset);
        } else {
            nextIndex = key === "rewind" ? 0 : this.content.length - 1;
            this.currRow = key === "rewind" ? 0 : this.numRows - 1;
        }
        if (nextIndex !== this.focusIndex) {
            this.set(new BrsString("animateToItem"), new Int32(nextIndex));
            handled = true;
        }
        return handled;
    }

    protected renderContent(
        _interpreter: Interpreter,
        rect: Rect,
        _rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        if (this.content.length === 0) {
            return;
        }
        const hasSections = this.metadata.length > 0;
        const nodeFocus = sgRoot.focused === this;
        this.currRow = this.updateCurrRow();
        let lastIndex = -1;
        const displayRows = Math.min(this.content.length, this.numRows);
        const itemSize = this.getFieldValueJS("itemSize") as number[];
        const itemRect = { ...rect, width: itemSize[0], height: itemSize[1] };
        let sectionIndex = displayRows + 1;
        for (let r = 0; r < displayRows; r++) {
            const index = this.getIndex(r - this.currRow);
            const focused = index === this.focusIndex;
            const item = this.getContentItem(index);
            if (!hasSections && this.wrap && index < lastIndex && r > 0) {
                itemRect.y += this.renderWrapDivider(itemRect, opacity, draw2D);
            } else if (hasSections && this.wrap && this.metadata[index]?.divider && r > 0) {
                const divText = this.metadata[index].sectionTitle;
                itemRect.y += this.renderSectionDivider(divText, itemRect, opacity, sectionIndex, draw2D);
                sectionIndex++;
            }
            this.renderItem(index, item, itemRect, opacity, nodeFocus, focused, draw2D);
            itemRect.y += itemSize[1] + 1;
            lastIndex = index;
            if (!RectRect(this.sceneRect, itemRect)) {
                break;
            }
        }
        this.updateRect(rect, displayRows, itemSize);
    }

    protected renderItem(
        index: number,
        item: ContentNode,
        rect: Rect,
        opacity: number,
        nodeFocus: boolean,
        itemFocus: boolean,
        draw2D?: IfDraw2D
    ) {
        const icons = ["HDListItemIconUrl", "HDListItemIconSelectedUrl"];
        const iconSize = item.getIconSize(icons);
        const text = item.getFieldValueJS("title");
        const iconGap = iconSize[0] > 0 ? iconSize[0] + this.gap : 0;
        const iconIndex = itemFocus ? 1 : 0;
        const bmp = iconGap > 0 ? item.getBitmap(icons[iconIndex]) : undefined;
        if (!itemFocus) {
            this.renderUnfocused(index, text, rect, opacity, iconGap, false, bmp, draw2D);
        } else {
            this.renderFocused(index, text, rect, opacity, nodeFocus, iconGap, false, bmp, draw2D);
        }
    }

    protected renderUnfocused(
        index: number,
        text: string,
        rect: Rect,
        opacity: number,
        iconGap: number,
        iconColor: boolean,
        iconBmp?: RoBitmap,
        draw2D?: IfDraw2D
    ) {
        const font = this.getFieldValue("font") as Font;
        const color = this.getFieldValueJS("color") as number;
        const align = this.getFieldValueJS("textHorizAlign") as string;
        const textRect = { ...rect, x: rect.x + iconGap, width: rect.width - (iconGap ? this.gap : 0) };
        if (iconBmp) {
            this.renderIcon(iconBmp, rect, opacity, draw2D, iconColor ? color : undefined);
        }
        this.drawText(text, font, color, opacity, textRect, align, "center", 0, draw2D, "...", index);
    }

    protected renderFocused(
        index: number,
        text: string,
        rect: Rect,
        opacity: number,
        nodeFocus: boolean,
        iconGap: number,
        iconColor: boolean,
        iconBmp?: RoBitmap,
        draw2D?: IfDraw2D
    ) {
        const font = this.getFieldValue(nodeFocus ? "focusedFont" : "font") as Font;
        const color = this.getFieldValueJS(nodeFocus ? "focusedColor" : "color") as number;
        const align = this.getFieldValueJS("textHorizAlign") as string;
        const textRect = { ...rect, x: rect.x + iconGap, width: rect.width - (iconGap ? this.gap : 0) };
        const drawFocus = this.getFieldValueJS("drawFocusFeedback") as boolean;
        const drawFocusOnTop = this.getFieldValueJS("drawFocusFeedbackOnTop") as boolean;
        if (drawFocus && !drawFocusOnTop) {
            this.renderFocus(rect, opacity, nodeFocus, draw2D);
        }
        if (iconBmp) {
            this.renderIcon(iconBmp, rect, opacity, draw2D, iconColor ? color : undefined);
        }
        this.drawText(text, font, color, opacity, textRect, align, "center", 0, draw2D, "...", index);
        if (drawFocus && drawFocusOnTop) {
            this.renderFocus(rect, opacity, nodeFocus, draw2D);
        }
        this.hasNinePatch = this.hasNinePatch && drawFocus;
    }

    protected renderIcon(bmp: RoBitmap, rect: Rect, opacity: number, draw2D?: IfDraw2D, color?: number) {
        const iconY = rect.y + (rect.height / 2 - bmp.height / 2);
        const iconRect = { ...rect, y: iconY, width: bmp.width, height: bmp.height };
        this.drawImage(bmp, iconRect, 0, opacity, draw2D, color);
    }
}
