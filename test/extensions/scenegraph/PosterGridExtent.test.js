const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Int32, Float, RoArray, Interpreter } = core;

const vector = (values) => new RoArray(values.map((v) => new Float(v)));

/**
 * DEVICE-MEASURED (Streaming Stick, Roku OS 15.2, HD 1280x720) via `postergrid-spacing-probe`,
 * `postergrid-rows-probe` and `postergrid-captions-probe` (`test/simulator/probes/`). Every expected
 * number below is a device reading.
 *
 *   width  = Σ over ALL N cols of (basePosterSize.x + colSpacing_i) + 14 + 14   columnWidths IGNORED
 *   height = Σ over ALL N rows of (rowHeight_i      + rowSpacing_i) + 14 + 50   rowHeights HONORED
 *   spacing_i = (column|row)Spacings[i] ?? itemSpacing.(x|y)   — falls back, never repeats
 *
 * NEITHER axis is symmetric, in two different ways, and both are deliberate:
 *   - `columnWidths` is ignored while `rowHeights` is honored. Do not "unify" them.
 *   - the VERTICAL outset is 14 above the first row but 50 below the last (21/75 at FHD), where the
 *     horizontal one is 14 on both sides. See PosterGrid.rectMarginBottom for the 88 readings that
 *     pin it; it is a grid-level allowance, not per-row, and not a caption zone.
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

    test("rowHeights past the end of the array falls back, it does not repeat", () => {
        // The same rule the spacing arrays follow. `rowHeights=[200]` over 3 rows is
        // 200 + 100 + 100, not 3 x 200 — the latter is what repeating the last entry gives.
        const grid = makeGrid(3, {
            numColumns: new Int32(1),
            numRows: new Int32(3),
            itemSpacing: vector([0, 0]),
            rowHeights: vector([200]),
        });
        // The vertical outset is 14 above the first row + 50 below the last, not 2*14.
        expect(Math.round(rectOf(grid).height)).toBe(200 + 100 + 100 + 14 + 50);
    });

    test("local, parent and scene rects agree once the focus outset is applied", () => {
        // The outset lives in the draw rect, so all three coordinate spaces have to carry it.
        // Local is parent-space minus the node's own translation.
        const grid = makeGrid(1, {
            numColumns: new Int32(1),
            numRows: new Int32(1),
            itemSpacing: vector([0, 0]),
            translation: vector([0, 320]),
        });
        const parent = grid.getBoundingRect("toParent", interpreter);
        const local = grid.getBoundingRect("local", interpreter);
        expect(Math.round(parent.x)).toBe(-14);
        expect(Math.round(parent.y)).toBe(306);
        expect(Math.round(local.x)).toBe(-14);
        expect(Math.round(local.y)).toBe(-14);
        expect(Math.round(local.x)).toBe(Math.round(parent.x) - 0);
        expect(Math.round(local.y)).toBe(Math.round(parent.y) - 320);
    });

    test("a section divider is drawn at the content width, without the trailing gap", () => {
        // The trailing gap is device-backed for the REPORTED extent only. Letting it into the drawn
        // divider would run it 50px past the last poster's right edge.
        const grid = SGNodeFactory.createNode("PosterGrid");
        grid.setValue("basePosterSize", vector([100, 100]));
        grid.setValue("numColumns", new Int32(3));
        grid.setValue("numRows", new Int32(2));
        grid.setValue("itemSpacing", vector([50, 0]));
        grid.setValue("vertFocusAnimationStyle", new BrsString("fixedFocusWrap"));

        const widths = [];
        grid.renderWrapDivider = (rect) => {
            widths.push(Math.round(rect.width));
            return 0;
        };

        const root = SGNodeFactory.createNode("ContentNode");
        for (let i = 0; i < 6; i++) {
            root.appendChildToParent(SGNodeFactory.createNode("ContentNode"));
        }
        grid.setValue("content", root);
        grid.setFocusedItem?.(3);
        grid.renderNode({}, [0, 0], 0, 1);

        // Content width is 3*100 + 2 gaps of 50 = 400; with the trailing gap it would be 450.
        for (const width of widths) {
            expect(width).toBe(400);
        }
    });

    /**
     * DEVICE-MEASURED via `test/simulator/probes/postergrid-captions-probe` — 22 field combinations
     * x {1 row, 2 rows} x {HD, FHD}, 88 readings, all reproduced by:
     *
     *     height      = rows * (posterHeight + captionZone) + rowSpacing terms + top + bottom
     *     top/bottom  = 14/50 (HD), 21/75 (FHD)
     *     captionZone = 0 when caption1NumLines + caption2NumLines == 0
     *                 = 23 + Σ lineHeight(font_i) * lines_i + captionLineSpacing * gaps
     *     gaps        = max(0,lines1-1) + max(0,lines2-1) + (both blocks present ? 1 : 0)
     *
     * The zero-caption cases are pinned exactly. The captioned ones are pinned RELATIVELY (as
     * increments), because the engine's per-line term is currently 1-2px short of the device at
     * every font size: `RoFont.measureTextHeight` returns the font's point size where a device
     * returns its real line height (device `Label` heights: SmallerBold 21/31, Largest 61/91,
     * Tiny 18/26; engine 20/30, 60/90, 16/24). That divergence is engine-wide — it moves every
     * `Label` too, not just a caption — so it is NOT corrected here, and asserting absolute
     * captioned heights would bake the wrong metric into this file. The increments below are
     * font-metric-independent and hold either way.
     */
    describe("caption zone", () => {
        /** Runs `body` with a scene forced to `resolution`, restoring the previous scene after. */
        function atResolution(resolution, body) {
            const previous = sgRoot.scene;
            const scene = SGNodeFactory.createNode("Scene");
            sgRoot.setScene(scene);
            scene.setResolution(resolution);
            try {
                return body();
            } finally {
                sgRoot.setScene(previous ?? SGNodeFactory.createNode("Scene"));
            }
        }

        /** Reported height of a one-column grid of `rows` captioned rows. */
        const heightOf = (rows, fields = {}) =>
            Math.round(
                rectOf(
                    makeGrid(rows, {
                        numColumns: new Int32(1),
                        numRows: new Int32(rows),
                        itemSpacing: vector([0, 0]),
                        ...fields,
                    })
                ).height
            );

        test.each([
            ["HD", 14, 50],
            ["FHD", 21, 75],
        ])("%s: the vertical outset is asymmetric — %d above, %d below", (resolution, top, bottom) => {
            atResolution(resolution, () => {
                // Probe case 0: a bare 100-tall poster, no captions requested.
                expect(heightOf(1)).toBe(100 + top + bottom);
                // ...and case 0 at 2 rows. The allowance appears ONCE, not per row — this is what
                // rules out modelling it as per-cell padding or as a caption zone.
                expect(heightOf(2)).toBe(200 + top + bottom);
            });
        });

        test.each([["HD"], ["FHD"]])("%s: no caption lines requested means no caption zone", (resolution) => {
            atResolution(resolution, () => {
                const bare = heightOf(1);
                // Probe cases A1/A2: `center`/`above` draw the caption OVER the poster, so no zone is
                // needed — and the outset above is present anyway, with 0 lines. Both measured equal
                // to the baseline on device.
                expect(heightOf(1, { captionVertAlignment: new BrsString("center") })).toBe(bare);
                expect(heightOf(1, { captionVertAlignment: new BrsString("above") })).toBe(bare);
            });
        });

        test.each([["HD"], ["FHD"]])("%s: the caption zone is poster-independent", (resolution) => {
            atResolution(resolution, () => {
                // Probe cases G1/G3: a taller poster grows the cell 1:1 and nothing more, so the zone
                // is a flat allowance and not a fraction of basePosterSize.
                const bare = heightOf(1);
                expect(heightOf(1, { basePosterSize: vector([100, 200]) })).toBe(bare + 100);
                expect(heightOf(1, { basePosterSize: vector([100, 300]) })).toBe(bare + 200);
            });
        });

        test.each([["HD"], ["FHD"]])("%s: each caption line past the first costs one line height", (resolution) => {
            atResolution(resolution, () => {
                // Probe cases B1-B3: three points, so a base zone and a per-line height separate.
                // The 1->2 and 2->3 steps are one line each, with no further base step.
                const one = heightOf(1, { caption1NumLines: new Int32(1) });
                const two = heightOf(1, { caption1NumLines: new Int32(2) });
                const three = heightOf(1, { caption1NumLines: new Int32(3) });
                expect(three - two).toBe(two - one);
                // And the base is charged once, at the 0->1 boundary only: the first line costs the
                // base plus a line, every later line just a line.
                expect(one - heightOf(1)).toBeGreaterThan(two - one);
            });
        });

        test.each([["HD"], ["FHD"]])("%s: reservation is declared, never content-driven", (resolution) => {
            atResolution(resolution, () => {
                // Probe cases C1/C2 measured identically to B1/B2 with NO shortDescriptionLine text
                // in the content. `caption1NumLines` alone decides the zone. makeGrid's items carry
                // no caption text at all, so B passing at all is the same fact — assert it directly
                // so a future "only reserve when there is text" change fails here.
                expect(heightOf(1, { caption1NumLines: new Int32(1) })).toBeGreaterThan(heightOf(1));
            });
        });

        test.each([["HD"], ["FHD"]])("%s: captionLineSpacing is charged per gap, not per line", (resolution) => {
            atResolution(resolution, () => {
                // Probe cases E1-E3. One line has no gap, so spacing cannot change it (E1); two lines
                // have one gap (E2); and two single-line blocks have one gap between them (E3).
                const oneLine = { caption1NumLines: new Int32(1) };
                const twoLines = { caption1NumLines: new Int32(2) };
                const bothBlocks = { caption1NumLines: new Int32(1), caption2NumLines: new Int32(1) };
                const spacing = { captionLineSpacing: new Float(20) };

                expect(heightOf(1, { ...oneLine, ...spacing })).toBe(heightOf(1, oneLine));
                expect(heightOf(1, { ...twoLines, ...spacing })).toBe(heightOf(1, twoLines) + 20);
                expect(heightOf(1, { ...bothBlocks, ...spacing })).toBe(heightOf(1, bothBlocks) + 20);
            });
        });

        test.each([["HD"], ["FHD"]])("%s: the two caption blocks share one base, not two", (resolution) => {
            atResolution(resolution, () => {
                // Probe cases D3/D4: stacking the blocks costs the sum of their lines plus ONE base,
                // so 1+1 lines measures the same as 2 lines of a single block (both fonts default to
                // the same face in the engine).
                expect(heightOf(1, { caption1NumLines: new Int32(1), caption2NumLines: new Int32(1) })).toBe(
                    heightOf(1, { caption1NumLines: new Int32(2) })
                );
            });
        });

        test.each([["HD"], ["FHD"]])("%s: the per-line term follows the caption font", (resolution) => {
            atResolution(resolution, () => {
                // Probe cases F1-F3: a larger font grows the zone and a smaller one shrinks it, which
                // is what rules out a constant per-line height. Set via dot assignment, not setValue:
                // a font-typed field only converts a "font:<Name>" string through that path.
                const withFont = (fontName, lines) => {
                    const grid = SGNodeFactory.createNode("PosterGrid");
                    grid.setValue("basePosterSize", vector([100, 100]));
                    grid.setValue("numColumns", new Int32(1));
                    grid.setValue("numRows", new Int32(1));
                    grid.setValue("itemSpacing", vector([0, 0]));
                    grid.setValue("caption1NumLines", new Int32(lines));
                    grid.set(new BrsString("caption1Font"), new BrsString(fontName));
                    const root = SGNodeFactory.createNode("ContentNode");
                    root.appendChildToParent(SGNodeFactory.createNode("ContentNode"));
                    grid.setValue("content", root);
                    grid.renderNode({}, [0, 0], 0, 1);
                    return Math.round(rectOf(grid).height);
                };
                const base = heightOf(1, { caption1NumLines: new Int32(1) });
                expect(withFont("font:LargestSystemFont", 1)).toBeGreaterThan(base);
                expect(withFont("font:TinySystemFont", 1)).toBeLessThan(base);
                // Two lines of the large font cost exactly twice its line height.
                const large1 = withFont("font:LargestSystemFont", 1);
                const large2 = withFont("font:LargestSystemFont", 2);
                expect(large2 - large1).toBe(large1 - heightOf(1) - 23);
            });
        });
    });
});
