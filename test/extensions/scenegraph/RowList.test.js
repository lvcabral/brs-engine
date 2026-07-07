const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
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
});
