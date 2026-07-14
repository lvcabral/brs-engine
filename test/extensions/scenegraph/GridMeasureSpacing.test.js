const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { MarkupGrid, MarkupList } = scenegraph;
const { BrsDevice, Int32, Float, RoArray } = core;

/**
 * Regression: a grid's reported bounding rectangle must include the inter-item spacing.
 * The render loop lays each row/column out at `itemSize + itemSpacing` steps, so N rows span
 * `N*itemHeight + (N-1)*rowSpacing`. `updateRect` previously reported only `N*itemHeight`,
 * omitting the gaps — so an app that vertically centers a menu via
 * `(screenHeight - boundingRect().height) / 2` placed it too low by the total gap height.
 *
 * These tests drive `updateRect` directly with `hasNinePatch = false` to isolate the spacing
 * contribution from the (unchanged) 9-patch focus-margin term — matching a menu grid whose focus
 * highlight is a sibling Poster rather than the grid's built-in focus feedback.
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

    /** Calls the protected updateRect with a fresh rect and returns the computed size. */
    function measure(grid, numRows, itemSize) {
        grid.hasNinePatch = false;
        const rect = { x: 0, y: 0, width: 0, height: 0 };
        grid.updateRect(rect, numRows, itemSize);
        return rect;
    }

    test("MarkupGrid vertical extent adds (numRows - 1) * rowSpacing", () => {
        // Mirrors a side-menu grid: 11 rows of 72px with 12px between rows.
        // 11*72 + 10*12 = 912 (not the old 11*72 = 792).
        const grid = new MarkupGrid();
        grid.setValue("numRows", new Int32(11));
        grid.setValue("numColumns", new Int32(1));
        grid.setValue("itemSpacing", vector([0, 12]));

        const rect = measure(grid, 11, [438, 72]);
        expect(rect.height).toBe(912);
        expect(rect.width).toBe(438);
        // The app-side vertical centering is now correct: (1080 - 912) / 2 = 84.
        expect((1080 - rect.height) / 2).toBe(84);
    });

    test("MarkupGrid horizontal extent adds (numColumns - 1) * columnSpacing", () => {
        const grid = new MarkupGrid();
        grid.setValue("numRows", new Int32(1));
        grid.setValue("numColumns", new Int32(3));
        grid.setValue("itemSpacing", vector([20, 0]));
        grid.numCols = 3;

        const rect = measure(grid, 1, [100, 72]);
        // 3*100 + 2*20 = 340.
        expect(rect.width).toBe(340);
    });

    test("no spacing (default itemSpacing) leaves the extent unchanged", () => {
        const grid = new MarkupList();
        grid.setValue("numRows", new Int32(5));

        const rect = measure(grid, 5, [438, 72]);
        // 5 rows, no gap: 5*72 = 360.
        expect(rect.height).toBe(360);
    });

    test("a single row/column contributes no spacing", () => {
        const grid = new MarkupGrid();
        grid.setValue("numRows", new Int32(1));
        grid.setValue("numColumns", new Int32(1));
        grid.setValue("itemSpacing", vector([50, 50]));

        const rect = measure(grid, 1, [438, 72]);
        expect(rect.height).toBe(72);
        expect(rect.width).toBe(438);
    });
});
