const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Float, RoArray, Interpreter } = core;

/**
 * Regression: a mid-render boundingRect() query only re-measured when the node's cached rect was
 * DEGENERATE. That makes the first query of a render correct and every later one stale — once a rect
 * is cached, a repeat query returns it verbatim even after the app changed something in the subtree.
 *
 * Apps size a background from a measured child in exactly that shape, from a field observer (so,
 * mid-render): set an icon, measure the row, set the text, measure again, then size a 9-patch
 * background to the result. The second measurement returned the pre-text width, so the background
 * was sized for the icon alone and the text spilled past it — while the SAME component with no icon
 * (a single measurement) came out right, making it look asset-specific rather than order-specific.
 *
 * The fix adds `subtreeStale` to the fallback condition: the mark is set by makeDirty() on every
 * field write and cleared at the start of a layout pass, so a repeat query re-measures only when
 * something actually changed.
 */
describe("repeated mid-render measurements pick up subtree changes", () => {
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

    /**
     * Scene > badge(Group) > [ background(Rectangle), row(horiz LayoutGroup > [icon(Rectangle),
     * label(Label)]) ]. Mirrors an icon+text pill whose background is sized from the measured row.
     */
    function buildBadge() {
        const scene = SGNodeFactory.createNode("Scene");
        const badge = SGNodeFactory.createNode("Group");
        const background = SGNodeFactory.createNode("Rectangle");
        background.setValue("width", new Float(0));
        background.setValue("height", new Float(40));
        const row = SGNodeFactory.createNode("LayoutGroup");
        row.setValue("layoutDirection", new BrsString("horiz"));
        const icon = SGNodeFactory.createNode("Rectangle");
        icon.setValue("height", new Float(21));
        icon.setValue("width", new Float(0));
        const label = SGNodeFactory.createNode("Label");
        label.setValue("height", new Float(24));
        row.appendChildToParent(icon);
        row.appendChildToParent(label);
        badge.appendChildToParent(background);
        badge.appendChildToParent(row);
        scene.appendChildToParent(badge);
        return { scene, badge, background, row, icon, label };
    }

    test("a second query after a text change reports the wider row, not the cached width", () => {
        const { row, icon, label } = buildBadge();

        sgRoot.rendering = true;
        // Observer 1 (icon): give the icon a size, then measure the row.
        icon.setValue("width", new Float(24));
        row.setValue("itemSpacings", new RoArray([new Float(8)]));
        const iconOnly = row.getBoundingRect("toParent", interpreter).width;

        // Observer 2 (text): set the label text, then measure the row AGAIN.
        label.setValue("text", new BrsString("LIVE"));
        const withText = row.getBoundingRect("toParent", interpreter).width;
        sgRoot.rendering = false;

        // The icon-only row is the icon plus its trailing spacing; the text must widen it.
        expect(iconOnly).toBeGreaterThan(0);
        expect(withText).toBeGreaterThan(iconOnly);
        // It must equal icon + spacing + the label's own measured width.
        const labelWidth = label.getBoundingRect("local", interpreter).width;
        expect(labelWidth).toBeGreaterThan(0);
        expect(withText).toBeCloseTo(24 + 8 + labelWidth, 1);
    });

    test("the same component measured without the icon step agrees with the icon path", () => {
        // The no-icon variant only ever measures once, so it was already correct — pin that the two
        // paths now agree on the label's contribution.
        const noIcon = buildBadge();
        sgRoot.rendering = true;
        noIcon.label.setValue("text", new BrsString("LIVE"));
        const plain = noIcon.row.getBoundingRect("toParent", interpreter).width;
        sgRoot.rendering = false;

        const withIcon = buildBadge();
        sgRoot.rendering = true;
        withIcon.icon.setValue("width", new Float(24));
        withIcon.row.setValue("itemSpacings", new RoArray([new Float(8)]));
        withIcon.row.getBoundingRect("toParent", interpreter);
        withIcon.label.setValue("text", new BrsString("LIVE"));
        const iconRow = withIcon.row.getBoundingRect("toParent", interpreter).width;
        sgRoot.rendering = false;

        expect(plain).toBeGreaterThan(0);
        expect(iconRow - plain).toBeCloseTo(32, 1); // exactly the icon (24) + spacing (8)
    });

    test("an unchanged repeat query still returns the cached rect", () => {
        // The stale mark is what triggers a re-measure, so a query with nothing written in between
        // must NOT re-render the subtree — otherwise every measurement in a render pass re-descends.
        const { row, label } = buildBadge();

        sgRoot.rendering = true;
        label.setValue("text", new BrsString("LIVE"));
        const first = row.getBoundingRect("toParent", interpreter).width;
        const passesAfterFirst = row.layoutPassCount;
        const second = row.getBoundingRect("toParent", interpreter).width;
        sgRoot.rendering = false;

        expect(second).toBe(first);
        expect(row.layoutPassCount).toBe(passesAfterFirst);
    });
});
