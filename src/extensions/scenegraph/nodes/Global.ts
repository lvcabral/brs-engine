import { AAMember, BrsInvalid } from "brs-engine";
import { Node } from "./Node";
import { sgRoot } from "../SGRoot";
import { SGNodeType } from ".";

export class Global extends Node {
    constructor(members: AAMember[] = []) {
        super([], SGNodeType.Node);
        this.syncType = "global";
        this.registerInitializedFields(members);
        this.owner = 0; // Global node is always owned by render thread
    }

    public setOwner(_threadId: number): void {
        // Global node owner cannot be changed
        return;
    }

    /**
     * On a device the global node is parented to the Scene — `m.global.getParent()` returns it —
     * which is what puts the Scene in reach of `m.global.findNode()`: the Scene becomes the global
     * node's nearest component ancestor, so the ordinary `ifSGNodeDict` search covers the scene
     * tree. The link is resolved on demand rather than stored, so it follows the current Scene and
     * leaves no stale pointer when the app swaps screens.
     *
     * The global node deliberately stays out of the Scene's *children*, matching the device: a node
     * appended to `m.global` is not reachable from `m.top.findNode()` (nor from `m.global`'s own
     * search, which runs against the Scene), and the render pass never walks into it.
     */
    getNodeParent(): Node | BrsInvalid {
        return sgRoot.scene ?? BrsInvalid.Instance;
    }
}
