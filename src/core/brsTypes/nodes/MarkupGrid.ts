import { FieldModel } from "../components/RoSGNode";
import { AAMember } from "../components/RoAssociativeArray";
import { ArrayGrid } from "./ArrayGrid";

export class MarkupGrid extends ArrayGrid {
    readonly defaultFields: FieldModel[] = [
        { name: "itemComponentName", type: "string", value: "" },
        { name: "content", type: "node" },
        { name: "itemSize", type: "array", value: "[0,0]" },
        { name: "numColumns", type: "integer", value: "0" },
        { name: "numRows", type: "integer", value: "12" },
        { name: "rowHeights", type: "array", value: "[]" },
        { name: "columnWidths", type: "array", value: "[]" },
        { name: "rowSpacings", type: "array", value: "[]" },
        { name: "columnSpacings", type: "array", value: "[]" },
        { name: "fixedLayout", type: "boolean", value: "false" },
        { name: "imageWellBitmapUri", type: "string", value: "" },
        { name: "drawFocusFeedback", type: "boolean", value: "true" },
        { name: "drawFocusFeedbackOnTop", type: "boolean", value: "false" },
        { name: "focusBitmapUri", type: "string", value: "" },
        { name: "focusFootprintBitmapUri", type: "string", value: "" },
        { name: "focusBitmapBlendColor", type: "string", value: "0xFFFFFFFF" },
        { name: "focusFootprintBlendColor", type: "string", value: "0xFFFFFFFF" },
        { name: "wrapDividerBitmapUri", type: "string", value: "" },
        { name: "wrapDividerHeight", type: "float", value: "0.0" },
        { name: "sectionDividerBitmapUri", type: "string", value: "" },
        { name: "sectionDividerFont", type: "node" },
        { name: "sectionDividerTextColor", type: "string", value: "0xDDDDDDFF" },
        { name: "sectionDividerSpacing", type: "float", value: "10" },
        { name: "sectionDividerHeight", type: "float", value: "40" },
        { name: "sectionDividerMinWidth", type: "float", value: "117" },
        { name: "sectionDividerLeftOffset", type: "float", value: "0" },
        { name: "itemSelected", type: "integer", value: "0" },
        { name: "itemFocused", type: "integer", value: "0" },
        { name: "itemUnfocused", type: "integer", value: "0" },
        { name: "jumpToItem", type: "integer", value: "0" },
        { name: "animateToItem", type: "integer", value: "0" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "MarkupGrid") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }
}
