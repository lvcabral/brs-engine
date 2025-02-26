import { FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { LayoutGroup } from "./LayoutGroup";

export class ButtonGroup extends LayoutGroup {
    readonly defaultFields: FieldModel[] = [
        { name: "textColor", type: "color", value: "0xffffffff" },
        { name: "focusedTextColor", type: "color", value: "0xffffffff" },
        { name: "textFont", type: "font" },
        { name: "focusedTextFont", type: "font" },
        { name: "focusBitmapUri", type: "string", value: "" },
        { name: "focusFootprintBitmapUri", type: "string", value: "" },
        { name: "iconUri", type: "string", value: "" },
        { name: "focusedIconUri", type: "string", value: "" },
        { name: "minWidth", type: "float", value: "0.0" },
        { name: "maxWidth", type: "float", value: "32767" },
        { name: "buttonHeight", type: "float", value: "0.0" },
        { name: "rightJustify", type: "boolean", value: "false" },
        { name: "buttonSelected", type: "integer", value: "0" },
        { name: "buttonFocused", type: "integer", value: "0" },
        { name: "focusButton", type: "integer", value: "0" },
        { name: "buttons", type: "array" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "ButtonGroup") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }
}
