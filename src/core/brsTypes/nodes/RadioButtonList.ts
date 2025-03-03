import { FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { LabelList } from "./LabelList";
import { Font } from "./Font";
import { BrsString, ContentNode, Int32, jsValueOf, rootObjects } from "..";
import { IfDraw2D, Rect } from "../interfaces/IfDraw2D";

export class RadioButtonList extends LabelList {
    readonly defaultFields: FieldModel[] = [
        { name: "checkedItem", type: "integer", value: "-1" },
        { name: "checkOnSelect", type: "boolean", value: "true" },
        { name: "checkedIconUri", type: "uri", value: "" },
        { name: "focusedCheckedIconUri", type: "uri", value: "" },
    ];

    private readonly checkmarkHDUri = "common:/images/icon_checkmark_HD.png";
    private readonly checkmarkFHDUri = "common:/images/icon_checkmark_FHD.png";
    private readonly gap: number;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "RadioButtonList") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.gap = this.margin / 2;
        if (rootObjects.rootScene?.ui && rootObjects.rootScene.ui.resolution === "FHD") {
            this.setFieldValue("checkedIconUri", new BrsString(this.checkmarkFHDUri));
            this.setFieldValue("focusedCheckedIconUri", new BrsString(this.checkmarkFHDUri));
        } else {
            this.setFieldValue("checkedIconUri", new BrsString(this.checkmarkHDUri));
            this.setFieldValue("focusedCheckedIconUri", new BrsString(this.checkmarkHDUri));
        }
    }

    protected handleOK(press: boolean) {
        if (!press) {
            return false;
        }
        const checkOnSelect = jsValueOf(this.getFieldValue("checkOnSelect"));
        if (checkOnSelect) {
            this.set(new BrsString("checkedItem"), new Int32(this.focusIndex));
        }
        this.set(new BrsString("itemSelected"), new Int32(this.focusIndex));
        return true;
    }

    protected renderItem(
        index: number,
        item: ContentNode,
        itemRect: Rect,
        rotation: number,
        nodeFocus: boolean,
        itemFocus: boolean,
        draw2D?: IfDraw2D
    ) {
        const text = jsValueOf(item.getFieldValue("title"));
        const iconSize = this.getIconSize();
        const iconGap = iconSize[0] > 0 ? iconSize[0] + this.gap : 0;
        const textRect = { ...itemRect, x: itemRect.x + iconGap };
        let font = this.getFieldValue("font") as Font;
        let color = jsValueOf(this.getFieldValue("color"));
        const align = jsValueOf(this.getFieldValue("textHorizAlign"));
        const checked = jsValueOf(this.getFieldValue("checkedItem"));
        if (!itemFocus) {
            if (iconGap > 0 && index === checked) {
                this.drawIcon("checkedIconUri", itemRect, rotation, draw2D, color);
            }
            this.drawText(text, font, color, textRect, align, "center", rotation, draw2D);
            return;
        }
        const drawFocus = jsValueOf(this.getFieldValue("drawFocusFeedback"));
        const drawFocusOnTop = jsValueOf(this.getFieldValue("drawFocusFeedbackOnTop"));
        if (drawFocus && !drawFocusOnTop) {
            this.renderFocus(itemRect, nodeFocus, rotation, draw2D);
        }
        if (nodeFocus) {
            font = this.getFieldValue("focusedFont") as Font;
            color = jsValueOf(this.getFieldValue("focusedColor"));
        }
        if (iconGap > 0 && index === checked) {
            this.drawIcon("focusedCheckedIconUri", itemRect, rotation, draw2D, color);
        }
        this.drawText(text, font, color, textRect, align, "center", rotation, draw2D);
        if (drawFocus && drawFocusOnTop) {
            this.renderFocus(itemRect, nodeFocus, rotation, draw2D);
        }
        this.hasNinePatch = this.hasNinePatch && drawFocus;
    }

    private drawIcon(uri: string, rect: Rect, angle: number, draw2D?: IfDraw2D, color?: number) {
        const bmp = this.getBitmap(uri);
        if (bmp) {
            const iconY = rect.y + (rect.height / 2 - bmp.height / 2);
            const iconRect = { ...rect, y: iconY, width: bmp.width, height: bmp.height };
            this.drawImage(bmp, iconRect, angle, draw2D, color);
        }
    }

    private getIconSize() {
        let width = 0;
        let height = 0;
        for (const uri of ["checkedIconUri", "focusedCheckedIconUri"]) {
            const bmp = this.getBitmap(uri);
            if (bmp) {
                width = Math.max(width, bmp.width);
                height = Math.max(height, bmp.height);
            }
        }
        return [width, height];
    }
}
