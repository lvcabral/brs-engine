import { AAMember } from "brs-engine";
import { Node } from "./Node";
import { SGNodeType } from ".";

export class Global extends Node {
    constructor(members: AAMember[] = []) {
        super([], SGNodeType.Node);
        this.registerInitializedFields(members);
        this.owner = 0; // Global node is always owned by render thread
    }

    public setOwner(_threadId: number): void {
        // Global node owner cannot be changed
        return;
    }
}
