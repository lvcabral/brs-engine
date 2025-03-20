import { FieldModel } from "./Field";
import { Label } from "./Label";
import { AAMember } from "..";

export class ScrollingLabel extends Label {
    readonly defaultFields: FieldModel[] = [
        { name: "scrollSpeed", type: "float", value: "100" },
        { name: "repeatCount", type: "float", value: "-1" },
        { name: "maxWidth", type: "integer", value: "500" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "ScrollingLabel") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

}
