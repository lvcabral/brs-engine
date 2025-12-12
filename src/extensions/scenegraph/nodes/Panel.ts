import { AAMember, BrsBoolean } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
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
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.Panel) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        this.setValueSilent("focusable", BrsBoolean.True);
    }
}
