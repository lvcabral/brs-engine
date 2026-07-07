const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Int32, RoArray } = core;

/**
 * Builds a root → rows → items ContentNode tree.
 * `rows` is an array of arrays of item titles, e.g. [["A"], ["B", "C"]] is two rows.
 */
function buildContent(rows) {
    const root = SGNodeFactory.createNode("ContentNode");
    for (const items of rows) {
        const rowNode = SGNodeFactory.createNode("ContentNode");
        for (const title of items) {
            const itemNode = SGNodeFactory.createNode("ContentNode");
            itemNode.setValue("title", new BrsString(title));
            rowNode.appendChildToParent(itemNode);
        }
        root.appendChildToParent(rowNode);
    }
    return root;
}

describe("RowList key handling", () => {
    beforeAll(() => {
        // RowList resolves fonts/focus bitmap from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("a single-row fixedFocusWrap list does NOT consume up/down (lets the key bubble)", () => {
        // Regression: with vertFocusAnimationStyle="fixedFocusWrap" the wrap modulo on a one-row list
        // resolves back to the same row (1 % 1 = 0), which used to make handleUpDown report the key as
        // handled — swallowing "down" so it never bubbled to a parent that moves focus to a sibling.
        const list = SGNodeFactory.createNode("RowList");
        list.setValue("vertFocusAnimationStyle", new BrsString("fixedFocusWrap"));
        list.setValue("content", buildContent([["A", "B"]]));

        expect(list.handleKey("down", true)).toBe(false);
        expect(list.handleKey("up", true)).toBe(false);
        // Focus row is unchanged because no move happened.
        expect(list.getValueJS("itemFocused")).toBe(0);
    });

    test("a multi-row fixedFocusWrap list still wraps (down/up stay handled)", () => {
        const list = SGNodeFactory.createNode("RowList");
        list.setValue("vertFocusAnimationStyle", new BrsString("fixedFocusWrap"));
        list.setValue("content", buildContent([["A"], ["B"], ["C"]]));

        // Row 0 → down moves to row 1 (a real move).
        expect(list.handleKey("down", true)).toBe(true);
        expect(list.getValueJS("itemFocused")).toBe(1);

        // Row 0 → up wraps to the last row (wrap behavior preserved).
        list.setValue("jumpToItem", new core.Int32(0));
        expect(list.getValueJS("itemFocused")).toBe(0);
        expect(list.handleKey("up", true)).toBe(true);
        expect(list.getValueJS("itemFocused")).toBe(2);
    });

    test("a content re-parse preserves per-row column focus (regression: horizontal navigation)", () => {
        // Regression: ContentNode.makeDirty now marks the content root "changed" on any mutation, so
        // ArrayGrid.renderNode re-parses via refreshContent far more often. RowList.refreshContent used
        // to unconditionally zero rowFocus/rowScrollOffset for every row, wiping the just-set column
        // back to 0 every frame — breaking horizontal navigation while vertical (row) focus survived.
        const list = SGNodeFactory.createNode("RowList");
        list.setValue("content", buildContent([["A", "B", "C", "D"]]));

        // Move column focus within row 0 to item 2 (render-geometry-independent path).
        list.setValue("jumpToRowItem", new RoArray([new Int32(0), new Int32(2)]));
        expect(list.rowFocus[0]).toBe(2);

        // A plain re-parse of the SAME content tree (what a spurious content.changed triggers) must
        // preserve the focused column.
        list.refreshContent();
        expect(list.rowFocus[0]).toBe(2);

        // Assigning a genuinely NEW content tree does reset column focus to 0.
        list.setValue("content", buildContent([["X", "Y", "Z"]]));
        expect(list.rowFocus[0]).toBe(0);
    });
});
