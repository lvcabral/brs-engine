import { FieldModel } from "../components/RoSGNode";
import { Group } from "./Group";
import { AAMember } from "../components/RoAssociativeArray";

export class TextEditBox extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "text", type: "string", value: "" },
        { name: "hintText", type: "string", value: "" },
        { name: "maxTextLength", type: "integer", value: "15" },
        { name: "cursorPosition", type: "integer", value: "0" },
        { name: "clearOnDownKey", type: "boolean", value: "true" },
        { name: "active", type: "boolean", value: "false" },
        { name: "textColor", type: "string", value: "OxFFFFFFFF" },
        { name: "hintTextColor", type: "string", value: "OxFFFFFFFF" },
        { name: "width", type: "float", value: "-1.0" },
        { name: "backgroundUri", type: "string", value: "" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "TextEditBox") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }
}
