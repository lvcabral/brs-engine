import { FieldModel } from "../components/RoSGNode";
import { AAMember } from "../components/RoAssociativeArray";
import { Group } from "./Group";

export class ArrayGrid extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "content", type: "node" },
        { name: "itemSize", type: "array", value: "[0,0]" },
        { name: "itemSpacing", type: "array", value: "[0,0]" },
        { name: "numRows", type: "integer", value: "0" },
        { name: "numColumns", type: "integer", value: "0" },
        { name: "focusRow", type: "integer", value: "0" },
        { name: "focusColumn", type: "integer", value: "0" },
        { name: "horizFocusAnimationStyle", type: "string", value: "floatingFocus" },
        { name: "vertFocusAnimationStyle", type: "string", value: "floatingFocus" },
        { name: "drawFocusFeedbackOnTop", type: "boolean", value: "false" },
        { name: "drawFocusFeedback", type: "boolean", value: "true" },
        { name: "fadeFocusFeedbackWhenAutoScrolling", type: "boolean", value: "false" },
        { name: "currFocusFeedbackOpacity", type: "float", value: "read-only" },
        { name: "focusBitmapUri", type: "string", value: "" },
        { name: "focusFootprintBitmapUri", type: "string", value: "" },
        { name: "focusBitmapBlendColor", type: "string", value: "0xFFFFFFFF" },
        { name: "focusFootprintBlendColor", type: "string", value: "0xFFFFFFFF" },
        { name: "wrapDividerBitmapUri", type: "string", value: "" },
        { name: "wrapDividerWidth", type: "float", value: "0" },
        { name: "wrapDividerHeight", type: "float", value: "36" },
        { name: "fixedLayout", type: "boolean", value: "false" },
        { name: "numRenderPasses", type: "integer", value: "1" },
        { name: "rowHeights", type: "array", value: "[]" },
        { name: "columnWidths", type: "array", value: "[]" },
        { name: "rowSpacings", type: "array", value: "[]" },
        { name: "columnSpacings", type: "array", value: "[]" },
        { name: "sectionDividerBitmapUri", type: "string", value: "" },
        { name: "sectionDividerFont", type: "node" },
        { name: "sectionDividerTextColor", type: "string" },
        { name: "sectionDividerSpacing", type: "float", value: "0.0" },
        { name: "sectionDividerWidth", type: "float", value: "0.0" },
        { name: "sectionDividerHeight", type: "float", value: "0.0" },
        { name: "sectionDividerMinWidth", type: "float", value: "0.0" },
        { name: "sectionDividerLeftOffset", type: "float", value: "0.0" },
        { name: "itemClippingRect", type: "array", value: "[ 0.0, 0.0, 0.0, 0.0 ]" },
        { name: "itemSelected", type: "integer", value: "0" },
        { name: "itemFocused", type: "integer", value: "0" },
        { name: "itemUnfocused", type: "integer", value: "0" },
        { name: "jumpToItem", type: "integer", value: "0" },
        { name: "animateToItem", type: "integer", value: "0" },
        { name: "currFocusRow", type: "float", value: "0.0" },
        { name: "currFocusColumn", type: "float", value: "0.0" },
        { name: "currFocusSection", type: "float", value: "0.0" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "ArrayGrid") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }
}
