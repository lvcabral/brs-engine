import { RoSGNode } from "../components/RoSGNode";
import { FieldKind } from "./Field";
import { AAMember, BrsType, isBrsString, fromSGNode, brsValueOf, BrsString } from "..";
import SharedObject from "../../SharedObject";

export class Global extends RoSGNode {
    private dataVersion: number;
    sharedObject: SharedObject;

    constructor(members: AAMember[] = [], readonly name: string = "Node") {
        super([], name);
        this.registerInitializedFields(members);

        this.sharedObject = new SharedObject();
        this.sharedObject.store(fromSGNode(this));
        this.dataVersion = this.sharedObject.getVersion();
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.getValue().toLowerCase();
        const retValue = super.set(index, value, alwaysNotify, kind);
        // Refresh SharedObject with latest Node state
        if (this.changed) {
            const data = fromSGNode(this);
            data["_updated_"] = fieldName;
            this.sharedObject.store(data);
            this.dataVersion = this.sharedObject.getVersion();
        }
        return retValue;
    }

    refresh() {
        const currVersion = this.sharedObject.getVersion();
        if (this.dataVersion !== currVersion) {
            const global = this.sharedObject.load();
            const updated = global["_updated_"] as string;
            for (let [key, value] of Object.entries(global)) {
                if (key.startsWith("_") && key.endsWith("_") && key.length > 2) {
                    // Ignore other transfer metadata fields
                    continue;
                } else if (key === updated) {
                    super.set(new BrsString(key), brsValueOf(value));
                } else {
                    this.setFieldValue(key, brsValueOf(value));
                }
            }
            this.dataVersion = currVersion;
        }
    }
}
