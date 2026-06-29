const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, sgRoot } = scenegraph;
const { BrsBoolean } = core;

/** Builds a focusable Group node. */
function focusableNode() {
    const node = new Node([], "Group");
    node.setValue("focusable", BrsBoolean.True, false);
    return node;
}

describe("focus set before a node is attached to its parent", () => {
    afterEach(() => {
        sgRoot.setFocused();
    });

    test("focusedChild propagates to ancestors attached after focus was set", () => {
        // Mirrors a custom component (e.g. JellyRock UserRow) calling m.top.setFocus(true) in init(),
        // which runs before the node is appended to its parent: the focus chain at that moment is just
        // [child], so an ancestor's focusedChild used to stay invalid forever — and reading it from
        // BrightScript (m.top.focusedChild.isSubType(...)) then crashed with a dot-on-invalid error.
        const grandparent = focusableNode();
        const parent = focusableNode();
        const child = focusableNode();

        // Focus the child while it is still detached (no parent yet).
        child.setNodeFocus(true);
        expect(sgRoot.focused).toBe(child);
        // The detached parent has no focusedChild yet (the chain only reached the child).
        expect(parent.getValue("focusedChild")).not.toBe(child);

        // Attaching it must repair the chain so the parent points at the focused child.
        parent.appendChildToParent(child);
        expect(parent.getValue("focusedChild")).toBe(child);

        // And attaching the parent higher up must extend the chain to the new ancestor.
        grandparent.appendChildToParent(parent);
        expect(grandparent.getValue("focusedChild")).toBe(parent);
        expect(parent.getValue("focusedChild")).toBe(child);
        expect(child.getValue("focusedChild")).toBe(child);
    });
});
