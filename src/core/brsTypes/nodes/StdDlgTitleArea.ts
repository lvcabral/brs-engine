import { FieldModel } from "./Field";
import { Group } from "./Group";
import { AAMember } from "../components/RoAssociativeArray";

export class StdDlgTitleArea extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "primaryTitle", type: "string", value: "" },
        { name: "primaryIcon", type: "uri" },
        { name: "primaryIconVertOffset", type: "float", value: "0.0" },
        { name: "secondaryIcon", type: "uri" },
        { name: "secondaryIconVertOffset", type: "float", value: "0.0" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "StdDlgTitleArea") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }
}
