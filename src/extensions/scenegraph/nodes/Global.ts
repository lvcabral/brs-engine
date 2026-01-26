import { AAMember, BrsDevice, BrsType, isBrsString } from "brs-engine";
import { Node } from "./Node";
import { sgRoot } from "../SGRoot";
import { FieldKind } from "../SGTypes";
import { SGNodeType } from ".";

export class Global extends Node {
    constructor(members: AAMember[] = [], readonly name: string = SGNodeType.Node) {
        super([], name);
        this.registerInitializedFields(members);
    }

    get(index: BrsType): BrsType {
        if (sgRoot.inTaskThread() && isBrsString(index)) {
            const fieldName = index.toString().toLowerCase();
            if (this.owner !== sgRoot.threadId && this.fields.has(fieldName)) {
                const task = sgRoot.getCurrentThreadTask();
                if (task?.active) {
                    if (!this.consumeFreshField(fieldName)) {
                        task.requestFieldValue("global", fieldName);
                    }
                }
            }
        }
        return super.get(index);
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind, sync: boolean = true) {
        const fieldName = index.toLowerCase();
        super.setValue(index, value, alwaysNotify, kind);
        if (sync && this.changed) {
            this.syncRemoteObservers(fieldName, "global");
            if (sgRoot.inTaskThread()) {
                this.changed = false;
            }
        }
    }
}
