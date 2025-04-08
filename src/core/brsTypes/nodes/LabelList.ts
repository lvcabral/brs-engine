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
    ValueKind,
} from "..";
import { Interpreter } from "../..";
import { IfDraw2D, Rect } from "../interfaces/IfDraw2D";

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
    protected readonly margin: number;
    protected readonly gap: number;

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
        const style = jsValueOf(this.getFieldValue("vertFocusAnimationStyle")) as string;
        this.wrap = style.toLowerCase() === "fixedfocuswrap";
        this.hasNinePatch = true;
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (index.kind !== ValueKind.String) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.value.toLowerCase();
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
            const step = Math.max(1, jsValueOf(this.getFieldValue("numRows")) - 2);
            const offset = key === "rewind" ? -step : step;
            nextIndex = this.getIndex(offset);
        } else {
            nextIndex = key === "rewind" ? 0 : this.content.length - 1;
            this.currRow = key === "rewind" ? 0 : jsValueOf(this.getFieldValue("numRows")) - 1;
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
        draw2D?: IfDraw2D
    ) {
        if (this.content.length === 0) {
            return;
        }
        const hasSections = this.metadata.length > 0;
        const nodeFocus = rootObjects.focused === this;
        this.currRow = this.updateCurrRow();
        let lastIndex = -1;
        const numRows = jsValueOf(this.getFieldValue("numRows")) as number;
        const displayRows = Math.min(this.content.length, numRows);
        const itemSize = jsValueOf(this.getFieldValue("itemSize")) as number[];
        const itemRect = { ...rect, width: itemSize[0], height: itemSize[1] };
        for (let r = 0; r < displayRows; r++) {
            const index = this.getIndex(r - this.currRow);
            const focused = index === this.focusIndex;
            const item = this.content[index];
            if (item instanceof ContentNode) {
                if (!hasSections && this.wrap && index < lastIndex && r > 0) {
                    itemRect.y += this.renderWrapDivider(itemRect, draw2D);
                } else if (hasSections && this.wrap && this.metadata[index]?.divider && r > 0) {
                    const divText = this.metadata[index].sectionTitle;
                    itemRect.y += this.renderSectionDivider(divText, itemRect, draw2D);
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
    }

    protected renderItem(
        _index: number,
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
}
