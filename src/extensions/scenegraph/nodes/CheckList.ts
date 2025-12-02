import { FieldKind, FieldModel } from "../SGTypes";
import { AAMember, BrsType, BrsString, RoArray, isBrsString, Int32, ValueKind, IfDraw2D, Rect } from "brs-engine";
import { brsValueOf, jsValueOf } from "../factory/serialization";
import { LabelList } from "./LabelList";
import { ContentNode } from "./ContentNode";

export class CheckList extends LabelList {
    readonly defaultFields: FieldModel[] = [
        { name: "checkedState", type: "array" },
        { name: "checkOnSelect", type: "boolean", value: "true" },
        { name: "checkedIconUri", type: "uri", value: "" },
        { name: "uncheckedIconUri", type: "uri", value: "" },
        { name: "focusedCheckedIconUri", type: "uri", value: "" },
        { name: "focusedUncheckedIconUri", type: "uri", value: "" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "CheckList") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        const checkOnUri = `common:/images/${this.resolution}/icon_checkboxON.png`;
        const checkOffUri = `common:/images/${this.resolution}/icon_checkboxOFF.png`;

        this.setValueSilent("checkedIconUri", new BrsString(checkOnUri));
        this.setValueSilent("uncheckedIconUri", new BrsString(checkOffUri));
        this.setValueSilent("focusedCheckedIconUri", new BrsString(checkOnUri));
        this.setValueSilent("focusedUncheckedIconUri", new BrsString(checkOffUri));
        this.setValueSilent("checkedState", new RoArray([]));
    }

    get(index: BrsType) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.getValue().toLowerCase();
        if (fieldName === "checkedstate") {
            return this.refreshCheckedState();
        }
        return super.get(index);
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "checkedstate") {
            let states: boolean[] = [];
            let checkedState = this.getValue("checkedState");
            if (checkedState instanceof RoArray) {
                states = jsValueOf(checkedState);
            }
            if (value instanceof RoArray && value.elements.length) {
                for (let i = 0; i < value.elements.length; i++) {
                    const checked = value.elements[i];
                    if (checked.kind === ValueKind.Boolean) {
                        states[i] = checked.getValue();
                    }
                }
                value = brsValueOf(states);
            } else {
                return;
            }
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    protected handleOK(press: boolean) {
        if (!press) {
            return false;
        }
        const checkOnSelect = this.getValueJS("checkOnSelect");
        const checkedState = this.getValue("checkedState");
        if (checkOnSelect && checkedState instanceof RoArray) {
            const states = jsValueOf(checkedState);
            states[this.focusIndex] = !states[this.focusIndex];
            this.setValue("checkedState", brsValueOf(states));
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
        const states = this.getValueJS("checkedState");
        const hideIcon = item.getValueJS("hideIcon");
        const icons = states[index]
            ? ["checkedIconUri", "focusedCheckedIconUri"]
            : ["uncheckedIconUri", "focusedUncheckedIconUri"];
        const iconSize = this.getIconSize(icons);
        const text = item.getValueJS("title");
        const iconGap = iconSize[0] > 0 ? iconSize[0] + this.gap : 0;
        const iconIndex = itemFocus ? 1 : 0;
        const bmp = !hideIcon && iconGap > 0 ? this.getBitmap(icons[iconIndex]) : undefined;
        if (!itemFocus) {
            this.renderUnfocused(index, text, rect, opacity, iconGap, true, bmp, draw2D);
        } else {
            this.renderFocused(index, text, rect, opacity, nodeFocus, iconGap, true, bmp, draw2D);
        }
    }

    private refreshCheckedState() {
        let states: boolean[] = [];
        let checkedState = this.getValue("checkedState");
        if (checkedState instanceof RoArray) {
            states = jsValueOf(checkedState);
        }
        const content = this.getValue("content");
        if (content instanceof ContentNode) {
            const contentCount = content.getNodeChildren().length;
            if (states.length < contentCount) {
                states.length = contentCount;
            } else if (states.length > contentCount) {
                states.splice(contentCount);
            }
        }
        const result = brsValueOf(states);
        this.setValueSilent("checkedState", result);
        return result;
    }
}
