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
