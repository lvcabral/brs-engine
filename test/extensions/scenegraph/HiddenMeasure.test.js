const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsString, BrsBoolean, Float, RoArray, Interpreter } = core;

/**
 * Regression: measuring layout under an INVISIBLE ancestor. On Roku, layout and bounding rects
 * are computed independently of visibility — apps commonly build UI while an ancestor group is
 * still hidden, measure it with boundingRect(), and only then reveal it (e.g. a side menu that
 * vertically centers itself via (screenHeight - boundingRect().height) / 2 before the screen
 * container becomes visible). The render-based refresh in getBoundingRect used to skip invisible
 * groups entirely, so every rect inside the hidden subtree stayed 0 and the menu centered as if
 * it had no height.
 */
describe("bounding rects are measured under invisible ancestors", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    function vector(values) {
        return new RoArray(values.map((v) => new Float(v)));
    }

    /** Scene > Group > hidden Group > Group > LayoutGroup > Group > two Rectangles (mirrors a
     * side menu that centers itself before its screen container is shown). */
    function buildHiddenMenu() {
        const scene = SGNodeFactory.createNode("Scene");
        const root = SGNodeFactory.createNode("Group");
        const contentGroup = SGNodeFactory.createNode("Group");
        contentGroup.setValue("visible", BrsBoolean.False);
        const screen = SGNodeFactory.createNode("Group");
        const layout = SGNodeFactory.createNode("LayoutGroup");
        layout.setValue("layoutDirection", new BrsString("vert"));
        layout.setValue("itemSpacings", vector([1]));
        layout.setValue("translation", vector([27, 120]));
        const group = SGNodeFactory.createNode("Group");
        const background = SGNodeFactory.createNode("Rectangle");
        background.setValue("width", new Float(438));
        background.setValue("height", new Float(72));
        const menu = SGNodeFactory.createNode("Rectangle");
        menu.setValue("width", new Float(438));
        menu.setValue("height", new Float(300));
        menu.setValue("translation", vector([0, 80]));

        group.appendChildToParent(background);
        group.appendChildToParent(menu);
        layout.appendChildToParent(group);
        screen.appendChildToParent(layout);
        contentGroup.appendChildToParent(screen);
        root.appendChildToParent(contentGroup);
        scene.appendChildToParent(root);
        return { scene, root, contentGroup, layout, menu };
    }

    test("boundingRect() of a node inside a hidden subtree returns the laid-out size", () => {
        const { layout } = buildHiddenMenu();

        const rect = layout.getBoundingRect("toParent", interpreter);

        // Union of the two rectangles: 438 wide, 80 + 300 = 380 tall.
        expect(rect.width).toBe(438);
        expect(rect.height).toBe(380);
        // The app-side centering computed from it is now meaningful: (1080 - 380) / 2 = 350.
        expect((1080 - rect.height) / 2).toBe(350);
    });

    test("the hidden ancestor does not leak into its parent's bounds and reports no tracking", () => {
        const { root, contentGroup, layout, menu } = buildHiddenMenu();
        menu.setValue("enableRenderTracking", BrsBoolean.True);

        layout.getBoundingRect("toParent", interpreter);

        // The hidden group was measured (its own rect reflects its laid-out children)...
        const hiddenRect = contentGroup.getBoundingRect("toParent");
        expect(hiddenRect.y).toBe(120);
        expect(hiddenRect.height).toBe(380);
        // ...but it did not union into its visible parent's bounds.
        expect(root.getBoundingRect("toParent").height).toBe(0);
        // A visible node inside the hidden subtree is laid out, not displayed.
        expect(menu.getValueJS("renderTracking")).toBe("none");
    });

    test("frame draws (draw2D present) still skip the invisible subtree", () => {
        const { root } = buildHiddenMenu();
        const calls = [];
        const draw2D = {
            doDrawRotatedRect: (...args) => calls.push(args),
        };

        root.renderNode(interpreter, [0, 0], 0, 1, draw2D);

        expect(calls).toHaveLength(0);
    });

    test("a visible sibling keeps normal measurement and parent contribution", () => {
        const { root } = buildHiddenMenu();
        const visibleRect = SGNodeFactory.createNode("Rectangle");
        visibleRect.setValue("width", new Float(100));
        visibleRect.setValue("height", new Float(50));
        visibleRect.setValue("translation", vector([10, 20]));
        root.appendChildToParent(visibleRect);

        const rect = visibleRect.getBoundingRect("toParent", interpreter);
        expect(rect).toEqual({ x: 10, y: 20, width: 100, height: 50 });
        // The visible sibling unions into the parent; the hidden subtree does not.
        expect(root.getBoundingRect("toParent")).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    });
});
