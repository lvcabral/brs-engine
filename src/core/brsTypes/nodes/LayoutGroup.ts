import { FieldModel } from "../components/RoSGNode";
import { AAMember } from "../components/RoAssociativeArray";
import { Group } from "./Group";

export class LayoutGroup extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "layoutDirection", type: "string", value: "vert" },
        { name: "horizAlignment", type: "string", value: "left" },
        { name: "vertAlignment", type: "string", value: "top" },
        { name: "itemSpacings", type: "array" },
        { name: "addItemSpacingAfterChild", type: "boolean", value: "true" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "LayoutGroup") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }
}
