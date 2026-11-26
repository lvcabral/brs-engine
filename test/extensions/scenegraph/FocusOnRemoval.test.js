const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;

/**
 * Detaching a node the scene's focus chain runs through leaves nothing focused: removeChild,
 * replaceChild, reparent and a reparenting append alike. A focus taken inside a still-detached tree
 * is not in the scene's chain and survives mounting and reparenting that tree (DEVICE-MEASURED,
 * OS 16.0, test/simulator/probes/buttongroup-shrink-probe).
 */
describe("focus when the focused node leaves its parent", () => {
    afterEach(() => {
        sgRoot.setFocused();
    });

    /** An initialized Scene installed as the screen's scene. */
    function newScene() {
        const scene = SGNodeFactory.createNode("Scene");
        scene.setInitState("initialized");
        sgRoot.setScene(scene);
        return scene;
    }

    function build() {
        const scene = newScene();
        const holder = SGNodeFactory.createNode("Group");
        const leaf = SGNodeFactory.createNode("Group");
        scene.appendChildToParent(holder);
        holder.appendChildToParent(leaf);
        leaf.setNodeFocus(true);
        expect(sgRoot.focused).toBe(leaf);
        return { scene, holder, leaf };
    }

    function expectNothingFocused(...nodes) {
        expect(sgRoot.focused).toBeUndefined();
        for (const node of nodes) {
            expect(core.isInvalid(node.getValue("focusedChild"))).toBe(true);
        }
    }

    test("removeChild", () => {
        const { scene, holder, leaf } = build();
        holder.removeChildByReference(leaf);
        expectNothingFocused(scene, holder, leaf);
    });

    test("removing an ancestor of the focused node", () => {
        const { scene, holder, leaf } = build();
        scene.removeChildByReference(holder);
        expectNothingFocused(scene, holder, leaf);
    });

    test("replaceChild", () => {
        const { scene, holder, leaf } = build();
        holder.replaceChildAtIndex(SGNodeFactory.createNode("Group"), 0);
        expectNothingFocused(scene, holder, leaf);
    });

    test("appending the focused node to another parent", () => {
        const { scene, holder, leaf } = build();
        const other = SGNodeFactory.createNode("Group");
        scene.appendChildToParent(other);
        other.appendChildToParent(leaf);
        expectNothingFocused(scene, holder, other, leaf);
    });

    test("removing an unrelated sibling keeps the focus", () => {
        const { holder, leaf } = build();
        const sibling = SGNodeFactory.createNode("Group");
        holder.appendChildToParent(sibling);
        holder.removeChildByReference(sibling);
        expect(sgRoot.focused).toBe(leaf);
    });

    test("a focus taken while detached survives the router mount (append, then reparent onto the same parent)", () => {
        const { outlet, view, list } = mountDetachedFocus();
        expect(sgRoot.focused).toBe(list);
        expect(outlet.getNodeChildren()).toContain(view);
    });

    test("once the mounted view is focused, removing it drops the focus", () => {
        // Known difference: the device focuses the view itself (probe `mount-view-focus`); the engine
        // keeps the live focus on the list. Either way the focus now belongs to the scene.
        const { outlet, view } = mountDetachedFocus();
        view.setNodeFocus(true);
        outlet.removeChildByReference(view);
        expect(sgRoot.focused).toBeUndefined();
    });

    /** A view whose list focused itself in init(), mounted the way a router library does it. */
    function mountDetachedFocus() {
        const scene = newScene();
        const outlet = SGNodeFactory.createNode("Group");
        scene.appendChildToParent(outlet);
        const view = SGNodeFactory.createNode("Group");
        const list = SGNodeFactory.createNode("Group");
        view.appendChildToParent(list);
        list.setNodeFocus(true); // a component's init() focusing itself before it is appended
        outlet.appendChildToParent(view);
        outlet.removeChildByReference(view); // reparent(outlet): remove, then append again
        outlet.appendChildToParent(view);
        return { outlet, view, list };
    }
});
