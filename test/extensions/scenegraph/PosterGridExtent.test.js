const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, Int32, Float, RoArray, Interpreter } = core;

const vector = (values) => new RoArray(values.map((v) => new Float(v)));

/**
 * DEVICE-MEASURED (Streaming Stick, Roku OS 15.2, HD 1280x720) via `out/postergrid-spacing-probe`
 * and `out/postergrid-rows-probe`. Every expected number below is a device reading.
 *
 *   width  = Σ over ALL N cols of (basePosterSize.x + colSpacing_i) + 2*14   columnWidths IGNORED
 *   height = Σ over ALL N rows of (rowHeight_i      + rowSpacing_i) + 2*14   rowHeights HONORED
 *   spacing_i = (column|row)Spacings[i] ?? itemSpacing.(x|y)   — falls back, never repeats
 *
 * The axes are deliberately NOT symmetric: `columnWidths` is ignored while `rowHeights` is honored.
 * Do not "unify" them.
 */
describe("PosterGrid reports the extent a device reports", () => {
    let interpreter;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    /** A PosterGrid with `count` empty content items — no fields, so nothing can resize a cell. */
    function makeGrid(count, fields) {
        const grid = SGNodeFactory.createNode("PosterGrid");
        grid.setValue("basePosterSize", vector([100, 100]));
        for (const [name, value] of Object.entries(fields)) {
            grid.setValue(name, value);
        }
        const root = SGNodeFactory.createNode("ContentNode");
        for (let i = 0; i < count; i++) {
            root.appendChildToParent(SGNodeFactory.createNode("ContentNode"));
        }
        grid.setValue("content", root);
        grid.renderNode({}, [0, 0], 0, 1);
        return grid;
    }

    const rectOf = (grid) => grid.getBoundingRect("toParent", interpreter);

    test("a one-column grid outsets the reported rect by the focus margin", () => {
        // Device P1: {x:-14, y:-14, w:128} for a 100-wide poster.
        const grid = makeGrid(1, {
            numColumns: new Int32(1),
            numRows: new Int32(1),
            itemSpacing: vector([0, 0]),
        });
        const rect = rectOf(grid);
        expect(Math.round(rect.width)).toBe(128);
        expect(Math.round(rect.x)).toBe(-14);
        expect(Math.round(rect.y)).toBe(-14);
    });

    test("columnWidths is ignored — the cell width comes from basePosterSize", () => {
        // Device P2: identical to P1 despite columnWidths=[200].
        const grid = makeGrid(1, {
            numColumns: new Int32(1),
            numRows: new Int32(1),
            itemSpacing: vector([0, 0]),
            columnWidths: vector([200]),
        });
        expect(Math.round(rectOf(grid).width)).toBe(128);
    });

    test("the gap AFTER the last column is part of the extent", () => {
        // Device P3: 3 cols of 100, itemSpacing.x=50 → 3*100 + 3*50 + 28 = 478 (not 428).
        const grid = makeGrid(3, {
            numColumns: new Int32(3),
            numRows: new Int32(1),
            itemSpacing: vector([50, 0]),
        });
        expect(Math.round(rectOf(grid).width)).toBe(478);
    });

    test("a short columnSpacings falls back to itemSpacing.x rather than repeating", () => {
        // Device P4: columnSpacings=[10] over 3 columns → 10 + 50 + 50, i.e. 438.
        // Repeating the last entry would give 358.
        const grid = makeGrid(3, {
            numColumns: new Int32(3),
            numRows: new Int32(1),
            itemSpacing: vector([50, 0]),
            columnSpacings: vector([10]),
        });
        expect(Math.round(rectOf(grid).width)).toBe(438);
    });

    test("a fully specified columnSpacings still adds a trailing fall-back gap", () => {
        // Device P5: columnSpacings=[10,20] over 3 columns → 10 + 20 + 50 (the third falls back).
        const grid = makeGrid(3, {
            numColumns: new Int32(3),
            numRows: new Int32(1),
            itemSpacing: vector([50, 0]),
            columnSpacings: vector([10, 20]),
        });
        expect(Math.round(rectOf(grid).width)).toBe(408);
    });

    test("rowHeights IS honored, unlike columnWidths", () => {
        // Device R6: rowHeights=[200,50,100] with no spacing → those heights are used.
        // The height assertion is relative: see the caption-zone note below.
        const honored = makeGrid(3, {
            numColumns: new Int32(1),
            numRows: new Int32(3),
            itemSpacing: vector([0, 0]),
            rowHeights: vector([200, 50, 100]),
        });
        const uniform = makeGrid(3, {
            numColumns: new Int32(1),
            numRows: new Int32(3),
            itemSpacing: vector([0, 0]),
        });
        // 200+50+100 = 350 vs 3*100 = 300.
        expect(Math.round(rectOf(honored).height) - Math.round(rectOf(uniform).height)).toBe(50);
    });

    test("a short rowSpacings falls back to itemSpacing.y, and the trailing gap counts", () => {
        // Device R4 vs R5: with itemSpacing.y=50, no array gives 3 gaps of 50; rowSpacings=[10]
        // gives 10 + 50 + 50. The two differ by exactly 40, whatever the caption zone contributes.
        const noArray = makeGrid(3, {
            numColumns: new Int32(1),
            numRows: new Int32(3),
            itemSpacing: vector([0, 50]),
        });
        const shortArray = makeGrid(3, {
            numColumns: new Int32(1),
            numRows: new Int32(3),
            itemSpacing: vector([0, 50]),
            rowSpacings: vector([10]),
        });
        expect(Math.round(rectOf(noArray).height) - Math.round(rectOf(shortArray).height)).toBe(40);

        // And the trailing gap is included: 3 rows of 100 with 3 gaps of 50, not 2.
        const noSpacing = makeGrid(3, {
            numColumns: new Int32(1),
            numRows: new Int32(3),
            itemSpacing: vector([0, 0]),
        });
        expect(Math.round(rectOf(noArray).height) - Math.round(rectOf(noSpacing).height)).toBe(150);
    });
});
