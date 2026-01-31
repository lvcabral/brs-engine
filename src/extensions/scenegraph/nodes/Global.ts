import { AAMember, BrsType } from "brs-engine";
import { Node } from "./Node";
import { sgRoot } from "../SGRoot";
import { FieldKind } from "../SGTypes";
import { SGNodeType } from ".";

export class Global extends Node {
    constructor(members: AAMember[] = [], readonly name: string = SGNodeType.Node) {
        super([], name);
        this.registerInitializedFields(members);
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind, sync: boolean = true) {
        const fieldName = index.toLowerCase();
        super.setValue(index, value, alwaysNotify, kind);
        // Notify other threads of field changes
        if (sync && sgRoot.getTasksCount() > 0 && this.changed && this.fields.has(fieldName)) {
            this.sendThreadUpdate(sgRoot.threadId, "global", fieldName, value);
            if (sgRoot.inTaskThread()) this.changed = false;
        }
    }
}
