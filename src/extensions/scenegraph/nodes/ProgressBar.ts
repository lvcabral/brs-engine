import { AAMember } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";

export class ProgressBar extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "width", type: "float", value: "0.0" },
        { name: "height", type: "float", value: "0.0" },
        { name: "emptyBarBlendColor", type: "color", value: "0xffffffff" },
        { name: "emptyBarImageUri", type: "uri", value: "" },
        { name: "filledBarBlendColor", type: "color", value: "0xffffffff" },
        { name: "filledBarImageUri", type: "uri", value: "" },
        { name: "trackBlendColor", type: "color", value: "0xffffffff" },
        { name: "trackImageUri", type: "uri", value: "" },
        { name: "percentage", type: "integer", value: "0" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.ProgressBar) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }
}
