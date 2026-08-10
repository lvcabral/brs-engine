const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot, sgClock } = scenegraph;
const { BrsDevice, BrsBoolean, BrsString, Int32, RoArray, RoMessagePort } = core;

/** Builds a root → rows → items ContentNode tree; `rows` is an array of arrays of item titles. */
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

/**
 * `animateToItem` is an ANIMATED focus scroll on a real device, not an instant move. Measured on a
 * Roku Streaming Stick+ (OS 15.3) with `test/simulator/probes/grid-scroll-animation-probe`:
 *
 *   - The duration scales with the distance travelled: 364 ms for 1 row, 686 ms for 2, 1021 ms for 3
 *     (~340 ms per row), following an ease-in-out curve.
 *   - `scrollingStatus = true` and `itemUnfocused` are emitted at animation START, before the app's
 *     assignment even returns — NOT as part of the settle, which is where key navigation emits them.
 *   - `currFocusRow` then carries fractional in-transit values every frame.
 *   - The settled fields (`itemFocused`, `rowItemFocused`) are emitted only at COMPLETION.
 *   - `jumpToItem` does not animate at all (probe A2).
 *
 * This matters behaviorally, not just visually: an app whose key handler hands focus to a list and
 * THEN writes `animateToItem` (a necessary order — the list's container may jumpToItem on focus
 * change) depends on the move outliving the handler. With an instant move the settle lands inside the
 * handler and drives app logic off a position the user already navigated away from.
 *
 * Time is driven through the injectable `sgClock` so these are deterministic rather than wall-clock
 * dependent (see SGClock.ts).
 */
describe("ArrayGrid animateToItem animates the focus scroll", () => {
    let fakeNow = 0;

    beforeAll(() => {
        // List/grid nodes have font-typed defaults; mount the common: volume once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        fakeNow = 1000;
        sgClock.setSource({ now: () => fakeNow, perfNow: () => fakeNow });
    });

    afterEach(() => {
        sgClock.setSource();
        sgRoot.setFocused();
        sgRoot.scrollAnimations.length = 0;
    });

    const fakeInterpreter = { environment: {}, inSubEnv: () => {} };

    /**
     * Observes `fields` through one shared port and returns the merged notification log as
     * `"field=value"` entries, so both the values AND their relative order are pinned.
     */
    function observe(node, fields) {
        const log = [];
        const port = new RoMessagePort();
        const originalPush = port.pushMessage.bind(port);
        port.pushMessage = (event) => {
            const name = event.fieldName ? event.fieldName.getValue() : "";
            const value = event.fieldValue?.getValue?.();
            log.push(`${name}=${Array.isArray(value) ? "[...]" : value}`);
            originalPush(event);
        };
        for (const field of fields) {
            node.addObserver(fakeInterpreter, "unscoped", new BrsString(field), port);
        }
        return log;
    }

    /** A focused RowList of `rows` single-item rows. */
    function makeList(rows = 6) {
        const list = SGNodeFactory.createNode("RowList");
        const content = [];
        for (let i = 0; i < rows; i++) {
            content.push(["R" + i]);
        }
        list.setValue("content", buildContent(content));
        list.setNodeFocus(true);
        return list;
    }

    /** Advances the fake clock by `ms` and ticks the render loop's scroll pass once. */
    function advance(ms) {
        fakeNow += ms;
        return sgRoot.processScrollAnimations();
    }

    test("emits scrollingStatus and itemUnfocused up front, then ramps, then settles", () => {
        const list = makeList();
        const log = observe(list, [
            "scrollingStatus",
            "itemUnfocused",
            "itemFocused",
            "currFocusRow",
            "rowItemFocused",
        ]);

        list.setValue("animateToItem", new Int32(3));

        // Start-of-scroll emissions land synchronously, inside the assignment above — matching the
        // device, where they precede the `after-write` trace record.
        expect(log).toEqual(["scrollingStatus=true", "itemUnfocused=0"]);
        // Nothing has settled yet: the focused row is still the one we started on.
        expect(list.getValueJS("itemFocused")).toBe(0);

        // Mid-flight: currFocusRow carries a FRACTIONAL value and no settle has been published.
        log.length = 0;
        expect(advance(500)).toBe(true);
        const midRow = list.getValueJS("currFocusRow");
        expect(midRow).toBeGreaterThan(0);
        expect(midRow).toBeLessThan(3);
        expect(Number.isInteger(midRow)).toBe(false);
        expect(log.some((e) => e.startsWith("currFocusRow="))).toBe(true);
        expect(log.some((e) => e.startsWith("itemFocused="))).toBe(false);
        expect(log.some((e) => e.startsWith("rowItemFocused="))).toBe(false);

        // Past the full duration (3 rows × ~340 ms) the scroll completes and settles.
        log.length = 0;
        expect(advance(1100)).toBe(true);
        expect(list.getValueJS("itemFocused")).toBe(3);
        expect(list.getValueJS("currFocusRow")).toBe(3);
        expect(list.getValueJS("scrollingStatus")).toBe(false);
        expect(log).toContain("itemFocused=3");
        expect(log).toContain("rowItemFocused=[...]");
        expect(log).toContain("scrollingStatus=false");
        // itemUnfocused is emitted ONCE per scroll (at the start), not again at the settle.
        expect(log.some((e) => e.startsWith("itemUnfocused="))).toBe(false);
        // And the animation deregisters itself.
        expect(sgRoot.scrollAnimations).toHaveLength(0);
    });

    test("scales the duration with the distance travelled (~340 ms per row)", () => {
        for (const [rows, expected] of [
            [1, 340],
            [3, 1020],
        ]) {
            const list = makeList();
            list.setValue("animateToItem", new Int32(rows));

            // Just before the expected end, the scroll is still running and unsettled.
            advance(expected - 20);
            expect(list.getValueJS("itemFocused")).toBe(0);
            // Just after, it has settled.
            advance(40);
            expect(list.getValueJS("itemFocused")).toBe(rows);
        }
    });

    test("jumpToItem does not animate — it settles immediately", () => {
        const list = makeList();
        const log = observe(list, ["scrollingStatus", "itemFocused", "currFocusRow", "rowItemFocused"]);

        list.setValue("jumpToItem", new Int32(4));

        expect(list.getValueJS("itemFocused")).toBe(4);
        expect(list.getValueJS("currFocusRow")).toBe(4);
        // No pulse at all for an immediate move (device A2 emitted no scrollingStatus).
        expect(log.some((e) => e.startsWith("scrollingStatus="))).toBe(false);
        expect(sgRoot.scrollAnimations).toHaveLength(0);
    });

    test("jumpToRowItem cancels an in-flight scroll and closes the pulse", () => {
        const list = makeList();
        list.setValue("animateToItem", new Int32(5));
        advance(200);
        expect(sgRoot.scrollAnimations).toHaveLength(1);

        list.setValue("jumpToRowItem", new RoArray([new Int32(1), new Int32(0)]));

        expect(sgRoot.scrollAnimations).toHaveLength(0);
        expect(list.getValueJS("itemFocused")).toBe(1);
        // The pulse opened by the animation must be closed, or the field is stranded at true — which
        // would silently suppress every later notification (it is not alwaysNotify).
        expect(list.getValueJS("scrollingStatus")).toBe(false);
    });

    test("a mid-flight write retargets from the current position without restarting", () => {
        const list = makeList();
        const log = observe(list, ["scrollingStatus", "itemUnfocused"]);

        list.setValue("animateToItem", new Int32(5));
        advance(400);
        const midRow = list.getValueJS("currFocusRow");
        expect(midRow).toBeGreaterThan(0);

        log.length = 0;
        list.setValue("animateToItem", new Int32(2));

        // A retarget is one continuous scroll: no second rising edge and no second itemUnfocused
        // (device A3 emitted neither, and the ramp resumed from the current fractional position).
        expect(log).toEqual([]);
        expect(sgRoot.scrollAnimations).toHaveLength(1);
        // It continues forward from where it was rather than snapping back to the start.
        expect(advance(20)).toBe(true);
        expect(list.getValueJS("currFocusRow")).toBeGreaterThan(midRow);

        advance(1200);
        expect(list.getValueJS("itemFocused")).toBe(2);
    });

    test("an unfocused list still animates but publishes no settled focus fields", () => {
        const list = SGNodeFactory.createNode("RowList");
        list.setValue("content", buildContent([["A"], ["B"], ["C"], ["D"]]));
        // Deliberately never focused.
        const log = observe(list, ["scrollingStatus", "itemFocused", "currFocusRow", "rowItemFocused"]);

        list.setValue("animateToItem", new Int32(2));
        advance(300);

        // The ramp and the pulse are NOT focus-gated on a device (probe A6).
        expect(log).toContain("scrollingStatus=true");
        expect(log.some((e) => e.startsWith("currFocusRow="))).toBe(true);

        log.length = 0;
        advance(600);
        // ...but the settle fields are: an unfocused list fires neither, matching the documented rule
        // that itemFocused only changes when focus moves onto an item.
        expect(log.some((e) => e.startsWith("itemFocused="))).toBe(false);
        expect(log.some((e) => e.startsWith("rowItemFocused="))).toBe(false);
        expect(log).toContain("scrollingStatus=false");
    });

    test("key navigation stays instant (its emission order is pinned elsewhere)", () => {
        // MarkupGrid.handleUpDown writes animateToItem as its internal move shortcut. A device
        // animates key navigation too, but changing that here would rewrite the key-driven emission
        // order that ArrayGridFields.test.js and several CLI fixtures pin, so it is scoped out.
        const grid = SGNodeFactory.createNode("MarkupGrid");
        grid.setValue("numColumns", new Int32(2));
        grid.setValue("content", buildContent([["A", "B", "C", "D"]]).getNodeChildren()[0]);
        grid.setNodeFocus(true);

        expect(grid.handleKey("right", true)).toBe(true);

        // Settled synchronously, with no animation left in flight.
        expect(grid.getValueJS("itemFocused")).toBe(1);
        expect(sgRoot.scrollAnimations).toHaveLength(0);
        expect(grid.getValueJS("scrollingStatus")).toBe(false);
    });

    test("skipFocusAnimations is readable and defaults to false", () => {
        // Documented on ArrayGrid but previously undeclared, so reading it returned `invalid` and
        // crashed a strongly-typed BrightScript helper. Device-measured that setting it does NOT
        // suppress the scroll (probe A7), so it is declared for compatibility only.
        const list = makeList();
        expect(list.getValueJS("skipFocusAnimations")).toBe(false);

        list.setValue("skipFocusAnimations", BrsBoolean.True);
        expect(list.getValueJS("skipFocusAnimations")).toBe(true);

        // Still animates, matching hardware.
        list.setValue("animateToItem", new Int32(2));
        expect(sgRoot.scrollAnimations).toHaveLength(1);
        expect(list.getValueJS("itemFocused")).toBe(0);
    });
    test("interleaves the falling edge between itemFocused and rowItemFocused", () => {
        // Device-measured (grid-scroll-animation-probe A1 records 067/068/069): the completing scroll
        // emits itemFocused, THEN scrollingStatus=false, THEN rowItemFocused last.
        //
        // The order is load-bearing. An app tears transient scroll state down on the rising edge and
        // REBUILDS its focused-item overlay on the falling edge, reading the settled focus position
        // there, while treating the rowItemFocused observer as the authoritative settle that
        // re-derives its own state. Emitting the edge after rowItemFocused inverts that: the rebuild
        // runs first and the settle handler overwrites it, so the overlay stays hidden until some
        // later navigation re-triggers it.
        const list = makeList();
        const log = observe(list, ["scrollingStatus", "itemFocused", "rowItemFocused"]);

        list.setValue("animateToItem", new Int32(2));
        advance(1000);

        const rising = log.indexOf("scrollingStatus=true");
        const focused = log.indexOf("itemFocused=2");
        const falling = log.indexOf("scrollingStatus=false");
        const settled = log.lastIndexOf("rowItemFocused=[...]");

        expect(rising).toBe(0);
        expect(focused).toBeGreaterThan(rising);
        expect(falling).toBeGreaterThan(focused);
        // rowItemFocused settles LAST, after the falling edge.
        expect(settled).toBeGreaterThan(falling);
    });

    test("closes the pulse even when the settle publishes nothing", () => {
        // Backstop: an unfocused list publishes no settled focus fields, so the interleave point is
        // never reached. scrollingStatus must still fall, or it is stranded at true — and because it is
        // not alwaysNotify, a stranded true silently suppresses every later notification.
        const list = SGNodeFactory.createNode("RowList");
        list.setValue("content", buildContent([["A"], ["B"], ["C"]]));

        list.setValue("animateToItem", new Int32(2));
        expect(list.getValueJS("scrollingStatus")).toBe(true);

        advance(1000);
        expect(list.getValueJS("scrollingStatus")).toBe(false);
        expect(sgRoot.scrollAnimations).toHaveLength(0);
    });
    test("visibly slides the drawn rows, not just the observable fields", () => {
        // The point of the animation is that PIXELS move. The render path lays rows out from an integer
        // anchor row plus a per-row Y advance, so publishing fractional currFocusRow alone would leave
        // the layout frozen until the settle snapped it — the fields would ramp while the screen jumped.
        // scrollRowOffset/scrollAnchorRow split the animated position into "which row is on top" and
        // "how far past it", and RowList.renderContent shifts the layout by the remainder.
        const list = SGNodeFactory.createNode("RowList");

        // Record the y-origin each row's item component is drawn at. Installed before focusing, because
        // item components are cached across renders and focusing builds the focused row's component.
        const drawn = {};
        const original = list.createItemComponent.bind(list);
        list.createItemComponent = (interp, itemRect, content) => {
            const comp = original(interp, itemRect, content);
            const render = comp.renderNode.bind(comp);
            comp.renderNode = (i2, origin, angle, opacity, draw2D) => {
                drawn[content.getValueJS("title")] = Math.round(origin[1]);
                return render(i2, origin, angle, opacity, draw2D);
            };
            return comp;
        };
        const rows = [];
        for (let i = 0; i < 6; i++) {
            rows.push(["R" + i]);
        }
        list.setValue("content", buildContent(rows));
        list.setValue("itemSize", new RoArray([new Int32(1280), new Int32(100)]));
        list.setValue("rowItemSize", new RoArray([new RoArray([new Int32(300), new Int32(100)])]));
        list.setValue("itemSpacing", new RoArray([new Int32(0), new Int32(20)]));
        list.setValue("numRows", new Int32(3));
        list.setNodeFocus(true);

        const renderRows = () => {
            for (const key of Object.keys(drawn)) {
                delete drawn[key];
            }
            list.renderNode({}, [0, 0], 0, 1);
            return { ...drawn };
        };

        // Settled: rows sit on the 120px pitch (100 height + 20 spacing).
        expect(renderRows()).toEqual({ R0: 0, R1: 120, R2: 240 });

        list.setValue("animateToItem", new Int32(2));

        // Mid-flight: the whole layout has shifted UP by a sub-row amount — not a whole row, and not
        // zero. An extra row is drawn to fill the gap the shift opens at the bottom.
        advance(100);
        const early = renderRows();
        expect(early.R0).toBeLessThan(0);
        expect(early.R0).toBeGreaterThan(-120);
        expect(early.R3).toBeDefined();

        // Later in the flight it has slid further, still smoothly rather than snapping.
        advance(200);
        const later = renderRows();
        expect(later.R0).toBeLessThan(early.R0);

        // Settled at the target: row 2 is at the top, back on the exact pitch.
        advance(1000);
        expect(renderRows()).toEqual({ R2: 0, R3: 120, R4: 240 });
    });
    test("scales the duration by ROWS traversed on a multi-column grid, not flat index delta", () => {
        // scrollMsPerItem is per ROW (device-measured). A flat index delta charges numCols x too much:
        // on a 6-column grid one row down is a delta of 6, which made a ~340 ms move take ~2 s.
        const grid = SGNodeFactory.createNode("MarkupGrid");
        grid.setValue("numColumns", new Int32(6));
        const items = [];
        for (let i = 0; i < 24; i++) {
            items.push("I" + i);
        }
        grid.setValue("content", buildContent([items]).getNodeChildren()[0]);
        grid.setNodeFocus(true);

        grid.setValue("animateToItem", new Int32(6)); // exactly one row down

        // Still running just under one row's worth of time, settled just after.
        advance(300);
        expect(sgRoot.scrollAnimations).toHaveLength(1);
        advance(80);
        expect(sgRoot.scrollAnimations).toHaveLength(0);
        expect(grid.getValueJS("itemFocused")).toBe(6);
    });

    test("does not ramp currFocusColumn when the scroll does not cross columns", () => {
        // Mapping a flat index onto both axes emitted nonsense: on a single-column list `position % 1` is
        // the ROW fraction, so currFocusColumn oscillated (0.14, 0.50, 0.02, ...) on a field whose only
        // valid value is 0. A device emits no column ramp for a vertical scroll.
        const list = SGNodeFactory.createNode("LabelList");
        const items = [];
        for (let i = 0; i < 8; i++) {
            items.push("I" + i);
        }
        list.setValue("content", buildContent([items]).getNodeChildren()[0]);
        list.setNodeFocus(true);
        const log = observe(list, ["currFocusColumn"]);

        list.setValue("animateToItem", new Int32(4));
        for (let i = 0; i < 8; i++) {
            advance(150);
        }

        expect(log).toEqual([]);
        expect(list.getValueJS("currFocusColumn")).toBe(0);
    });

    test("a key press cancels an in-flight app scroll and emits a clean pulse", () => {
        // Without cancelling, the abandoned animation kept ticking against the old target and the pulse
        // came out garbled: the key's rising edge was a no-op (the animation had already set the field
        // true), its falling edge fired mid-scroll, and the settle's own edge then wrote an already-false
        // value and notified nobody — so an app rebuilding on the falling edge saw a teardown with no
        // rebuild.
        const list = makeList(10);
        list.setValue("animateToItem", new Int32(8));
        advance(400);
        expect(sgRoot.scrollAnimations).toHaveLength(1);

        const log = observe(list, ["scrollingStatus", "itemFocused"]);
        expect(list.handleKey("down", true)).toBe(true);

        // The abandoned scroll closes, then the key press opens and closes its own pulse, then settles.
        expect(log).toEqual([
            "scrollingStatus=false",
            "scrollingStatus=true",
            "scrollingStatus=false",
            "itemFocused=1",
        ]);
        expect(sgRoot.scrollAnimations).toHaveLength(0);

        // And the abandoned target never reasserts itself.
        advance(3000);
        expect(list.getValueJS("itemFocused")).toBe(1);
    });

    test("reports the settled extent from boundingRect while scrolling", () => {
        // The extra row and the sub-row shift both inflate the laid-out extent, so an app sizing a
        // background or overlay from boundingRect() would watch it grow a full row and shrink again every
        // frame of the scroll.
        const list = SGNodeFactory.createNode("RowList");
        const rows = [];
        for (let i = 0; i < 6; i++) {
            rows.push(["R" + i]);
        }
        list.setValue("content", buildContent(rows));
        list.setValue("itemSize", new RoArray([new Int32(1280), new Int32(100)]));
        list.setValue("rowItemSize", new RoArray([new RoArray([new Int32(300), new Int32(100)])]));
        list.setValue("itemSpacing", new RoArray([new Int32(0), new Int32(20)]));
        list.setValue("numRows", new Int32(3));
        list.setNodeFocus(true);

        list.renderNode({}, [0, 0], 0, 1);
        const settled = list.rectLocal.height;

        list.setValue("animateToItem", new Int32(3));
        for (const dt of [100, 300]) {
            advance(dt);
            list.renderNode({}, [0, 0], 0, 1);
            // Within a few px of the settled extent, not a full row (120px) larger.
            expect(Math.abs(list.rectLocal.height - settled)).toBeLessThan(15);
        }

        advance(1000);
        list.renderNode({}, [0, 0], 0, 1);
        expect(list.rectLocal.height).toBe(settled);
    });
});
