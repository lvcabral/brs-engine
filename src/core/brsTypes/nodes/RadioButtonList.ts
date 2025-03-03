import { FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { LabelList } from "./LabelList";
import { BrsString, ContentNode, Int32, jsValueOf, rootObjects, RoSGNode } from "..";
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

    constructor(initializedFields: AAMember[] = [], readonly name: string = "RadioButtonList") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

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
        rect: Rect,
        nodeFocus: boolean,
        itemFocus: boolean,
        draw2D?: IfDraw2D
    ) {
        const text = jsValueOf(item.getFieldValue("title"));
        const checked = jsValueOf(this.getFieldValue("checkedItem"));
        const icons = ["checkedIconUri", "focusedCheckedIconUri"];
        const iconSize = this.getIconSize(icons);
        const iconGap = iconSize[0] > 0 ? iconSize[0] + this.gap : 0;
        const showIcon = index === checked && iconGap > 0;
        const bmp = showIcon ? this.getBitmap(icons[itemFocus ? 1 : 0]) : undefined;
        if (!itemFocus) {
            this.renderUnfocused(text, rect, iconGap, true, bmp, draw2D);
        } else {
            this.renderFocused(text, rect, nodeFocus, iconGap, true, bmp, draw2D);
        }
    }
}
