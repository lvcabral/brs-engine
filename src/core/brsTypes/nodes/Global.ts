import { AAMember, BrsType, fromSGNode, isBrsString, jsValueOf, sgRoot } from "..";
import { RoSGNode } from "../components/RoSGNode";
import { FieldKind } from "./Field";
import { ThreadUpdate } from "../../common";

export class Global extends RoSGNode {
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
        if (sync && sgRoot.tasks.length > 0 && this.changed && this.sgNode.fields.has(fieldName)) {
            const update: ThreadUpdate = {
                id: sgRoot.threadId,
                type: "global",
                field: fieldName,
                value: value instanceof RoSGNode ? fromSGNode(value, false) : jsValueOf(value),
            };
            postMessage(update);
        }
        return result;
    }
}
