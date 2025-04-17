import { RoSGNode } from "../components/RoSGNode";
import { FieldKind } from "./Field";
import { AAMember, BrsType, isBrsString, fromSGNode } from "..";
import SharedObject from "../../SharedObject";

export class Global extends RoSGNode {
    sharedObject: SharedObject;

    constructor(members: AAMember[] = [], readonly name: string = "Node") {
        super([], name);
        this.sharedObject = new SharedObject();

        this.registerInitializedFields(members);
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }

        const mapKey = index.getValue().toLowerCase();

        const retValue = super.set(index, value, alwaysNotify, kind);
        // Refresh SharedObject with latest Node state
        if (this.changed) {
            this.sharedObject.store(fromSGNode(this));
        }
        return retValue;
    }
}
