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
});
