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
    jsValueOf,
    RoArray,
    rootObjects,
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

    private readonly checkOnHDUri = "common:/images/icon_checkboxON_HD.png";
    private readonly checkOffHDUri = "common:/images/icon_checkboxOFF_HD.png";
    private readonly checkOnFHDUri = "common:/images/icon_checkboxON_FHD.png";
    private readonly checkOffFHDUri = "common:/images/icon_checkboxOFF_FHD.png";

    constructor(initializedFields: AAMember[] = [], readonly name: string = "CheckList") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (rootObjects.rootScene?.ui && rootObjects.rootScene.ui.resolution === "FHD") {
            this.setFieldValue("checkedIconUri", new BrsString(this.checkOnFHDUri));
            this.setFieldValue("uncheckedIconUri", new BrsString(this.checkOffFHDUri));
            this.setFieldValue("focusedCheckedIconUri", new BrsString(this.checkOnFHDUri));
            this.setFieldValue("focusedUncheckedIconUri", new BrsString(this.checkOffFHDUri));
        } else {
            this.setFieldValue("checkedIconUri", new BrsString(this.checkOnHDUri));
            this.setFieldValue("uncheckedIconUri", new BrsString(this.checkOffHDUri));
            this.setFieldValue("focusedCheckedIconUri", new BrsString(this.checkOnHDUri));
            this.setFieldValue("focusedUncheckedIconUri", new BrsString(this.checkOffHDUri));
        }
        this.setFieldValue("checkedState", new RoArray([]));
    }

    get(index: BrsType) {
        if (index.kind !== ValueKind.String) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.value.toLowerCase();
        if (fieldName === "checkedstate") {
            return this.refreshCheckedState();
        }
        return super.get(index);
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (index.kind !== ValueKind.String) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.value.toLowerCase();
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
        const checkOnSelect = jsValueOf(this.getFieldValue("checkOnSelect"));
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
        nodeFocus: boolean,
        itemFocus: boolean,
        draw2D?: IfDraw2D
    ) {
        const states = jsValueOf(this.getFieldValue("checkedState"));
        const hideIcon = jsValueOf(item.getFieldValue("hideIcon"));
        const icons = states[index]
            ? ["checkedIconUri", "focusedCheckedIconUri"]
            : ["uncheckedIconUri", "focusedUncheckedIconUri"];
        const iconSize = this.getIconSize(icons);
        const text = jsValueOf(item.getFieldValue("title"));
        const iconGap = iconSize[0] > 0 ? iconSize[0] + this.gap : 0;
        const iconIndex = itemFocus ? 1 : 0;
        const bmp = !hideIcon && iconGap > 0 ? this.getBitmap(icons[iconIndex]) : undefined;
        if (!itemFocus) {
            this.renderUnfocused(text, rect, iconGap, true, bmp, draw2D);
        } else {
            this.renderFocused(text, rect, nodeFocus, iconGap, true, bmp, draw2D);
        }
    }

    private refreshCheckedState() {
        let states: boolean[] = [];
        let checkedState = this.getFieldValue("checkedState");
        if (checkedState instanceof RoArray) {
            states = jsValueOf(checkedState);
        }
        const content = this.getFieldValue("content") as ContentNode;
        const contentCount = content.getNodeChildren().length;
        if (states.length < contentCount) {
            states.length = contentCount;
        } else if (states.length > contentCount) {
            states.splice(contentCount);
        }
        console.log("refresh states: ", states);
        const result = brsValueOf(states);
        this.setFieldValue("checkedState", result);
        return result;
    }
}
