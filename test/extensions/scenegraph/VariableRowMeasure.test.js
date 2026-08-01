const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, MarkupGrid, MarkupList } = scenegraph;
const { BrsDevice, BrsString, Int32, Float, RoArray } = core;

/**
 * `rowHeights` / `rowSpacings` (and `columnWidths` / `columnSpacings` on grids) override
 * `itemSize` / `itemSpacing` per track, and the render loops honor them — but `updateRect` computed a
 * uniform `numRows * itemSize.y + (numRows - 1) * itemSpacing.y`, so every variable-height list
 * reported a bounding rect that disagreed with what it drew. An app sizing a sibling background or
 * centering from `boundingRect()` drifted by the difference.
 *
 * Per the ArrayGrid reference the arrays are indexed by ABSOLUTE row (top to bottom), an index past
 * the end of the array falls back to the `itemSize` / `itemSpacing` value (it does NOT repeat the last
 * entry, unlike LayoutGroup's `itemSpacings`), and `rowSpacings[i]` is the spacing AFTER row i.
 */
describe("boundingRect honors per-row and per-column overrides", () => {
    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    function vector(values) {
        return new RoArray(values.map((v) => new Float(v)));
    }

    /** Calls the protected updateRect directly, isolating the extent from the 9-patch outset. */
    function measure(grid, numRows, itemSize, layout) {
        grid.hasNinePatch = false;
        const rect = { x: 0, y: 0, width: 0, height: 0 };
        grid.updateRect(rect, numRows, itemSize, layout);
        return rect;
    }

    /** A MarkupList with `count` rows of content, so absolute row indices resolve. */
    function listWithRows(count) {
        const list = new MarkupList();
        const root = SGNodeFactory.createNode("ContentNode");
        for (let i = 0; i < count; i++) {
            const item = SGNodeFactory.createNode("ContentNode");
            item.setValue("title", new BrsString("R" + i));
            root.appendChildToParent(item);
        }
        list.setValue("numRows", new Int32(count));
        list.setValue("numColumns", new Int32(1));
        list.setValue("content", root);
        return list;
    }

    test("rowHeights are summed instead of multiplying itemSize.y", () => {
        // The core defect: 100 + 50 + 200 = 350, not 3 * 72.
        const list = listWithRows(3);
        list.setValue("itemSize", vector([400, 72]));
        list.setValue("rowHeights", vector([100, 50, 200]));

        expect(measure(list, 3, [400, 72]).height).toBe(350);
    });

    test("rows past the end of rowHeights fall back to itemSize.y (no last-entry repeat)", () => {
        // 100 + 50 + 72 + 72 = 294. Repeating the last entry would give 100+50+50+50 = 250.
        const list = listWithRows(4);
        list.setValue("itemSize", vector([400, 72]));
        list.setValue("rowHeights", vector([100, 50]));

        expect(measure(list, 4, [400, 72]).height).toBe(294);
    });

    test("rowSpacings counts the gaps BETWEEN rows only — the trailing entry is dropped", () => {
        // 3 rows of 100 with spacings [10, 20, 30]: 300 + 10 + 20 = 330. The gap after the last
        // rendered row is not part of the extent.
        const list = listWithRows(3);
        list.setValue("itemSize", vector([400, 100]));
        list.setValue("rowSpacings", vector([10, 20, 30]));

        expect(measure(list, 3, [400, 100]).height).toBe(330);
    });

    test("gaps past the end of rowSpacings fall back to itemSpacing.y", () => {
        // 4 rows of 100, spacings [10] then the itemSpacing default of 5: 400 + 10 + 5 + 5 = 420.
        const list = listWithRows(4);
        list.setValue("itemSize", vector([400, 100]));
        list.setValue("itemSpacing", vector([0, 5]));
        list.setValue("rowSpacings", vector([10]));

        expect(measure(list, 4, [400, 100]).height).toBe(420);
    });

    test("a scrolled window measures the rows it actually rendered", () => {
        // rowHeights [300, 300, 50, 50] with a 2-row window scrolled to the bottom pair measures
        // 50 + 50 = 100, not the first two rows' 600.
        const list = listWithRows(4);
        list.setValue("itemSize", vector([400, 72]));
        list.setValue("rowHeights", vector([300, 300, 50, 50]));

        expect(measure(list, 2, [400, 72], { firstRow: 2 }).height).toBe(100);
        expect(measure(list, 2, [400, 72], { firstRow: 0 }).height).toBe(600);
    });

    test("a grid sums columnWidths and columnSpacings", () => {
        // 100 + 200 + 300 widths, 10 + 20 gaps = 630.
        const grid = new MarkupGrid();
        grid.setValue("numRows", new Int32(1));
        grid.setValue("numColumns", new Int32(3));
        grid.setValue("columnWidths", vector([100, 200, 300]));
        grid.setValue("columnSpacings", vector([10, 20]));

        expect(measure(grid, 1, [150, 72]).width).toBe(630);
    });

    test("a list ignores columnWidths (per the reference, they are not used by lists)", () => {
        const list = listWithRows(1);
        list.setValue("itemSize", vector([400, 72]));
        list.setValue("columnWidths", vector([100]));

        expect(measure(list, 1, [400, 72]).width).toBe(400);
    });

    test("an explicit accumulated extent overrides the arithmetic", () => {
        // RowList and PosterGrid pass the extent their loop actually laid out, because a label band /
        // caption zone grows a row by an amount updateRect cannot re-derive from rowHeights.
        const list = listWithRows(2);
        list.setValue("itemSize", vector([400, 72]));
        list.setValue("rowHeights", vector([100, 100]));

        expect(measure(list, 2, [400, 72], { height: 999, width: 888 })).toMatchObject({
            width: 888,
            height: 999,
        });
    });

    test("uniform lists are unchanged (no rowHeights/rowSpacings set)", () => {
        // Pins the pre-existing uniform formula, so the per-track path cannot regress the common case.
        const list = listWithRows(11);
        list.setValue("itemSize", vector([438, 72]));
        list.setValue("itemSpacing", vector([0, 12]));

        const rect = measure(list, 11, [438, 72]);
        expect(rect.height).toBe(11 * 72 + 10 * 12);
        expect(rect.width).toBe(438);
    });
});

// NOTE: the matching render-loop fix (MarkupGrid/MarkupList advanced by `rowSpacings[r]`, the
// RELATIVE display slot, while indexing `rowHeights` by the absolute row) is not directly pinned
// here. Both nodes refuse to build items unless `itemComponentName` names an XML-defined component
// (`customNodeExists`), which a unit test cannot construct — covering the loop needs a CLI fixture
// app. The measurement above and the loop now read the same absolute index, so a future divergence
// between them shows up as a measurement failure.
