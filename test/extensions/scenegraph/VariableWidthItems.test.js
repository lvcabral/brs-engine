const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, BrsBoolean, Float, RoArray } = core;

/** Minimal interpreter accepted by renderNode → renderChildren when draw2D is absent. */
const fakeInterpreter = {};

/**
 * Builds root → one row → items, giving each item a per-item HDItemWidth field (the default
 * scene resolution in tests is "HD", so RowList reads HDItemWidth for a variable-width row).
 */
function buildRow(widths) {
    const root = SGNodeFactory.createNode("ContentNode");
    const row = SGNodeFactory.createNode("ContentNode");
    for (let i = 0; i < widths.length; i++) {
        const item = SGNodeFactory.createNode("ContentNode");
        item.setValue("title", new BrsString(`Item ${i}`));
        item.addNodeField("HDItemWidth", "float", false);
        item.setValue("HDItemWidth", new Float(widths[i]));
        row.appendChildToParent(item);
    }
    root.appendChildToParent(row);
    return root;
}

describe("RowList variableWidthItems", () => {
    beforeAll(() => {
        // RowList resolves fonts/focus bitmap from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("lays out each item at its own width (variable-width pivot row), not a uniform pitch", () => {
        const list = SGNodeFactory.createNode("RowList");
        list.setValue("numRows", new Float(1));
        list.setValue("itemSize", new RoArray([new Float(1280), new Float(72)]));
        list.setValue("rowHeights", new RoArray([new Float(72)]));
        // Uniform width is deliberately 50 (the variable-width fallback) so a uniform layout would be
        // clearly distinguishable from the per-item widths below.
        list.setValue("rowItemSize", new RoArray([new RoArray([new Float(50), new Float(72)])]));
        list.setValue("rowItemSpacing", new RoArray([new RoArray([new Float(10), new Float(0)])]));
        list.setValue("variableWidthItems", new RoArray([BrsBoolean.True]));
        list.setValue("rowFocusAnimationStyle", new BrsString("fixedFocus"));
        list.setValue("content", buildRow([100, 200, 150]));

        // Measurement render (no draw2D) from origin [0,0]; positions each item component.
        list.renderNode(fakeInterpreter, [0, 0], 0, 1);

        const items = list.rowItemComps[0];
        expect(items).toHaveLength(3);

        // Each slot is sized to its own HDItemWidth...
        expect(items[0].rectToScene.width).toBe(100);
        expect(items[1].rectToScene.width).toBe(200);
        expect(items[2].rectToScene.width).toBe(150);

        // ...and each item advances by the PREVIOUS item's width + spacing (10), so items neither
        // overlap nor leave gaps. A uniform-pitch layout (width 50) would place them at 0/60/120.
        expect(items[0].rectToScene.x).toBe(0);
        expect(items[1].rectToScene.x).toBe(110); // 0 + 100 + 10
        expect(items[2].rectToScene.x).toBe(320); // 110 + 200 + 10
    });

    test("floats focus and stops at the edges when variable-width items fit, despite an oversized rowItemSize", () => {
        // Regression (SGDEX ButtonBar): the app sets rowItemSize.x to the WHOLE bar width while each
        // button is far narrower via HDItemWidth, and uses fixedFocusWrap. The "do all items fit?"
        // check used numCols * rowItemSize.x (3 * 980 = 2940 > 1280) and wrongly concluded the row
        // overflowed, pinning focus at column 0 and scrolling/wrapping the row. Summing the real
        // per-item widths (100+200+150 + spacing = 470 < 1280) makes focus float per button and clamp
        // at the first/last button with no wrap.
        const list = SGNodeFactory.createNode("RowList");
        list.setValue("numRows", new Float(1));
        list.setValue("itemSize", new RoArray([new Float(1280), new Float(55)]));
        list.setValue("rowHeights", new RoArray([new Float(55)]));
        // Oversized uniform width: the whole bar, not a single button.
        list.setValue("rowItemSize", new RoArray([new RoArray([new Float(980), new Float(55)])]));
        list.setValue("rowItemSpacing", new RoArray([new RoArray([new Float(10), new Float(0)])]));
        list.setValue("variableWidthItems", new RoArray([BrsBoolean.True]));
        list.setValue("rowFocusAnimationStyle", new BrsString("fixedFocusWrap"));
        list.setValue("content", buildRow([100, 200, 150]));
        list.setNodeFocus(true);

        expect(list.rowFocus[0]).toBe(0);

        // Right floats focus button-to-button (the column advances; it is not pinned at 0).
        expect(list.handleKey("right", true)).toBe(true);
        expect(list.rowFocus[0]).toBe(1);
        expect(list.getValueJS("rowItemFocused")).toEqual([0, 1]);
        expect(list.handleKey("right", true)).toBe(true);
        expect(list.rowFocus[0]).toBe(2);

        // At the last button Right STOPS (no wrap back to 0) and reports the key as unhandled.
        expect(list.handleKey("right", true)).toBe(false);
        expect(list.rowFocus[0]).toBe(2);

        // Left floats back and STOPS at the first button (no wrap to the last).
        expect(list.handleKey("left", true)).toBe(true);
        expect(list.rowFocus[0]).toBe(1);
        expect(list.handleKey("left", true)).toBe(true);
        expect(list.rowFocus[0]).toBe(0);
        expect(list.handleKey("left", true)).toBe(false);
        expect(list.rowFocus[0]).toBe(0);
    });

    test("falls back to the row's rowItemSize width for an item without [res]ItemWidth", () => {
        const root = SGNodeFactory.createNode("ContentNode");
        const row = SGNodeFactory.createNode("ContentNode");
        const withWidth = SGNodeFactory.createNode("ContentNode");
        withWidth.addNodeField("HDItemWidth", "float", false);
        withWidth.setValue("HDItemWidth", new Float(100));
        const noWidth = SGNodeFactory.createNode("ContentNode"); // no HDItemWidth → fallback
        row.appendChildToParent(withWidth);
        row.appendChildToParent(noWidth);
        root.appendChildToParent(row);

        const list = SGNodeFactory.createNode("RowList");
        list.setValue("numRows", new Float(1));
        list.setValue("itemSize", new RoArray([new Float(1280), new Float(72)]));
        list.setValue("rowHeights", new RoArray([new Float(72)]));
        list.setValue("rowItemSize", new RoArray([new RoArray([new Float(80), new Float(72)])]));
        list.setValue("rowItemSpacing", new RoArray([new RoArray([new Float(10), new Float(0)])]));
        list.setValue("variableWidthItems", new RoArray([BrsBoolean.True]));
        list.setValue("rowFocusAnimationStyle", new BrsString("fixedFocus"));
        list.setValue("content", root);

        list.renderNode(fakeInterpreter, [0, 0], 0, 1);

        const items = list.rowItemComps[0];
        expect(items[0].rectToScene.width).toBe(100); // from HDItemWidth
        expect(items[1].rectToScene.width).toBe(80); // fallback to rowItemSize.x
        expect(items[1].rectToScene.x).toBe(110); // 0 + 100 + 10
    });
});
