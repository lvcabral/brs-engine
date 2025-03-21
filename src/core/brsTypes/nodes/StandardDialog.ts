import { FieldModel } from "./Field";
import { Group } from "./Group";
import { AAMember } from "../components/RoAssociativeArray";

export class StandardDialog extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "width", type: "float", value: "0.0" },
        { name: "height", type: "float", value: "0.0" },
        { name: "buttonSelected", type: "integer", value: "0" },
        { name: "buttonFocused", type: "integer", value: "0" },
        { name: "palette", type: "node" },
        { name: "close", type: "boolean", value: "false" },
        { name: "wasClosed", type: "boolean" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "StandardDialog") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

    }
}
