const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, BrsBoolean } = core;

/** Builds root → rows → items so a ZoomRowList has the given row/column shape. */
function buildContent(rows) {
    const root = SGNodeFactory.createNode("ContentNode");
    for (const row of rows) {
        const rowNode = SGNodeFactory.createNode("ContentNode");
        for (const title of row) {
            const item = SGNodeFactory.createNode("ContentNode");
            item.setValue("title", new BrsString(title));
            rowNode.appendChildToParent(item);
        }
        root.appendChildToParent(rowNode);
    }
    return root;
}

/**
 * ZoomRowList zoom sizing: the focused row uses `rowZoomHeight` and must render LARGER than the
 * unfocused rows (which use `rowHeight`). When an app does not set these fields (as in the
 * living_room_devices sample), the node falls back to resolution-specific defaults. A regression
 * had the HD defaults swapped (base 214 / zoom 136), which made the focused row shrink instead of
 * grow. These defaults also back the item-height fallbacks in getRowMetrics.
 */
describe("ZoomRowList zoom defaults", () => {
    beforeAll(() => {
        // ZoomRowList resolves fonts/focus bitmap from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    test("HD zoom-height default is larger than the base row-height default", () => {
        // A bare node defaults to HD resolution (Group falls back to "HD").
        const node = SGNodeFactory.createNode("ZoomRowList");
        expect(node.defaultRowZoomHeight).toBeGreaterThan(node.defaultRowHeight);
    });
});

/**
 * Key propagation: on a real device up/down only consume the key when focus actually moves to
 * another row. A single-row grid (the SGDEX GridView shape — one row per content type) has nowhere
 * to move vertically, so up/down must stay unhandled and bubble up the node tree to a sibling above
 * (e.g. a ButtonBar). The default wrap=true used to wrap the single row onto itself and report the
 * key as handled, swallowing it.
 */
describe("ZoomRowList up/down propagation", () => {
    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("a single-row grid does NOT consume up/down (lets the key bubble), even with wrap=true", () => {
        const list = SGNodeFactory.createNode("ZoomRowList");
        list.setValue("itemComponentName", new BrsString("X"));
        list.setValue("content", buildContent([["A", "B", "C"]])); // one row
        list.setNodeFocus(true);
        expect(list.getValueJS("wrap")).toBe(true); // default
        expect(list.handleKey("up", true)).toBe(false);
        expect(list.handleKey("down", true)).toBe(false);
        expect(list.focusIndex).toBe(0);
    });

    test("a multi-row grid still wraps (wrap=true) and moves (wrap=false) on up/down", () => {
        const wrapped = SGNodeFactory.createNode("ZoomRowList");
        wrapped.setValue("itemComponentName", new BrsString("X"));
        wrapped.setValue("content", buildContent([["A"], ["B"], ["C"]]));
        wrapped.setNodeFocus(true);
        // wrap=true: up from row 0 wraps to the last row and is handled.
        expect(wrapped.handleKey("up", true)).toBe(true);
        expect(wrapped.focusIndex).toBe(2);
        sgRoot.setFocused();

        const clamped = SGNodeFactory.createNode("ZoomRowList");
        clamped.setValue("itemComponentName", new BrsString("X"));
        clamped.setValue("wrap", BrsBoolean.False);
        clamped.setValue("content", buildContent([["A"], ["B"], ["C"]]));
        clamped.setNodeFocus(true);
        // wrap=false: up from row 0 has nowhere to go → bubbles; down moves to row 1.
        expect(clamped.handleKey("up", true)).toBe(false);
        expect(clamped.focusIndex).toBe(0);
        expect(clamped.handleKey("down", true)).toBe(true);
        expect(clamped.focusIndex).toBe(1);
    });
});
