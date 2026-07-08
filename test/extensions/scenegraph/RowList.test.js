const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot, getBrsValueFromFieldType } = scenegraph;
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

    test("fixedFocusWrap renders the preceding wrapped item in the left margin", () => {
        // Regression: in fixedFocusWrap the row wraps in BOTH directions, so the tail end of the
        // preceding (wrapped) item must be partially visible in the margin to the LEFT of the focused
        // item. The renderer used to draw nothing left of the focus offset, leaving a blank margin.
        const list = SGNodeFactory.createNode("RowList");
        const items = [];
        for (let i = 0; i < 15; i++) {
            items.push("A" + i);
        }
        list.setValue("content", buildContent([items]));
        list.setValue("itemSize", new RoArray([new Int32(375), new Int32(197)]));
        list.setValue("numRows", new Int32(1));
        list.setValue("focusXOffset", new RoArray([new Int32(165)]));
        list.setValue("rowFocusAnimationStyle", new BrsString("FixedFocusWrap"));
        list.setValue("rowItemSize", new RoArray([new RoArray([new Int32(375), new Int32(197)])]));
        list.setValue("rowItemSpacing", new RoArray([new RoArray([new Int32(30), new Int32(0)])]));

        // Capture the x-origin each item component is rendered at.
        const positions = [];
        const original = list.createItemComponent.bind(list);
        list.createItemComponent = (interp, itemRect, content) => {
            const comp = original(interp, itemRect, content);
            const render = comp.renderNode.bind(comp);
            comp.renderNode = (i2, origin, angle, opacity, draw2D) => {
                positions.push({ title: content.getValueJS("title"), x: Math.round(origin[0]) });
                return render(i2, origin, angle, opacity, draw2D);
            };
            return comp;
        };
        list.renderNode({}, [0, 0], 0, 1);

        // Focused item (A0) sits exactly at the focus offset...
        const focused = positions.find((p) => p.title === "A0");
        expect(focused.x).toBe(165);
        // ...and the previous (wrapped) item A14 is drawn partly into the left margin: its origin is
        // left of the focus offset (negative here) but its right edge is still on screen (x + width > 0).
        const wrapped = positions.find((p) => p.title === "A14");
        expect(wrapped).toBeDefined();
        expect(wrapped.x).toBeLessThan(165);
        expect(wrapped.x + 375).toBeGreaterThan(0);
    });

    test("fixedFocusWrap draws no preceding item when focusXOffset is 0 (item at the list's left edge)", () => {
        // Regression (SceneGraphTutorial rowlist): with the default focusXOffset (0) the focused item
        // sits at the RowList's OWN left edge, so there is no room for a partial preceding item. The
        // wrapped tail must be clipped to the list's left edge (translation.x), not the scene's (0) —
        // otherwise a partial item bleeds into the margin to the left of the list.
        const list = SGNodeFactory.createNode("RowList");
        const items = [];
        for (let i = 0; i < 15; i++) {
            items.push("A" + i);
        }
        list.setValue("content", buildContent([items]));
        list.setValue("itemSize", new RoArray([new Int32(536 * 3), new Int32(308)]));
        list.setValue("numRows", new Int32(1));
        // The list is translated right; its left edge (and the focused item) is at x = 130.
        list.setValue("translation", new RoArray([new Int32(130), new Int32(0)]));
        list.setValue("rowItemSize", new RoArray([new RoArray([new Int32(536), new Int32(308)])]));
        list.setValue("rowFocusAnimationStyle", new BrsString("FixedFocusWrap"));
        // focusXOffset left at its default of 0.

        const positions = [];
        const original = list.createItemComponent.bind(list);
        list.createItemComponent = (interp, itemRect, content) => {
            const comp = original(interp, itemRect, content);
            const render = comp.renderNode.bind(comp);
            comp.renderNode = (i2, origin, angle, opacity, draw2D) => {
                positions.push({ title: content.getValueJS("title"), x: Math.round(origin[0]) });
                return render(i2, origin, angle, opacity, draw2D);
            };
            return comp;
        };
        list.renderNode({}, [0, 0], 0, 1);

        // The focused item A0 sits at the list's left edge, and nothing is drawn to its left.
        expect(positions.find((p) => p.title === "A0").x).toBe(130);
        expect(Math.min(...positions.map((p) => p.x))).toBe(130);
    });

    test("clips row items to the list's own bounds when the content overflows the row width", () => {
        // Regression (jellyfin Home): items whose row is narrower than the screen (itemSize width set to
        // cut off at the safe zone) must be clipped at the LIST's right edge — aligned with the row
        // counter — not bleed to the screen border. The clip is widened by the focus-feedback margin so
        // the focused item's indicator is not cut, and is only applied when the content overflows.
        function makeList(itemCount) {
            const list = SGNodeFactory.createNode("RowList");
            const items = [];
            for (let i = 0; i < itemCount; i++) {
                items.push("A" + i);
            }
            list.setValue("content", buildContent([items]));
            list.setValue("itemSize", new RoArray([new Int32(1703), new Int32(300)]));
            list.setValue("numRows", new Int32(1));
            list.setValue("translation", new RoArray([new Int32(100), new Int32(0)]));
            list.setValue("rowItemSize", new RoArray([new RoArray([new Int32(300), new Int32(300)])]));
            return list;
        }
        const capture = (list) => {
            const clips = [];
            const draw2D = new Proxy(
                {},
                { get: (_t, prop) => (prop === "pushClip" ? (rect) => clips.push({ ...rect }) : () => 0) }
            );
            list.renderNode({}, [0, 0], 0, 1, draw2D);
            return clips;
        };

        // 10 items of 300 (3000+) overflow the 1703 row → clipped to the list's bounds, widened by the
        // focus margin so the focused item's indicator (which outsets the poster) is not cut.
        const wide = makeList(10);
        const wideClips = capture(wide);
        expect(wideClips.length).toBeGreaterThan(0);
        expect(wideClips[0].x).toBe(100 - wide.marginX);
        expect(wideClips[0].width).toBe(1703 + wide.marginX * 2);

        // 3 items of 300 (900) fit within the 1703 row → no clip is pushed (optimization).
        expect(capture(makeList(3))).toEqual([]);
    });

    test("renders the 'N of M' row counter for the focused row without clobbering the row label", () => {
        const list = SGNodeFactory.createNode("RowList");
        const items = [];
        for (let i = 0; i < 15; i++) {
            items.push("A" + i);
        }
        // A titled row with BOTH a visible label and a counter: the counter must not overwrite the
        // label's cached text (regression: the left label rendered the counter's "N of M" string).
        const content = buildContent([items]);
        content.getNodeChildren()[0].setValue("title", new BrsString("My Row"));
        list.setValue("content", content);
        list.setValue("itemSize", new RoArray([new Int32(1280), new Int32(197)]));
        list.setValue("numRows", new Int32(1));
        list.setValue("rowFocusAnimationStyle", new BrsString("FixedFocusWrap"));
        list.setValue("rowItemSize", new RoArray([new RoArray([new Int32(375), new Int32(197)])]));
        list.setValue("showRowLabel", new RoArray([core.BrsBoolean.True]));
        list.setValue("showRowCounter", new RoArray([core.BrsBoolean.True]));

        // Record every string drawn to the screen (labels via drawText, counter drawn directly — both
        // funnel through draw2D.doDrawRotatedText).
        const drawn = [];
        const draw2D = new Proxy(
            {},
            {
                get: (_t, prop) => (prop === "doDrawRotatedText" ? (text) => drawn.push(text) : () => 0),
            }
        );

        const render = () => {
            drawn.length = 0;
            list.renderNode({}, [0, 0], 0, 1, draw2D);
        };

        // First render, then a SECOND render (the cache-collision bug only surfaced once isDirty cleared).
        render();
        render();
        expect(drawn).toContain("My Row"); // label survives...
        expect(drawn).toContain("1 of 15"); // ...alongside the counter.

        // After moving right, the counter reflects the new focused column (and the label is intact).
        list.handleKey("right", true);
        render();
        expect(drawn).toContain("My Row");
        expect(drawn).toContain("2 of 15");
        expect(drawn).not.toContain("1 of 15");

        // With showRowCounter empty (the default), no counter is drawn but the label remains.
        list.setValue("showRowCounter", new RoArray([]));
        render();
        expect(drawn).toContain("My Row");
        expect(drawn.some((t) => /of 15/.test(t))).toBe(false);
    });

    test("a row label updated after the first render is redrawn (not served stale from the cache)", () => {
        // Regression: the row label was drawn via the drawText line cache keyed by row index, which is
        // only refreshed when the RowList node itself is marked dirty. A title updated later on the
        // row's ContentNode (e.g. after a Task loads) did not dirty the RowList, so the label kept
        // rendering the stale cached text (or never appeared). The label is now drawn directly.
        const list = SGNodeFactory.createNode("RowList");
        const content = buildContent([["A", "B"]]);
        const rowNode = content.getNodeChildren()[0];
        rowNode.setValue("title", new BrsString("Old"));
        list.setValue("content", content);
        list.setValue("itemSize", new RoArray([new Int32(1280), new Int32(220)]));
        list.setValue("numRows", new Int32(1));
        list.setValue("rowItemSize", new RoArray([new RoArray([new Int32(375), new Int32(197)])]));
        list.setValue("showRowLabel", new RoArray([core.BrsBoolean.True]));

        const drawn = [];
        const draw2D = new Proxy(
            {},
            { get: (_t, prop) => (prop === "doDrawRotatedText" ? (text) => drawn.push(text) : () => 0) }
        );
        const render = () => {
            drawn.length = 0;
            list.renderNode({}, [0, 0], 0, 1, draw2D);
        };

        render();
        expect(drawn).toContain("Old");

        // Update the title on the row's ContentNode only (the RowList's own fields are untouched).
        rowNode.setValue("title", new BrsString("New"));
        render();
        expect(drawn).toContain("New");
        expect(drawn).not.toContain("Old");
    });

    test("showRowLabel scalar shorthand ('true') shows row labels (regression: Home screen titles)", () => {
        // Regression (jellyfin-roku Home): showRowLabel="true" is Roku shorthand for "all rows show
        // labels". The XML loader must parse the scalar to [true], not [] — an empty array reads as
        // unset (no labels), so the row titles never rendered.
        expect(
            getBrsValueFromFieldType("boolarray", "true")
                .getValue()
                .map((b) => b.toBoolean())
        ).toEqual([true]);
        expect(
            getBrsValueFromFieldType("boolarray", "false")
                .getValue()
                .map((b) => b.toBoolean())
        ).toEqual([false]);
        // An array literal is still parsed as-is, and an unset value stays empty (no labels).
        expect(
            getBrsValueFromFieldType("boolarray", "[false,true]")
                .getValue()
                .map((b) => b.toBoolean())
        ).toEqual([false, true]);
        expect(getBrsValueFromFieldType("boolarray", undefined).getValue()).toEqual([]);

        const list = SGNodeFactory.createNode("RowList");
        const content = buildContent([["A", "B"]]);
        content.getNodeChildren()[0].setValue("title", new BrsString("Continue Watching"));
        list.setValue("content", content);
        list.setValue("itemSize", new RoArray([new Int32(1280), new Int32(220)]));
        list.setValue("numRows", new Int32(1));
        list.setValue("rowItemSize", new RoArray([new RoArray([new Int32(375), new Int32(197)])]));
        // Apply showRowLabel exactly as the XML loader does for showRowLabel="true".
        list.setValue("showRowLabel", getBrsValueFromFieldType("boolarray", "true"));
        expect(list.getValueJS("showRowLabel")).toEqual([true]);

        const drawn = [];
        const draw2D = new Proxy(
            {},
            { get: (_t, prop) => (prop === "doDrawRotatedText" ? (text) => drawn.push(text) : () => 0) }
        );
        list.renderNode({}, [0, 0], 0, 1, draw2D);
        expect(drawn).toContain("Continue Watching");
    });

    test("item uses rowItemSize (not rowHeights) and sits below the counter band on a label-less row", () => {
        // Regression: the hero row of a RowList (showRowLabel=false, showRowCounter=true) rendered its
        // items at rowHeights (the ROW height) instead of rowItemSize (the poster height), and drew the
        // "N of M" counter on top of the items instead of in a band above them.
        const list = SGNodeFactory.createNode("RowList");
        list.setValue("content", buildContent([["A", "B", "C"]]));
        list.setValue("numRows", new Int32(1));
        // itemSize.y (220) and rowHeights (800) both differ from the poster height (700).
        list.setValue("itemSize", new RoArray([new Int32(1920), new Int32(220)]));
        list.setValue("rowHeights", new RoArray([new Int32(800)]));
        list.setValue("rowItemSize", new RoArray([new RoArray([new Int32(1600), new Int32(700)])]));
        list.setValue("rowLabelOffset", new RoArray([new RoArray([new Int32(165), new Int32(8)])]));
        list.setValue("showRowLabel", new RoArray([core.BrsBoolean.False]));
        list.setValue("showRowCounter", new RoArray([core.BrsBoolean.True]));

        const items = [];
        const original = list.createItemComponent.bind(list);
        list.createItemComponent = (interp, itemRect, content) => {
            const comp = original(interp, itemRect, content);
            const render = comp.renderNode.bind(comp);
            comp.renderNode = (i2, origin, angle, opacity, draw2D) => {
                items.push({
                    height: comp.getValueJS("height"),
                    width: comp.getValueJS("width"),
                    y: Math.round(origin[1]),
                });
                return render(i2, origin, angle, opacity, draw2D);
            };
            return comp;
        };
        list.renderNode({}, [0, 0], 0, 1);

        // The item takes the poster size, not the row height...
        expect(items[0].height).toBe(700);
        expect(items[0].width).toBe(1600);
        // ...and is pushed below the counter/label band (titleHeight + rowLabelOffset.y) even though
        // this row has no visible label, so the counter (drawn at the row top) does not overlap it.
        expect(items[0].y).toBe(Math.round(list.titleHeight + 8));
    });

    test("short rows (rowHeights fallback to itemSize.y) do not overlap — grid rows", () => {
        // Regression ("The Grid" section of hero-grid-channel): rows beyond the rowHeights array take
        // itemSize.y as their height. When that row is too short to fit the label band above the poster,
        // the row is grown by the band height so the pushed-down poster never spills into the next
        // (unlabeled) row, while the label stays at the row top with normal spacing above it.
        const list = SGNodeFactory.createNode("RowList");
        // Row 0 has a title (label shown), row 1 does not — mirroring the first "The Grid" row.
        const content = buildContent([
            ["A", "B"],
            ["C", "D"],
        ]);
        content.getNodeChildren()[0].setValue("title", new BrsString("The Grid"));
        list.setValue("content", content);
        list.setValue("numRows", new Int32(2));
        // itemSize.y (220) is the row-height fallback; no rowHeights set. Poster is 375x197.
        list.setValue("itemSize", new RoArray([new Int32(1920), new Int32(220)]));
        list.setValue("rowItemSize", new RoArray([new RoArray([new Int32(375), new Int32(197)])]));
        list.setValue("showRowLabel", new RoArray([core.BrsBoolean.True]));

        const rows = [];
        const original = list.createItemComponent.bind(list);
        list.createItemComponent = (interp, itemRect, content) => {
            const comp = original(interp, itemRect, content);
            const render = comp.renderNode.bind(comp);
            comp.renderNode = (i2, origin, angle, opacity, draw2D) => {
                rows.push({
                    title: content.getValueJS("title"),
                    y: Math.round(origin[1]),
                    h: comp.getValueJS("height"),
                });
                return render(i2, origin, angle, opacity, draw2D);
            };
            return comp;
        };
        list.renderNode({}, [0, 0], 0, 1);

        const row0 = rows.find((r) => r.title === "A");
        const row1 = rows.find((r) => r.title === "C");
        const band = Math.round(list.titleHeight); // rowLabelOffset.y defaults to 0
        // The band (titleHeight) is taller than the 23px slack above the poster, so the labeled row is
        // grown by the band: the poster is pushed down below the label...
        expect(row0.h).toBe(197);
        expect(list.titleHeight).toBeGreaterThan(220 - 197);
        expect(row0.y).toBe(band);
        // ...and the next row advances by the row height PLUS the band, clearing the first row's poster
        // and preserving the natural 23px gap (rowHeight 220 - poster 197) below it.
        expect(row1.y).toBe(220 + band);
        expect(row1.y - (row0.y + row0.h)).toBe(220 - 197);
    });
});
