import { AAMember } from "brs-engine";
import { SGNodeType } from ".";
import { GridPanel } from "./GridPanel";

export class ListPanel extends GridPanel {
    // ListPanel has the same fields and behavior as GridPanel
    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.ListPanel) {
        super([], name);
        this.registerInitializedFields(initializedFields);
    }
}
