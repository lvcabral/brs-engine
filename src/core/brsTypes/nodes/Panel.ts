import { FieldModel } from "./Field";
import { AAMember } from "../components/RoAssociativeArray";
import { Group } from "./Group";

export class Panel extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "panelSize", type: "string", value: "narrow" },
        { name: "leftPosition", type: "float", value: "105" },
        { name: "overhangTitle", type: "string", value: "" },
        { name: "clockText", type: "string", value: "" },
        { name: "optionsAvailable", type: "boolean", value: "false" },
        { name: "leftOrientation", type: "boolean", value: "false" },
        { name: "leftOnly", type: "boolean", value: "false" },
        { name: "hasNextPanel", type: "boolean", value: "false" },
        { name: "isFullScreen", type: "boolean", value: "false" },
        { name: "goBackCount", type: "integer", value: "1" },
        { name: "selectButtonMovesPanelForward", type: "boolean", value: "true" },
        { name: "isOffscreenLeft", type: "boolean", value: "false" },
        { name: "focusable", type: "boolean", value: "true" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Panel") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }
}
