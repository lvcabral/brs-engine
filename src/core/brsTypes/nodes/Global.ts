import { RoSGNode } from "../components/RoSGNode";
import { FieldKind } from "./Field";
import { AAMember, BrsType, isBrsString, jsValueOf } from "..";
import { BrsDevice } from "../../device/BrsDevice";
import { ThreadUpdate } from "../../common";

export class Global extends RoSGNode {
    constructor(members: AAMember[] = [], readonly name: string = "Node") {
        super([], name);
        this.registerInitializedFields(members);
    }

    set(
        index: BrsType,
        value: BrsType,
        alwaysNotify: boolean = false,
        kind?: FieldKind,
        sync: boolean = true
    ) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.getValue().toLowerCase();
        // Refresh SharedObject with latest Node state
        if (this.changed && this.fields.has(fieldName) && sync) {
            const update: ThreadUpdate = {
                id: BrsDevice.threadId,
                global: true,
                field: fieldName,
                value: jsValueOf(value),
            };
            postMessage(update);
        }
        return super.set(index, value, alwaysNotify, kind);
    }
}
