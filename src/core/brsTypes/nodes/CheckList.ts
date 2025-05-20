import { FieldKind, FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { LabelList } from "./LabelList";
import {
    BrsInvalid,
    BrsString,
    BrsType,
    brsValueOf,
    ContentNode,
    Int32,
    isBrsString,
    jsValueOf,
    RoArray,
    ValueKind,
} from "..";
import { IfDraw2D, Rect } from "../interfaces/IfDraw2D";

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

        this.setFieldValue("checkedIconUri", new BrsString(checkOnUri));
        this.setFieldValue("uncheckedIconUri", new BrsString(checkOffUri));
        this.setFieldValue("focusedCheckedIconUri", new BrsString(checkOnUri));
        this.setFieldValue("focusedUncheckedIconUri", new BrsString(checkOffUri));
        this.setFieldValue("checkedState", new RoArray([]));
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

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.getValue().toLowerCase();
        if (fieldName === "checkedstate") {
            let states: boolean[] = [];
            let checkedState = this.getFieldValue("checkedState");
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
                return BrsInvalid.Instance;
            }
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    protected handleOK(press: boolean) {
        if (!press) {
            return false;
        }
        const checkOnSelect = this.getFieldValueJS("checkOnSelect");
        const checkedState = this.getFieldValue("checkedState");
        if (checkOnSelect && checkedState instanceof RoArray) {
            const states = jsValueOf(checkedState);
            states[this.focusIndex] = !states[this.focusIndex];
            this.set(new BrsString("checkedState"), brsValueOf(states));
        }
        this.set(new BrsString("itemSelected"), new Int32(this.focusIndex));
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
        const states = this.getFieldValueJS("checkedState");
        const hideIcon = item.getFieldValueJS("hideIcon");
        const icons = states[index]
            ? ["checkedIconUri", "focusedCheckedIconUri"]
            : ["uncheckedIconUri", "focusedUncheckedIconUri"];
        const iconSize = this.getIconSize(icons);
        const text = item.getFieldValueJS("title");
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
        let checkedState = this.getFieldValue("checkedState");
        if (checkedState instanceof RoArray) {
            states = jsValueOf(checkedState);
        }
        const content = this.getFieldValue("content");
        if (content instanceof ContentNode) {
            const contentCount = content.getNodeChildren().length;
            if (states.length < contentCount) {
                states.length = contentCount;
            } else if (states.length > contentCount) {
                states.splice(contentCount);
            }
        }
        const result = brsValueOf(states);
        this.setFieldValue("checkedState", result);
        return result;
    }
}
