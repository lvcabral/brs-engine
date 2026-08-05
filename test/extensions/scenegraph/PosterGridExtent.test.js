const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, BrsBoolean, Int32, Float, RoArray, Interpreter } = core;

const vector = (values) => new RoArray(values.map((v) => new Float(v)));

/**
 * DEVICE-MEASURED (Streaming Stick, Roku OS 15.2, HD 1280x720) via `postergrid-spacing-probe`,
 * `postergrid-rows-probe` and `postergrid-captions-probe` (`test/simulator/probes/`). Every expected
 * number below is a device reading.
 *
 *   width  = Σ over DRAWN cols of (basePosterSize.x + colSpacing_i) + 14 + 14   columnWidths IGNORED
 *   height = Σ over ALL N rows of (rowHeight_i      + rowSpacing_i) + 14 + 50   rowHeights HONORED
 *   spacing_i = (column|row)Spacings[i] ?? itemSpacing.(x|y)   — falls back, never repeats
 *
 * NEITHER axis is symmetric, in three different ways, and all three are deliberate:
 *   - `columnWidths` is ignored while `rowHeights` is honored. Do not "unify" them.
 *   - the VERTICAL outset is 14 above the first row but 50 below the last (21/75 at FHD), where the
 *     horizontal one is 14 on both sides. It is a grid-level allowance, not per-row, and not a caption
 *     zone. That bottom 50 is also CONDITIONAL — see the "horizontal strip" describe block below.
 *   - the reported WIDTH counts the columns actually drawn, while the strip gate reads the DECLARED
 *     `numColumns`. Two different notions of "columns", both measured; do not unify those either.
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

        test.each([
            ["HD", 14],
            ["FHD", 21],
        ])("%s: the outset above the first row is %d, not just the sum with the bottom", (resolution, top) => {
            atResolution(resolution, () => {
                // The height assertions above pin only `top + bottom`, so on their own they permit any
                // split of that sum — including a wrong one, which would keep every height correct and
                // move every `y`. `rect.y` is what separates them, and `rect.x` is invisible to heights
                // entirely. Both resolutions are now device readings from `postergrid-margins-probe`
                // ({x:-14, y:-14, w:128} HD; {x:-21, y:-21, w:142} FHD, with left == right == top); the
                // FHD pair used to be an inference from the 1.5x scale.
                const rect = rectOf(
                    makeGrid(1, {
                        numColumns: new Int32(1),
                        numRows: new Int32(1),
                        itemSpacing: vector([0, 0]),
                    })
                );
                expect(Math.round(rect.y)).toBe(-top);
                // ...and the horizontal outset, which no height assertion can see at all.
                expect(Math.round(rect.x)).toBe(-top);
                expect(Math.round(rect.width)).toBe(100 + top * 2);
            });
        });

        test.each([["HD"], ["FHD"]])("%s: a hidden grid measures the same extent as a visible one", (resolution) => {
            atResolution(resolution, () => {
                // `ArrayGrid.measureHiddenExtent` re-derives the extent arithmetically for an app that
                // sizes sibling UI from a still-hidden grid's boundingRect(). Its generic per-track path
                // adds `margin.y * 2` PER ROW, which cannot agree with a once-per-grid asymmetric outset
                // at more than one row count — so PosterGrid overrides it. Assert several row counts:
                // the inherited arithmetic happened to agree at exactly 1 row and diverged in both
                // directions either side of it, so a single-row check proves nothing here.
                for (const rows of [1, 2, 3]) {
                    const fields = {
                        numColumns: new Int32(1),
                        numRows: new Int32(rows),
                        itemSpacing: vector([0, 50]),
                        caption1NumLines: new Int32(1),
                    };
                    const visible = rectOf(makeGrid(rows, fields));
                    const hidden = rectOf(makeGrid(rows, { ...fields, visible: BrsBoolean.False }));
                    expect(Math.round(hidden.height)).toBe(Math.round(visible.height));
                    expect(Math.round(hidden.width)).toBe(Math.round(visible.width));
                }
            });
        });

        test("a hidden grid picks up content appended after the content node was assigned", () => {
            // Assigning `content` refreshes the grid eagerly, so a grid built all at once never
            // exercises the dirty-content path. An app that assigns an empty ContentNode and then
            // fills it (a feed arriving after the screen is built) does: the append only marks the
            // node changed, and the refresh happens in the next layout pass. The visible path runs
            // it from `ArrayGrid.renderNodeContent`; the hidden path reaches `measureHiddenExtent`
            // directly, so it has to run the refresh itself or it measures the stale row count.
            const build = (visible) => {
                const grid = SGNodeFactory.createNode("PosterGrid");
                grid.setValue("basePosterSize", vector([100, 100]));
                grid.setValue("numColumns", new Int32(1));
                grid.setValue("numRows", new Int32(3));
                grid.setValue("itemSpacing", vector([0, 0]));
                const root = SGNodeFactory.createNode("ContentNode");
                grid.setValue("content", root);
                grid.setValue("visible", BrsBoolean.from(visible));
                for (let i = 0; i < 3; i++) {
                    root.appendChildToParent(SGNodeFactory.createNode("ContentNode"));
                }
                grid.renderNode({}, [0, 0], 0, 1);
                return rectOf(grid);
            };
            const visible = build(true);
            const hidden = build(false);
            expect(Math.round(hidden.height)).toBe(Math.round(visible.height));
            expect(Math.round(hidden.width)).toBe(Math.round(visible.width));
        });

        test.each([["floatingFocus"], ["fixedFocus"], ["fixedFocusWrap"]])(
            "a hidden %s grid measures the same extent as a visible one after scrolling",
            (style) => {
                // Both passes resolve rows through `getRenderRowIndex`, which reads `currRow`. Only the
                // visible path used to settle it, so a grid scrolled past its first page measured its
                // ORIGINAL rows while hidden — with per-row `rowHeights` that is a different height,
                // and under fixedFocus a different drawn-column count, so a different width too.
                const fields = {
                    numColumns: new Int32(2),
                    numRows: new Int32(2),
                    itemSpacing: vector([0, 0]),
                    rowHeights: vector([100, 100, 250, 250]),
                    vertFocusAnimationStyle: new BrsString(style),
                };
                const build = (visible) => {
                    const grid = makeGrid(7, { ...fields, visible: BrsBoolean.from(visible) });
                    // Past the first page, so the rows on screen are no longer rows 0..1.
                    grid.setValue("jumpToItem", new Int32(6));
                    grid.renderNode({}, [0, 0], 0, 1);
                    return rectOf(grid);
                };
                const visible = build(true);
                const hidden = build(false);
                expect(Math.round(hidden.height)).toBe(Math.round(visible.height));
                expect(Math.round(hidden.width)).toBe(Math.round(visible.width));
            }
        );

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

        test.each([["HD"], ["FHD"]])("%s: caption text is placed inside the zone that was reserved", (resolution) => {
            atResolution(resolution, () => {
                // Both the reserved SIZE and the offset inside it are now device-measured — the offset
                // is 0, by screenshot subtraction, since no rect API reaches a caption Label (see
                // PosterGrid.CaptionTextOffset). Containment is asserted rather than the constant
                // because it holds under either value: the text starts below the poster and its last
                // line ends within the reserved zone. Without this, an edit to the offset could push
                // text out of the cell and no height assertion would notice — every test above reads
                // `height` only.
                const grid = makeGrid(1, {
                    numColumns: new Int32(1),
                    numRows: new Int32(1),
                    itemSpacing: vector([0, 0]),
                    caption1NumLines: new Int32(2),
                });
                const layout = grid.layoutByIndex.get(0);
                const posterBottom = layout.posterRect.y + layout.posterRect.height;
                const zoneBottom = posterBottom + 23 + layout.caption1Rect.height;
                expect(layout.caption1Rect.y).toBeGreaterThanOrEqual(posterBottom);
                expect(layout.caption1Rect.y + layout.caption1Rect.height).toBeLessThanOrEqual(zoneBottom);
                // Integer, so a text baseline never lands on a half-pixel.
                expect(Number.isInteger(layout.caption1Rect.y)).toBe(true);
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

        describe("on-poster caption placement (top/center/bottom) excludes the below/above zone", () => {
            // requiresCaptionZone() is false for top/center/bottom — the caption draws OVER the poster,
            // so none of the 23px zone reserved for below/above should factor into where it sits. A grid
            // tall enough that neither offset clamps to 0 isolates the centering math from the outset.
            function layoutOf(placement) {
                const grid = makeGrid(1, {
                    numColumns: new Int32(1),
                    numRows: new Int32(1),
                    itemSpacing: vector([0, 0]),
                    basePosterSize: vector([100, 300]),
                    caption1NumLines: new Int32(1),
                    captionVertAlignment: new BrsString(placement),
                });
                return grid.getLayoutForIndex(0);
            }

            test("bottom: the caption's own bottom edge reaches the poster's bottom edge", () => {
                const layout = layoutOf("bottom");
                expect(layout.caption1Rect.y + layout.caption1Rect.height).toBeCloseTo(300);
            });

            test("center: the gap above the caption equals the gap below it", () => {
                const layout = layoutOf("center");
                const topGap = layout.caption1Rect.y;
                const bottomGap = 300 - layout.caption1Rect.y - layout.caption1Rect.height;
                expect(topGap).toBeCloseTo(bottomGap);
            });
        });
    });

    /**
     * DEVICE-MEASURED via `test/simulator/probes/postergrid-outset-axis-probe` — 17 cases x {HD, FHD},
     * plus the 6 cases of `postergrid-margins-probe`. The extra bottom allowance (36 HD / 54 FHD beyond
     * the symmetric margin) is NOT unconditional:
     *
     *     absent iff  displayed rows == 1  &&  numColumns > 1      (a horizontal strip)
     *
     * It is a CONJUNCTION, which is why five plausible single-variable rules were measured and rejected;
     * each test below names the probe case that killed one. Keeping the losers as tests is the point —
     * a "simplification" to any single variable fails here rather than on a device.
     */
    describe("the extra bottom allowance is gated on the grid being a horizontal strip", () => {
        /** Reported rect of a grid, with everything the gate reads stated per case. */
        function gridRect({ resolution, cols, rows, poster = [100, 100], items = cols * rows, fields = {} }) {
            return atResolution(resolution, () => {
                const grid = makeGrid(items, {
                    numColumns: new Int32(cols),
                    numRows: new Int32(rows),
                    itemSpacing: vector([0, 0]),
                    basePosterSize: vector(poster),
                    ...fields,
                });
                const rect = rectOf(grid);
                return { width: Math.round(rect.width), height: Math.round(rect.height) };
            });
        }

        // margin = the symmetric outset (left/top/right); allowance = the extra below the last row.
        test.each([
            ["HD", 14, 36],
            ["FHD", 21, 54],
        ])("%s: multi-column single-row loses the allowance, every other shape keeps it", (res, margin, extra) => {
            // A1 vs A2 — the pair the margins probe first stumbled on (its M1 and M4), reproduced here
            // as the baseline the rest of this block varies against.
            expect(gridRect({ resolution: res, cols: 1, rows: 1 }).height).toBe(100 + margin * 2 + extra);
            expect(gridRect({ resolution: res, cols: 3, rows: 1 }).height).toBe(100 + margin * 2);

            // A3/A4 — not a threshold somewhere above 3: 2 columns already loses it, 4 still has.
            expect(gridRect({ resolution: res, cols: 2, rows: 1 }).height).toBe(100 + margin * 2);
            expect(gridRect({ resolution: res, cols: 4, rows: 1 }).height).toBe(100 + margin * 2);
        });

        test.each([
            ["HD", 14, 36],
            ["FHD", 21, 54],
        ])("%s: NOT the column count — 3 columns keep the allowance once they have rows", (res, margin, extra) => {
            // B1 vs A2: same 3 columns, 4 rows instead of 1. Kills a rule reading only `numColumns`,
            // which is the most mechanical reading of the original divergence and what a careless fix
            // would have implemented.
            expect(gridRect({ resolution: res, cols: 3, rows: 4, items: 12 }).height).toBe(400 + margin * 2 + extra);
        });

        test.each([
            ["HD", 14, 36],
            ["FHD", 21, 54],
        ])("%s: NOT the content shape — one wide column keeps it, three tall columns lose it", (res, margin, extra) => {
            // C1: a single column 400 wide by 100 tall is WIDER than it is tall and keeps the allowance,
            // so "content wider than tall" cannot be the rule.
            expect(gridRect({ resolution: res, cols: 1, rows: 1, poster: [400, 100] }).height).toBe(
                100 + margin * 2 + extra
            );
            // B2: the mirror — 3 columns of 100x400 is TALLER than wide (300x400) and still loses it.
            expect(gridRect({ resolution: res, cols: 3, rows: 1, poster: [100, 400] }).height).toBe(400 + margin * 2);
        });

        test.each([
            ["HD", 14, 36],
            ["FHD", 21, 54],
        ])("%s: NOT a width threshold — 700 wide keeps it, 90 wide over 3 columns loses it", (res, margin, extra) => {
            // D1 vs D3. A threshold would have to sit both above 700 and below 90 to explain these two.
            expect(gridRect({ resolution: res, cols: 1, rows: 1, poster: [700, 100] }).height).toBe(
                100 + margin * 2 + extra
            );
            expect(gridRect({ resolution: res, cols: 3, rows: 1, poster: [30, 100] }).height).toBe(100 + margin * 2);
        });

        test.each([
            ["HD", 14],
            ["FHD", 21],
        ])("%s: the gate reads DECLARED numColumns while the width follows items drawn", (res, margin) => {
            // F3: 3 columns holding only 2 items. The reported WIDTH is two cells wide, yet the
            // allowance is still gone — so the gate reads the declared `numColumns` and not the number
            // of items actually placed side by side. Two different notions of "columns" in one node,
            // device-confirmed; asserting both in one test is what keeps them from being unified.
            const rect = gridRect({ resolution: res, cols: 3, rows: 1, items: 2 });
            expect(rect.height).toBe(100 + margin * 2);
            expect(rect.width).toBe(200 + margin * 2);
        });

        test.each([
            ["HD", 14, 36],
            ["FHD", 21, 54],
        ])("%s: NOT a mis-attributed caption allowance — the zone is an independent term", (res, margin, extra) => {
            // E1 vs E2. A captioned 3x1 grid reports margin + poster + zone + margin, with no
            // allowance; a captioned 1x1 grid reports the same plus the allowance. So the caption zone
            // and the allowance add independently, and the 36/54 is not a zone in disguise.
            const captioned = { fields: { caption1NumLines: new Int32(1) } };
            const stripBare = gridRect({ resolution: res, cols: 3, rows: 1 }).height;
            const strip = gridRect({ resolution: res, cols: 3, rows: 1, ...captioned }).height;
            const columnBare = gridRect({ resolution: res, cols: 1, rows: 1 }).height;
            const column = gridRect({ resolution: res, cols: 1, rows: 1, ...captioned }).height;

            // The zone costs the same whether or not the allowance is there...
            expect(strip - stripBare).toBe(column - columnBare);
            // ...and the allowance is exactly the gap between them, captioned or not.
            expect(column - strip).toBe(extra);
            expect(columnBare - stripBare).toBe(extra);
            // And the zone itself decomposes as the non-scaling base 23 plus one line height, where
            // that line height is measured independently as the 1->2 line step in the same shape.
            // This is what makes E1 decisive on device: HD read 172 = 14 + 100 + 23 + 21 + 14, which
            // requires zone-present AND allowance-absent — allowance-present with no zone gives 164.
            // (At FHD both readings give 196, so HD is the resolution that proves the model.) Asserted
            // as a decomposition rather than 172 because the engine's per-line term is the documented
            // 1px short of the device's here; the base and the gate are what this test owns.
            const twoLines = gridRect({
                resolution: res,
                cols: 3,
                rows: 1,
                fields: { caption1NumLines: new Int32(2) },
            }).height;
            const perLine = twoLines - strip;
            expect(strip - stripBare).toBe(23 + perLine);
        });

        test.each([
            ["HD", 14, 36],
            ["FHD", 21, 54],
        ])("%s: an explicit itemSize does not change which rule applies", (res, margin, extra) => {
            // F1/F2: the gate reads the grid's shape, not how the cell size was arrived at.
            const itemSize = { fields: { itemSize: vector([100, 100]) } };
            expect(gridRect({ resolution: res, cols: 3, rows: 1, ...itemSize }).height).toBe(100 + margin * 2);
            expect(gridRect({ resolution: res, cols: 1, rows: 1, ...itemSize }).height).toBe(100 + margin * 2 + extra);
        });

        test.each([["HD"], ["FHD"]])("%s: a hidden strip measures the same extent as a visible one", (res) => {
            // The gate lives in `rectMarginBottom`, which both the rendered path and
            // `measureHiddenExtent` call — the rendered one with the rows it actually drew, the hidden
            // one with the rows it computed. If either forgot to pass a row count the two would
            // disagree here, and an app sizing sibling UI from a still-hidden grid would be off by 36.
            for (const [cols, rows, items] of [
                [3, 1, 3],
                [1, 1, 1],
                [3, 4, 12],
            ]) {
                const visible = gridRect({ resolution: res, cols, rows, items });
                const hidden = gridRect({ resolution: res, cols, rows, items, fields: { visible: BrsBoolean.False } });
                expect(hidden).toEqual(visible);
            }
        });
    });
});
