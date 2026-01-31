import { AAMember, BrsType, isBrsString } from "brs-engine";
import { Node } from "./Node";
import { sgRoot } from "../SGRoot";
import { FieldKind } from "../SGTypes";
import { SGNodeType } from ".";

export class Global extends Node {
    constructor(members: AAMember[] = [], readonly name: string = SGNodeType.Node) {
        super([], name);
        this.registerInitializedFields(members);
        this.setThreadSyncType("global");
        this.owner = 0; // Global node is always owned by render thread
    }

    get(index: BrsType): BrsType {
        if (sgRoot.inTaskThread() && isBrsString(index)) {
            const fieldName = index.toString().toLowerCase();
            if (this.owner !== sgRoot.threadId && this.fields.has(fieldName)) {
                const task = sgRoot.getCurrentThreadTask();
                if (task?.active && !this.consumeFreshField(fieldName)) {
                    task.requestFieldValue("global", fieldName);
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

    public setOwner(_threadId: number): void {
        // Global node owner cannot be changed
        return;
    }
}
