const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Int32 } = core;

/** Builds a root ContentNode with `count` flat item children (a MarkupGrid's content shape). */
function buildContent(count) {
    const root = SGNodeFactory.createNode("ContentNode");
    for (let i = 0; i < count; i++) {
        const item = SGNodeFactory.createNode("ContentNode");
        item.setValue("title", new BrsString(`item ${i}`));
        root.appendChildToParent(item);
    }
    return root;
}

/** A focused multi-row grid (4 columns × 3 rows), focus parked on item 0. */
function focusedGrid(style) {
    const grid = SGNodeFactory.createNode("MarkupGrid");
    grid.setValue("numColumns", new Int32(4));
    if (style) {
        grid.setValue("vertFocusAnimationStyle", new BrsString(style));
    }
    grid.setValue("content", buildContent(12));
    grid.setNodeFocus(true);
    return grid;
}

describe("MarkupGrid vertFocusAnimationStyle handling (wrap vs. escape at the top row)", () => {
    beforeAll(() => {
        // The grid resolves fonts/focus bitmap from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("default style (fixedFocusWrap) wraps: Up at the first row is consumed", () => {
        // MarkupGrid's default vertFocusAnimationStyle is fixedFocusWrap (matches a real device and
        // the Roku SceneGraphTutorial MarkupGrid sample, which wraps with no style set). A full
        // multi-row grid wraps the column, so Up at the top row moves to the last row and is handled.
        const grid = focusedGrid();
        expect(grid.getValueJS("itemFocused")).toBe(0);
        expect(grid.handleKey("up", true)).toBe(true);
    });

    test('the shorthand "fixed" resolves to fixedFocus (non-wrapping): Up at the first row bubbles', () => {
        // Regression: apps set vertFocusAnimationStyle="fixed" (an alias for fixedFocus) to disable
        // wrapping. Previously the invalid value was rejected, leaving the fixedFocusWrap default, so
        // the grid kept wrapping and Up never bubbled to the scene to move focus to a sibling (e.g. a
        // filter bar). Now "fixed" is honored as non-wrapping, so Up at row 0 returns false.
        const grid = focusedGrid("fixed");
        expect(grid.handleKey("up", true)).toBe(false);
        // Down still moves within the grid (proves the grid handles vertical nav, just not off the top).
        expect(grid.handleKey("down", true)).toBe(true);
    });

    test("explicit floatingFocus does NOT wrap: Up at the first row bubbles", () => {
        const grid = focusedGrid("floatingFocus");
        expect(grid.handleKey("up", true)).toBe(false);
    });

    test("explicit fixedFocus does NOT wrap: Up at the first row bubbles", () => {
        const grid = focusedGrid("fixedFocus");
        expect(grid.handleKey("up", true)).toBe(false);
    });

    test("an unrecognized value is ignored, keeping the previous (wrapping) style", () => {
        // A genuinely invalid value (not the "fixed" alias) is ignored, matching a device that keeps
        // the field's current value — so the default fixedFocusWrap remains and Up still wraps.
        const grid = focusedGrid("banana");
        expect(grid.handleKey("up", true)).toBe(true);
    });
});

describe("single-row grid: vertical keys bubble instead of wrapping onto themselves", () => {
    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    /** A focused single-row strip (numRows=1, numColumns = content count) — the "related items
     * row" recipe: under the default fixedFocusWrap a vertical wrap resolves to the focused item
     * itself, which must NOT be reported handled or the key never reaches the screen's onKeyEvent. */
    function singleRowGrid(count = 8) {
        const grid = SGNodeFactory.createNode("MarkupGrid");
        grid.setValue("numRows", new Int32(1));
        grid.setValue("numColumns", new Int32(count));
        grid.setValue("content", buildContent(count));
        grid.setNodeFocus(true);
        return grid;
    }

    test("MarkupGrid with one row: up/down presses and releases are unhandled (bubble)", () => {
        const grid = singleRowGrid();
        expect(grid.handleKey("up", true)).toBe(false);
        expect(grid.handleKey("up", false)).toBe(false);
        expect(grid.handleKey("down", true)).toBe(false);
        expect(grid.handleKey("down", false)).toBe(false);
        // rewind/fastforward page vertically; a single-row grid can't move either.
        expect(grid.handleKey("rewind", true)).toBe(false);
        expect(grid.handleKey("fastforward", true)).toBe(false);
        // Horizontal navigation still works (proves the grid is live, just not consuming vertical).
        expect(grid.handleKey("right", true)).toBe(true);
        expect(grid.getValueJS("itemFocused")).toBe(1);
    });

    test("MarkupList with a single item: up/down are unhandled (bubble)", () => {
        const list = SGNodeFactory.createNode("MarkupList");
        list.setValue("content", buildContent(1));
        list.setNodeFocus(true);
        expect(list.handleKey("up", true)).toBe(false);
        expect(list.handleKey("down", true)).toBe(false);
        expect(list.handleKey("rewind", true)).toBe(false);
    });
});
