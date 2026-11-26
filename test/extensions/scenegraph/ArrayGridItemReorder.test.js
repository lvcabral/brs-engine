const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory } = scenegraph;
const { BrsDevice, BrsString, Float, Int32, RoArray } = core;

/** Builds a flat root → items ContentNode tree (no sections), e.g. ["A", "B", "C"]. */
function buildFlatContent(titles) {
    const root = SGNodeFactory.createNode("ContentNode");
    for (const title of titles) {
        const item = SGNodeFactory.createNode("ContentNode");
        item.setValue("title", new BrsString(title));
        root.appendChildToParent(item);
    }
    return root;
}

/** Builds a root → rows → items ContentNode tree; `rows` is an array of arrays of item titles. */
function buildRowContent(rows) {
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

/**
 * Regression: an app that filters a list by mutating its existing `content` tree in place
 * (removeChild/insertChild on individual children, never reassigning the `content` field itself —
 * exactly how jellyfin-roku's MovieDetails screen filters its action-button MarkupList) saw the
 * PREVIOUS item's visuals rendered at a position until the user navigated focus onto it.
 *
 * Root cause: itemComps[]/rowItemComps[][] are position-keyed caches of item components, reused
 * across frames. Whether a cached item gets its itemContent re-pushed was gated solely on the
 * content child's OWN `.changed` flag — but removeChild/insertChild/appendChild-as-move only dirty
 * the CONTAINER ContentNode, never the child being relocated. So after a reorder, the object now
 * sitting at a given index/cell is different from the one the cached item component was last told
 * about, yet its own `.changed` is false, and the itemContent push was silently skipped.
 */
describe("ArrayGrid/RowList item component reuse invalidates on content reorder, not just content.changed", () => {
    beforeAll(() => {
        // List/grid nodes have font-typed defaults; mount the common: volume once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    test("MarkupList: an item removed in front of a cached slot is replaced, not left stale", () => {
        const list = SGNodeFactory.createNode("MarkupList");
        const root = buildFlatContent(["A", "B", "C"]);
        list.setValue("content", root);

        const itemRect = { x: 0, y: 0, width: 100, height: 40 };
        const fakeInterpreter = {};

        // Populate itemComps[0..2] bound to A, B, C.
        list.renderItemComponent(fakeInterpreter, 0, itemRect, 0, 1);
        list.renderItemComponent(fakeInterpreter, 1, itemRect, 0, 1);
        const item0 = list.itemComps[0];
        expect(item0.getValue("itemContent").getValueJS("title")).toBe("A");

        // The app removes the first button in place (mirrors MovieDetails.bs's
        // updatePlayButtons/removeTelevisionGoToButtons pattern), shifting B/C up by one index. This
        // dirties the container (root), not the moved B/C nodes themselves.
        root.removeChildrenAtIndex(0, 1);
        list.refreshContent();

        list.renderItemComponent(fakeInterpreter, 0, itemRect, 0, 1);

        // Same cached component (position-keyed reuse)...
        expect(list.itemComps[0]).toBe(item0);
        // ...but now showing what actually occupies index 0 (B), not the stale A.
        expect(item0.getValue("itemContent").getValueJS("title")).toBe("B");
    });

    test("RowList: a column removed in front of a cached slot is replaced, not left stale", () => {
        const list = SGNodeFactory.createNode("RowList");
        list.setValue("itemSize", new RoArray([new Float(100), new Float(40)]));
        list.setValue("rowItemSize", new RoArray([new RoArray([new Float(100), new Float(40)])]));
        const root = buildRowContent([["A", "B", "C"]]);
        list.setValue("content", root);

        // First render creates rowItemComps[0][0..2] bound to A, B, C.
        list.renderNode({}, [0, 0], 0, 1);
        const item0 = list.rowItemComps[0][0];
        expect(item0.getValue("itemContent").getValueJS("title")).toBe("A");

        // Remove the first item within row 0, shifting B/C left by one column. This dirties the row
        // container, not the moved B/C nodes.
        const row0 = root.getNodeChildren()[0];
        row0.removeChildrenAtIndex(0, 1);

        // A plain re-render picks up the container-level dirty mark and re-parses via refreshContent.
        list.renderNode({}, [0, 0], 0, 1);

        // Same cached component (position-keyed reuse)...
        expect(list.rowItemComps[0][0]).toBe(item0);
        // ...but now showing what actually occupies column 0 (B), not the stale A.
        expect(item0.getValue("itemContent").getValueJS("title")).toBe("B");
    });

    test("MarkupGrid: a cached item's index follows a re-parse that shifts its data index (sections)", () => {
        // Two columns, sections of 4 and 2 items: G1.0 sits at position 4 with data index 4. Removing G0.3
        // pads section 0 with a placeholder, so position 4 still holds G1.0 but its data index is now 3
        // (markupgrid-item-index-probe: index counts items across sections, not placeholders).
        const grid = SGNodeFactory.createNode("MarkupGrid");
        grid.setValue("numColumns", new Int32(2));
        const root = SGNodeFactory.createNode("ContentNode");
        const sections = [];
        for (const [sec, count] of [4, 2].entries()) {
            const section = SGNodeFactory.createNode("ContentNode");
            section.setValue("contentType", new BrsString("SECTION"));
            for (let i = 0; i < count; i++) {
                const item = SGNodeFactory.createNode("ContentNode");
                item.setValue("title", new BrsString(`G${sec}.${i}`));
                section.appendChildToParent(item);
            }
            root.appendChildToParent(section);
            sections.push(section);
        }
        grid.setValue("content", root);
        grid.refreshContent();
        const itemRect = { x: 0, y: 0, width: 100, height: 40 };
        for (let i = 0; i < 6; i++) {
            grid.renderItemComponent({}, i, itemRect, 0, 1);
        }
        const item4 = grid.itemComps[4];
        expect(item4.getValue("itemContent").getValueJS("title")).toBe("G1.0");
        expect(item4.getValueJS("index")).toBe(4);

        sections[0].removeChildrenAtIndex(3, 1);
        grid.refreshContent();

        expect(grid.itemComps[4]).toBe(item4);
        expect(grid.content[4].getValueJS("title")).toBe("G1.0");
        expect(item4.getValueJS("index")).toBe(3);
    });

    test("Built-in item: a notified poster change still reaches the cached item's poster", () => {
        const list = SGNodeFactory.createNode("MarkupList");
        const root = buildFlatContent(["A"]);
        root.getNodeChildren()[0].setValue("hdPosterUrl", new BrsString("pkg:/images/old.png"));
        list.setValue("content", root);

        const itemRect = { x: 0, y: 0, width: 100, height: 40 };
        list.renderItemComponent({}, 0, itemRect, 0, 1);
        const item0 = list.itemComps[0];
        expect(item0.poster.getValueJS("uri")).toBe("pkg:/images/old.png");

        root.getNodeChildren()[0].setValue("hdPosterUrl", new BrsString("pkg:/images/new.png"));
        list.renderItemComponent({}, 0, itemRect, 0, 1);

        expect(list.itemComps[0]).toBe(item0);
        expect(item0.poster.getValueJS("uri")).toBe("pkg:/images/new.png");
    });
});
