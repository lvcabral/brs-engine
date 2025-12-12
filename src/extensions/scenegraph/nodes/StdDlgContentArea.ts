import { SGNodeType } from ".";
import { Group } from "./Group";
import { AAMember } from "brs-engine";

export class StdDlgContentArea extends Group {
    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.StdDlgContentArea) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerInitializedFields(initializedFields);
    }
}
