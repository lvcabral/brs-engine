import { AAMember } from "../components/RoAssociativeArray";
import { ArrayGrid } from "./ArrayGrid";
import { FieldModel } from "./Field";

export class RowList extends ArrayGrid {
    readonly defaultFields: FieldModel[] = [
        { name: "itemComponentName", type: "string", value: "" },
        { name: "rowTitleComponentName", type: "string", value: "" },
        { name: "numRows", type: "integer", value: "0" },
        { name: "numColumns", type: "integer", value: "1" },
        { name: "rowItemSize", type: "array", value: "[]" },
        { name: "rowItemSpacing", type: "array", value: "[]" },
        { name: "rowItemSelected", type: "array", value: "[]", alwaysNotify: true },
        { name: "rowItemFocused", type: "array", value: "[]", alwaysNotify: true },
        { name: "jumpToRowItem", type: "array", value: "[]" },
        { name: "vertFocusAnimationStyle", type: "string", value: "fixedFocusWrap" },
    ];
    protected readonly focusUri = "common:/images/focus_list.9.png";
    protected readonly footprintUri = "common:/images/focus_footprint.9.png";

    constructor(initializedFields: AAMember[] = [], readonly name: string = "RowList") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }
}
