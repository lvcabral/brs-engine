const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsBoolean, BrsString, Float, Int32, RoArray, Interpreter } = core;

/**
 * Regression: a mid-render boundingRect() query on a not-yet-laid-out node renders only that node's
 * own subtree to measure it (getBoundingRect's single-subtree fallback, used while sgRoot.rendering
 * is true). That subtree render ends in updateParentRects, which unions the measured node into its
 * PARENT's cached bounds. But the parent has not been laid out this pass, so unioning only this one
 * child leaves the parent with a partial rect built from a single child.
 *
 * The real-world shape: a fit-to-content button (a Group) holds a content LayoutGroup plus a
 * separate, larger background sibling. The button sizes its background from
 * elementsGroup.boundingRect() during its own itemContent observer (mid-render). Later the item's
 * container measures the button itself to position it. If the first measurement polluted the button's
 * rectLocal with just the content group's size, the button's own query saw a non-degenerate rect,
 * skipped its fallback, and returned the too-small content size — so the button was positioned as if
 * it were only as big as its text (mis-aligned, and too short), correcting only on a later re-display.
 * On a real device the button measures its full size (background included) on the first render.
 *
 * The fix snapshots and restores the immediate parent's rects around the measurement so measuring a
 * child never corrupts the parent's cached bounds.
 */
describe("mid-render measurement does not pollute the parent's bounds", () => {
    let interpreter;

    beforeAll(() => {
        // Label font-typed defaults need the common: fonts; mount once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        sgRoot.rendering = false;
        sgRoot.setFocused();
    });

    function vector(values) {
        return new RoArray(values.map((v) => new Float(v)));
    }

    /**
     * Scene > button(Group) > [ background(Rectangle 516x105), elementsGroup(horiz LayoutGroup >
     * Label) ]. Mirrors a fit-to-content button whose visible size is its background, not its text.
     */
    function buildButton() {
        const scene = SGNodeFactory.createNode("Scene");
        const button = SGNodeFactory.createNode("Group");
        const background = SGNodeFactory.createNode("Rectangle");
        background.setValue("width", new Float(516));
        background.setValue("height", new Float(105));
        const elementsGroup = SGNodeFactory.createNode("LayoutGroup");
        elementsGroup.setValue("layoutDirection", new BrsString("horiz"));
        const label = SGNodeFactory.createNode("Label");
        label.setValue("text", new BrsString("Sign Up to Save Progress"));
        elementsGroup.appendChildToParent(label);
        button.appendChildToParent(background);
        button.appendChildToParent(elementsGroup);
        scene.appendChildToParent(button);
        return { scene, button, background, elementsGroup, label };
    }

    test("measuring the content group mid-render then the button returns the button's full size", () => {
        const { button, elementsGroup } = buildButton();

        // Mirror the on-device order: while a render is active, the button sizes its background from
        // its content group first, then the container measures the button to position it.
        sgRoot.rendering = true;
        const contentRect = elementsGroup.getBoundingRect("toParent", interpreter);
        const buttonRect = button.getBoundingRect("toParent", interpreter);
        sgRoot.rendering = false;

        // The content group is just the text (narrower and shorter than the background).
        expect(contentRect.width).toBeGreaterThan(0);
        expect(contentRect.height).toBeLessThan(105);
        // The button spans its full background, not the collapsed content size.
        expect(buttonRect.width).toBe(516);
        expect(buttonRect.height).toBe(105);
    });

    test("measuring a child leaves the parent's cached rect untouched (still degenerate)", () => {
        const { button, elementsGroup } = buildButton();

        sgRoot.rendering = true;
        elementsGroup.getBoundingRect("toParent", interpreter);
        // The button was NOT queried, so its cached local rect must remain degenerate — measuring the
        // child alone must not have unioned a partial size into it.
        expect(button.rectLocal.width <= 0 || button.rectLocal.height <= 0).toBe(true);
        sgRoot.rendering = false;
    });
});

/**
 * Regression: a mid-render boundingRect() query on a vertical LayoutGroup must return the CONVERGED
 * stacked height, not a pre-convergence one. A LayoutGroup positions each child below the previous
 * using the previous child's measured size; if a wrapped Label was first measured at a shorter (e.g.
 * single-line) height and only later renders at its true multi-line height, every sibling below it
 * shifts. On a live frame synchronizeChildMetrics catches this and corrects on the next frame, but a
 * mid-render boundingRect() query is one-shot — an app centering the group from that height bakes in
 * the pre-convergence value and the block sits too high until a later re-display. The fix re-runs the
 * layout within the measurement pass (bounded) so the stack settles before the query reads it.
 */
describe("mid-render measurement converges a vertical LayoutGroup's stacked height", () => {
    let interpreter;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        sgRoot.rendering = false;
        sgRoot.setFocused();
    });

    function vector(values) {
        return new RoArray(values.map((v) => new Float(v)));
    }

    /** Scene > vert LayoutGroup(spacing 15) > two wrapped labels. Returns the true (rendered) heights. */
    function buildStack() {
        const scene = SGNodeFactory.createNode("Scene");
        const group = SGNodeFactory.createNode("LayoutGroup");
        group.setValue("layoutDirection", new BrsString("vert"));
        group.setValue("itemSpacings", vector([15]));
        const title = SGNodeFactory.createNode("Label");
        title.setValue("width", new Float(633));
        title.setValue("wrap", BrsBoolean.True);
        title.setValue("maxLines", new Int32(2));
        title.setValue("text", new BrsString("Sign Up to Save Your Progress and more words to force two lines"));
        const description = SGNodeFactory.createNode("Label");
        description.setValue("width", new Float(633));
        description.setValue("wrap", BrsBoolean.True);
        description.setValue("maxLines", new Int32(3));
        description.setValue("text", new BrsString("Pick up right where you left off."));
        group.appendChildToParent(title);
        group.appendChildToParent(description);
        scene.appendChildToParent(group);
        const trueTitleHeight = title.rectLocal.height;
        const descriptionHeight = description.rectLocal.height;
        return { group, title, description, trueTitleHeight, descriptionHeight };
    }

    // The genuine trigger (a label whose first measurement precedes its true wrapped height) is
    // browser-async-font-specific: Node's node-canvas measures synchronously, so a label always
    // reports its true height by layout time here and the bug cannot occur naturally. Seed a stale
    // single-line title rect to stand in for that mid-flight state; without convergence the group
    // stacks the description against the stale height and reports a too-short total.
    function seedStaleTitleRect(title) {
        const stale = { x: 0, y: 0, width: 633, height: 20 };
        title.rectLocal = { ...stale };
        title.rectToParent = { ...stale };
        title.rectToScene = { ...stale };
    }

    test("mid-render fallback stacks the second label below the first's true height, not a stale one", () => {
        const { group, title, description, trueTitleHeight, descriptionHeight } = buildStack();
        seedStaleTitleRect(title);

        // Query raised during an active render → getBoundingRect's single-subtree fallback.
        sgRoot.rendering = true;
        const rect = group.getBoundingRect("toParent", interpreter);
        sgRoot.rendering = false;

        expect(description.getValueJS("translation")[1]).toBeCloseTo(trueTitleHeight + 15, 1);
        expect(rect.height).toBeCloseTo(trueTitleHeight + 15 + descriptionHeight, 1);
    });

    test("full-tree refresh (query outside a render) also converges the stacked height", () => {
        const { group, title, description, trueTitleHeight, descriptionHeight } = buildStack();
        seedStaleTitleRect(title);

        // rendering is false → getBoundingRect takes the refreshLayoutFromRoot path, which also renders
        // with no draw target, so the same convergence must apply.
        const rect = group.getBoundingRect("toParent", interpreter);

        expect(description.getValueJS("translation")[1]).toBeCloseTo(trueTitleHeight + 15, 1);
        expect(rect.height).toBeCloseTo(trueTitleHeight + 15 + descriptionHeight, 1);
    });
});
