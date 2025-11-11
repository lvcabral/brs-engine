import { AAMember, BrsType, fromSGNode, isBrsString, jsValueOf, Node, sgRoot } from "..";
import { FieldKind } from "./Field";
import { ThreadUpdate } from "../../common";

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
        // Refresh SharedObject with latest Node state
        if (sync && sgRoot.tasks.length > 0 && this.changed && this.fields.has(fieldName)) {
            const update: ThreadUpdate = {
                id: sgRoot.threadId,
                type: "global",
                field: fieldName,
                value: value instanceof Node ? fromSGNode(value, false) : jsValueOf(value),
            };
            postMessage(update);
        }
        return result;
    }
}
