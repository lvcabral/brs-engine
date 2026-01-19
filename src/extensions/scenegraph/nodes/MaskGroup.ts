import { AAMember } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";

export class MaskGroup extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "maskUri", type: "uri", value: "" },
        { name: "maskSize", type: "vector2d", value: "[0, 0]" },
        { name: "maskOffset", type: "vector2d", value: "[0, 0]" },
        { name: "maskBitmapWidth", type: "float", value: "0" },
        { name: "maskBitmapHeight", type: "float", value: "0" },
    ];
    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.MaskGroup) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }
}
