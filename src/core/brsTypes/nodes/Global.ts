import { AAMember, BrsType, fromSGNode, isBrsString, jsValueOf, Node, sgRoot } from "..";
import { FieldKind } from "./Field";

export class Global extends Node {
    constructor(members: AAMember[] = [], readonly name: string = "Node") {
        super([], name);
        this.registerInitializedFields(members);
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind, sync: boolean = true) {
        const fieldName = index.toLowerCase();
        super.setValue(index, value, alwaysNotify, kind);
        // Notify other threads of field changes
        if (sync && sgRoot.tasks.length > 0 && this.changed && this.fields.has(fieldName)) {
            this.sendThreadUpdate(sgRoot.taskId, "global", fieldName, value);
            if (sgRoot.inTaskThread()) this.changed = false;
        }
    }
}
