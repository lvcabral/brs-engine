import { AAMember, BrsType, fromSGNode, isBrsString, jsValueOf, Node, sgRoot } from "..";
import { FieldKind } from "./Field";

export class Global extends Node {
    constructor(members: AAMember[] = [], readonly name: string = "Node") {
        super([], name);
        this.registerInitializedFields(members);
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind, sync: boolean = true) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.getValue().toLowerCase();
        const result = super.set(index, value, alwaysNotify, kind);
        // Notify other threads of field changes
        if (sync && sgRoot.tasks.length > 0 && this.changed && this.fields.has(fieldName)) {
            this.sendThreadUpdate(sgRoot.taskId, "global", fieldName, value);
            if (sgRoot.inTaskThread()) this.changed = false;
        }
        return result;
    }
}
