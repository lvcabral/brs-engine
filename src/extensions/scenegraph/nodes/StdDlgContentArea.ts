import { Group } from "./Group";
import { AAMember } from "brs-engine";

export class StdDlgContentArea extends Group {
    constructor(initializedFields: AAMember[] = [], readonly name: string = "StdDlgContentArea") {
        super([], name);

        this.registerInitializedFields(initializedFields);
    }
}
