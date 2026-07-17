const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsString, Float, RoArray } = core;

/** Minimal interpreter accepted by renderNode → renderChildren when draw2D is absent. */
const fakeInterpreter = {};

function vector(values) {
    return new RoArray(values.map((v) => new Float(v)));
}

/**
 * Regression: a LayoutGroup owns its children's managed-axis positions. On Roku, if an app writes a
 * child's translation directly (SGDEX ButtonBar does this to its label via setTitleLabelStyle after
 * the group has already been laid out), the group re-imposes the aligned position on the next
 * render. A translation change alone does not dirty the layout, and the group's delta-based
 * positioning measures from the child's stale (previously rendered) rect — so without a fix the
 * label sticks at the app's translation and its centered text sits low (bottom-aligned).
 */
describe("LayoutGroup re-imposes child alignment after an external translation change", () => {
    afterEach(() => {
        sgRoot.setFocused();
    });

    test("a child moved by the app is realigned to the group's managed position on re-render", () => {
        // Horizontal group, vertAlignment center → the child's cross axis (y) is managed: its box is
        // centered on the group origin (y = -height/2).
        const layout = SGNodeFactory.createNode("LayoutGroup");
        layout.setValue("layoutDirection", new BrsString("horiz"));
        layout.setValue("vertAlignment", new BrsString("center"));

        const child = SGNodeFactory.createNode("Rectangle");
        child.setValue("width", new Float(100));
        child.setValue("height", new Float(40));
        layout.appendChildToParent(child);

        // First layout: single child at the left (primary x = 0), cross-centered (y = -20).
        layout.renderNode(fakeInterpreter, [0, 0], 0, 1);
        expect(child.getValueJS("translation")[0]).toBeCloseTo(0);
        expect(child.getValueJS("translation")[1]).toBeCloseTo(-20);

        // App moves the child directly (as ButtonBar's item component does to its label).
        child.setValue("translation", vector([0, 100]));

        // Re-render: the group detects the drift and re-imposes the aligned position (y back to -20),
        // rather than leaving the child where the app put it.
        layout.renderNode(fakeInterpreter, [0, 0], 0, 1);
        expect(child.getValueJS("translation")[0]).toBeCloseTo(0);
        expect(child.getValueJS("translation")[1]).toBeCloseTo(-20);
    });

    test("a custom cross-axis alignment leaves an app-set child translation untouched", () => {
        // vertAlignment custom → the cross axis is NOT managed, so the app's y is preserved; only the
        // primary (x) axis is stacked by the group.
        const layout = SGNodeFactory.createNode("LayoutGroup");
        layout.setValue("layoutDirection", new BrsString("horiz"));
        layout.setValue("vertAlignment", new BrsString("custom"));

        const child = SGNodeFactory.createNode("Rectangle");
        child.setValue("width", new Float(100));
        child.setValue("height", new Float(40));
        layout.appendChildToParent(child);

        layout.renderNode(fakeInterpreter, [0, 0], 0, 1);

        child.setValue("translation", vector([0, 100]));
        layout.renderNode(fakeInterpreter, [0, 0], 0, 1);

        // Primary axis stays stacked at 0; the custom cross axis keeps the app's value.
        expect(child.getValueJS("translation")[0]).toBeCloseTo(0);
        expect(child.getValueJS("translation")[1]).toBeCloseTo(100);
    });
});
