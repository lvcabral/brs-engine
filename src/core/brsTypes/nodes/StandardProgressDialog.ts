import { FieldModel } from "./Field";
import { StandardDialog } from "./StandardDialog";
import { AAMember } from "../components/RoAssociativeArray";

export class StandardProgressDialog extends StandardDialog {
    readonly defaultFields: FieldModel[] = [
        { name: "title", type: "string", value: "" },
        { name: "message", type: "string", value: "" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "StandardProgressDialog") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

    }
}
