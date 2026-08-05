const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Float, Int32, RoArray } = core;

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

/**
 * Regression: a ScrollingLabel column whose text currently fits within maxWidth (no scrolling
 * needed) must still reserve the FULL maxWidth for a sibling LayoutGroup to measure — matching the
 * device-documented behavior that horizAlign positions text "relative to the maximum width of the
 * label as specified by the maxWidth field," not the actual rendered text width. Jellyfin-roku's
 * AlbumTrackList uses this exact shape (Track / Title(ScrollingText, maxWidth-only) / Length /
 * Plays columns): the bug reported the Length/Plays columns rendering too close to Title because
 * the engine measured the ScrollingLabel's short, non-scrolling text instead of its reserved box.
 */
describe("LayoutGroup positions siblings after a non-scrolling ScrollingLabel's full maxWidth", () => {
    beforeAll(() => {
        // ScrollingLabel resolves its font from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("a trailing fixed-width sibling is offset by maxWidth, not the shorter text width", () => {
        const layout = SGNodeFactory.createNode("LayoutGroup");
        layout.setValue("layoutDirection", new BrsString("horiz"));
        layout.setValue("itemSpacings", vector([20]));

        const track = SGNodeFactory.createNode("Rectangle");
        track.setValue("width", new Float(80));
        track.setValue("height", new Float(50));

        const title = SGNodeFactory.createNode("ScrollingLabel");
        title.setValue("font", new BrsString("font:SmallSystemFont"));
        title.setValue("maxWidth", new Int32(1280));
        // Short text: well under maxWidth, so no scrolling is needed — this is the case that
        // previously under-measured the node to its actual (much narrower) text width.
        title.setValue("text", new BrsString("Track Title"));

        const length = SGNodeFactory.createNode("Rectangle");
        length.setValue("width", new Float(120));
        length.setValue("height", new Float(50));

        layout.appendChildToParent(track);
        layout.appendChildToParent(title);
        layout.appendChildToParent(length);

        // Measurement pass (no draw2D) so the layout converges to a fixed point.
        layout.renderNode(fakeInterpreter, [0, 0], 0, 1);

        // "Length" must sit after Track (80) + spacing (20) + the full reserved Title column
        // (1280) + spacing (20), regardless of how short the actual title text is.
        const expectedX = 80 + 20 + 1280 + 20;
        expect(length.getValueJS("translation")[0]).toBeCloseTo(expectedX);
    });
});
