import { AAMember, BrsString, Int32, IfDraw2D, Rect } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { jsValueOf } from "../factory/Serializer";
import { LabelList } from "./LabelList";
import { ContentNode } from "./ContentNode";

export class RadioButtonList extends LabelList {
    readonly defaultFields: FieldModel[] = [
        { name: "checkedItem", type: "integer", value: "-1" },
        { name: "checkOnSelect", type: "boolean", value: "true" },
        { name: "checkedIconUri", type: "uri", value: "" },
        { name: "focusedCheckedIconUri", type: "uri", value: "" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.RadioButtonList) {
        super([], name);
        this.setExtendsType(name, SGNodeType.LabelList);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        const checkmarkUri = `common:/images/${this.resolution}/icon_checkmark.png`;
        this.setValueSilent("checkedIconUri", new BrsString(checkmarkUri));
        this.setValueSilent("focusedCheckedIconUri", new BrsString(checkmarkUri));
    }

    protected handleOK(press: boolean) {
        if (!press) {
            return false;
        }
        const checkOnSelect = jsValueOf(this.getValue("checkOnSelect"));
        if (checkOnSelect) {
            this.setValue("checkedItem", new Int32(this.focusIndex));
        }
        this.setValue("itemSelected", new Int32(this.focusIndex));
        return true;
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
        const text = jsValueOf(item.getValue("title"));
        const checked = jsValueOf(this.getValue("checkedItem"));
        const icons = ["checkedIconUri", "focusedCheckedIconUri"];
        const iconSize = this.getIconSize(icons);
        const iconGap = iconSize[0] > 0 ? iconSize[0] + this.gap : 0;
        const showIcon = index === checked && iconGap > 0;
        const iconIndex = itemFocus ? 1 : 0;
        const bmp = showIcon ? this.getBitmap(icons[iconIndex]) : undefined;
        if (itemFocus) {
            this.renderFocused(index, text, rect, opacity, nodeFocus, iconGap, true, bmp, draw2D);
        } else {
            this.renderUnfocused(index, text, rect, opacity, iconGap, true, bmp, draw2D);
        }
    }
}
