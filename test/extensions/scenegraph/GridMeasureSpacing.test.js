const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { MarkupGrid, MarkupList, RowList, ContentNode } = scenegraph;
const { BrsDevice, Int32, Float, RoArray } = core;

/**
 * A grid's reported bounding rect: its laid-out extent, spacing after every row included, plus the
 * outsets a device adds. Every expectation is a DEVICE-MEASURED HD case of
 * `test/simulator/probes/grid-rect-probe` (`device-trace-hd.txt`), named after it. `updateRect` is
 * driven directly; the outsets do not depend on the focus bitmap, so `hasNinePatch` is irrelevant.
 */
describe("grid boundingRect includes inter-item spacing", () => {
    beforeAll(() => {
        // MarkupGrid/MarkupList font-typed defaults need the common: fonts; mount once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    function vector(values) {
        return new RoArray(values.map((v) => new Float(v)));
    }

    /** Calls the protected updateRect with a fresh rect at the origin and returns it. */
    function measure(grid, numRows, itemSize) {
        const rect = { x: 0, y: 0, width: 0, height: 0 };
        grid.updateRect(rect, numRows, itemSize);
        return rect;
    }

    function markupGrid(numRows, numColumns, spacing) {
        const grid = new MarkupGrid();
        grid.setValue("numRows", new Int32(numRows));
        grid.setValue("numColumns", new Int32(numColumns));
        grid.setValue("itemSpacing", vector(spacing));
        grid.numCols = numColumns;
        return grid;
    }

    test("MarkupGrid counts the spacing after every row and column (mg_2x2)", () => {
        const rect = measure(markupGrid(2, 2, [10, 10]), 2, [200, 50]);
        // 22 + 2 * (200 + 10) + 22 wide; 22 + 2 * (50 + 10) + 22 + 36 tall.
        expect(rect).toEqual({ x: -22, y: -22, width: 464, height: 200 });
    });

    test("a single-row MarkupGrid strip has no bottom allowance (mg_base)", () => {
        const rect = measure(markupGrid(1, 3, [20, 0]), 1, [100, 100]);
        expect(rect).toEqual({ x: -22, y: -22, width: 404, height: 144 });
    });

    test("a single-column MarkupGrid adds no column spacing and keeps the allowance (mg_1x1)", () => {
        const rect = measure(markupGrid(1, 1, [20, 0]), 1, [100, 100]);
        expect(rect).toEqual({ x: -22, y: -22, width: 144, height: 180 });
    });

    test("the allowance follows the declared numRows, not the rows of content (mg_3rows_1content)", () => {
        const rect = measure(markupGrid(3, 3, [20, 20]), 1, [100, 100]);
        expect(rect).toEqual({ x: -22, y: -22, width: 404, height: 200 });
    });

    test("MarkupList is outset once, 6 above and 30 below (ml_2rows, ml_base)", () => {
        const list = new MarkupList();
        list.setValue("itemSpacing", vector([0, 10]));
        expect(measure(list, 2, [300, 60])).toEqual({ x: -24, y: -6, width: 348, height: 176 });
        expect(measure(list, 3, [300, 60])).toEqual({ x: -24, y: -6, width: 348, height: 246 });
    });

    test("a RowList measures its numRows window whatever its scroll (rl_scrolled)", () => {
        const list = new RowList();
        list.setValue("itemSize", vector([600, 100]));
        list.setValue("itemSpacing", vector([0, 20]));
        list.setValue("numRows", new Int32(2));
        for (let r = 0; r < 5; r++) {
            list.content.push(new ContentNode());
        }
        const expected = { x: -22, y: -22, width: 644, height: 22 + 2 * (100 + 20) + 22 };
        expect(measure(list, 2, [600, 100])).toEqual(expected);
        list.focusIndex = 4;
        expect(measure(list, 1, [600, 100])).toEqual(expected);
    });
});
