const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, ContentNode } = scenegraph;
const { BrsInvalid } = core;

describe("attaching a node that already has a parent reparents it (single-parent invariant)", () => {
    test("appendChildToParent detaches the child from its previous parent", () => {
        // Mirrors moving an XML-declared child into another container via appendChild in init():
        // on Roku a node has exactly one parent, so the old parent must not keep (and render) it.
        const oldParent = new Node([], "Group");
        const newParent = new Node([], "Group");
        const child = new Node([], "Group");

        oldParent.appendChildToParent(child);
        expect(oldParent.getNodeChildren()).toContain(child);

        newParent.appendChildToParent(child);
        expect(oldParent.getNodeChildren()).not.toContain(child);
        expect(oldParent.getNodeChildren()).toHaveLength(0);
        expect(newParent.getNodeChildren()).toEqual([child]);
        expect(child.getNodeParent()).toBe(newParent);
    });

    test("insertChildAtIndex detaches the child from its previous parent", () => {
        const oldParent = new Node([], "Group");
        const newParent = new Node([], "Group");
        const sibling = new Node([], "Group");
        const child = new Node([], "Group");

        oldParent.appendChildToParent(child);
        newParent.appendChildToParent(sibling);

        newParent.insertChildAtIndex(child, 0);
        expect(oldParent.getNodeChildren()).toHaveLength(0);
        expect(newParent.getNodeChildren()).toEqual([child, sibling]);
        expect(child.getNodeParent()).toBe(newParent);
    });

    test("replaceChildAtIndex detaches the new child from its previous parent", () => {
        const oldParent = new Node([], "Group");
        const newParent = new Node([], "Group");
        const placeholder = new Node([], "Group");
        const child = new Node([], "Group");

        oldParent.appendChildToParent(child);
        newParent.appendChildToParent(placeholder);

        newParent.replaceChildAtIndex(child, 0);
        expect(oldParent.getNodeChildren()).toHaveLength(0);
        expect(newParent.getNodeChildren()).toEqual([child]);
        expect(child.getNodeParent()).toBe(newParent);
        expect(placeholder.getNodeParent()).toBe(BrsInvalid.Instance);
    });

    test("same-parent append stays a no-op and keeps child order", () => {
        const parent = new Node([], "Group");
        const first = new Node([], "Group");
        const second = new Node([], "Group");

        parent.appendChildToParent(first);
        parent.appendChildToParent(second);
        parent.appendChildToParent(first);
        expect(parent.getNodeChildren()).toEqual([first, second]);
        expect(first.getNodeParent()).toBe(parent);
    });

    test("same-parent insert still reorders without duplication", () => {
        const parent = new Node([], "Group");
        const first = new Node([], "Group");
        const second = new Node([], "Group");

        parent.appendChildToParent(first);
        parent.appendChildToParent(second);
        parent.insertChildAtIndex(second, 0);
        expect(parent.getNodeChildren()).toEqual([second, first]);
        expect(second.getNodeParent()).toBe(parent);
    });

    test("ContentNode append detaches from the previous ContentNode parent", () => {
        const oldParent = new ContentNode();
        const newParent = new ContentNode();
        const child = new ContentNode();

        oldParent.appendChildToParent(child);
        expect(oldParent.getNodeChildren()).toContain(child);

        newParent.appendChildToParent(child);
        expect(oldParent.getNodeChildren()).not.toContain(child);
        expect(newParent.getNodeChildren()).toEqual([child]);
        expect(child.getNodeParent()).toBe(newParent);
    });
});
