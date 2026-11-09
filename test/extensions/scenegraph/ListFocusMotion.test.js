const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot, sgClock } = scenegraph;
const { BrsBoolean, BrsDevice, BrsString, Int32, RoArray, Float, RoMessagePort } = core;

/**
 * List focus motion, pinned to a device trace (Roku Express 4K+, OS 16.0,
 * test/simulator/probes/list-focus-motion-probe/device-trace-os16.0.txt).
 *
 * Per row the device eases `currFocusRow` with a ~200 ms cubic ease-out. `scrollingStatus`,
 * `itemUnfocused` and `vertFocusDirection` go out when the motion starts; `itemFocused` only when it
 * settles, followed by `scrollingStatus` false and `vertFocusDirection` "none". `focusPercent` splits
 * between the item being left and the next one. A press during a move queues one more row, a held key
 * scrolls on linearly after ~400 ms and settles on release, `animateToItem` takes ~200 ms per row, and
 * `jumpToItem` / `skipFocusAnimations` are instant.
 */
describe("List focus motion", () => {
    const fakeInterpreter = { environment: {}, inSubEnv: () => {} };
    let now;
    let log;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        now = 200_000;
        sgClock.setSource({ now: () => now, perfNow: () => now });
        sgRoot.uiTransitionsEnabled = true;
        log = [];
    });

    afterEach(() => {
        sgClock.setSource();
        sgRoot.uiTransitionsEnabled = false;
        sgRoot.setFocused();
    });

    function advance(ms, step = 16) {
        const end = now + ms;
        while (now < end) {
            now = Math.min(end, now + step);
            sgRoot.processTransitions();
        }
    }

    function observe(node, label, fields) {
        const port = new RoMessagePort();
        port.pushMessage = (event) => {
            const value = event.fieldValue?.getValue?.();
            log.push(`${label}.${event.fieldName.getValue()}=${value}`);
        };
        for (const field of fields) {
            node.addObserver(fakeInterpreter, "unscoped", new BrsString(field), port);
        }
    }

    const listFields = ["scrollingStatus", "itemUnfocused", "itemFocused", "vertFocusDirection"];
    const settledLog = () => log.filter((entry) => !entry.includes("currFocusRow"));

    function makeList(type, style) {
        const list = SGNodeFactory.createNode(type);
        list.setValue("itemSize", new RoArray([new Float(400), new Float(48)]));
        list.setValue("numRows", new Int32(4));
        if (style) {
            list.setValue("vertFocusAnimationStyle", new BrsString(style));
        }
        const root = SGNodeFactory.createNode("ContentNode");
        for (let i = 0; i < 10; i++) {
            const item = SGNodeFactory.createNode("ContentNode");
            item.setValue("title", new BrsString(`I${i}`));
            root.appendChildToParent(item);
        }
        list.setValue("content", root);
        list.setNodeFocus(true);
        // The handler's return publishes the new content's reset to item 0 (list-focus-dispatch-probe).
        list.flushContentFocus();
        return list;
    }

    /** Stand-ins for item components (a unit test cannot build XML ones), observed like the probe's. */
    function attachItems(list, count) {
        const items = [];
        for (let i = 0; i < count; i++) {
            const item = SGNodeFactory.createNode("Group");
            for (const [name, type] of [
                ["focusPercent", "float"],
                ["itemHasFocus", "boolean"],
                ["listHasFocus", "boolean"],
            ]) {
                item.addNodeField(name, type, false);
            }
            list.itemComps[i] = item;
            items.push(item);
        }
        items[0].setValue("focusPercent", new Float(1));
        return items;
    }

    const row = (list) => list.getValueJS("currFocusRow");
    const tap = (list, key) => {
        list.handleKey(key, true);
        list.handleKey(key, false);
    };

    test("a key press opens the motion, eases currFocusRow, and settles itemFocused last", () => {
        const list = makeList("LabelList", "floatingFocus");
        observe(list, "L", listFields);

        tap(list, "down");
        expect(log).toEqual(["L.scrollingStatus=true", "L.itemUnfocused=0", "L.vertFocusDirection=down"]);
        // The field still reports the old item until the motion settles.
        expect(list.getValueJS("itemFocused")).toBe(0);
        const start = now;
        // Device checkpoints: +49 ms 0.54, +99 ms 0.85.
        advance(start + 49 - now, 1);
        expect(Math.abs(row(list) - 0.54)).toBeLessThan(0.06);
        advance(start + 99 - now, 1);
        expect(Math.abs(row(list) - 0.85)).toBeLessThan(0.06);
        expect(list.getValueJS("scrollingStatus")).toBe(true);

        advance(start + 260 - now);
        expect(row(list)).toBe(1);
        expect(settledLog()).toEqual([
            "L.scrollingStatus=true",
            "L.itemUnfocused=0",
            "L.vertFocusDirection=down",
            "L.itemFocused=1",
            "L.scrollingStatus=false",
            "L.vertFocusDirection=none",
        ]);
    });

    test("focusPercent splits between the item being left and the next one", () => {
        const list = makeList("LabelList", "floatingFocus");
        const items = attachItems(list, 3);
        observe(items[1], "I1", ["itemHasFocus"]);
        tap(list, "down");
        expect(items[0].getValueJS("itemHasFocus")).toBe(false);

        advance(99, 1);
        const fraction = row(list);
        // Published to 3 decimals.
        expect(items[0].getValueJS("focusPercent")).toBeCloseTo(1 - fraction, 3);
        expect(items[1].getValueJS("focusPercent")).toBeCloseTo(fraction, 3);
        expect(items[2].getValueJS("focusPercent")).toBe(0);

        advance(200);
        expect(items[0].getValueJS("focusPercent")).toBe(0);
        expect(items[1].getValueJS("focusPercent")).toBe(1);
        expect(log).toEqual(["I1.itemHasFocus=true"]);
    });

    test("a press during the move queues one more row under the same pulse", () => {
        const list = makeList("LabelList", "floatingFocus");
        observe(list, "L", listFields);
        tap(list, "down");
        advance(150);
        tap(list, "down");
        advance(80);
        // The first row lands, then the queued one starts without settling in between.
        expect(row(list)).toBeGreaterThan(1);
        expect(row(list)).toBeLessThan(2);
        advance(400);
        expect(row(list)).toBe(2);
        expect(settledLog()).toEqual([
            "L.scrollingStatus=true",
            "L.itemUnfocused=0",
            "L.vertFocusDirection=down",
            "L.itemFocused=2",
            "L.scrollingStatus=false",
            "L.vertFocusDirection=none",
        ]);
    });

    test("animateToItem during a queued press drops the queued press", () => {
        const list = makeList("LabelList", "floatingFocus");
        observe(list, "L", ["itemFocused"]);
        tap(list, "down");
        advance(100);
        tap(list, "down");
        list.setValue("animateToItem", new Int32(8));
        let reached = false;
        for (let i = 0; i < 150; i++) {
            advance(16);
            if (row(list) === 8) {
                reached = true;
            } else if (reached) {
                throw new Error(`the focus left row 8 for ${row(list)}`);
            }
        }
        expect(row(list)).toBe(8);
        expect(log).toEqual(["L.itemFocused=8"]);
    });

    test("a held key stops repeating when the focus moves to another node", () => {
        const list = makeList("LabelList", "floatingFocus");
        list.handleKey("down", true);
        advance(100);
        const other = SGNodeFactory.createNode("Group");
        other.setNodeFocus(true);
        // The release goes to the newly focused node, never to the list.
        advance(2000);
        expect(row(list)).toBe(1);
        expect(list.getValueJS("scrollingStatus")).toBe(false);
        expect(sgRoot.processTransitions()).toBe(false);
    });

    test("a held key scrolls on after ~400 ms and settles only when released", () => {
        const list = makeList("LabelList", "floatingFocus");
        observe(list, "L", ["itemFocused"]);
        list.handleKey("down", true);
        advance(380);
        expect(row(list)).toBe(1);
        // Device: one row per ~200 ms once repeating (7.02 at +407 to 9 at +790).
        advance(820);
        expect(row(list)).toBeGreaterThan(4);
        expect(row(list)).toBeLessThan(6);
        expect(log).toEqual([]);
        list.handleKey("down", false);
        advance(300);
        expect(Number.isInteger(row(list))).toBe(true);
        expect(log).toEqual([`L.itemFocused=${row(list)}`]);
    });

    test("animateToItem eases the whole distance at ~200 ms per row", () => {
        const list = makeList("LabelList", "floatingFocus");
        observe(list, "L", ["itemFocused", "scrollingStatus"]);
        list.setValue("animateToItem", new Int32(6));
        expect(log).toEqual(["L.scrollingStatus=true"]);
        const start = now;
        // Device: currFocusRow 5 at +544 ms, settled at +1228 ms.
        advance(start + 544 - now, 1);
        expect(Math.abs(row(list) - 5)).toBeLessThan(0.15);
        advance(800);
        expect(log).toEqual(["L.scrollingStatus=true", "L.itemFocused=6", "L.scrollingStatus=false"]);
    });

    test("jumpToItem is instant and does not pulse scrollingStatus", () => {
        const list = makeList("LabelList", "floatingFocus");
        observe(list, "L", listFields);
        list.setValue("jumpToItem", new Int32(5));
        expect(row(list)).toBe(5);
        expect(log).toEqual(["L.itemUnfocused=0", "L.itemFocused=5"]);
    });

    test("skipFocusAnimations moves instantly with the motion's field order", () => {
        const list = makeList("LabelList", "floatingFocus");
        list.setValue("skipFocusAnimations", BrsBoolean.True);
        observe(list, "L", listFields);
        tap(list, "down");
        expect(row(list)).toBe(1);
        expect(log).toEqual([
            "L.scrollingStatus=true",
            "L.itemUnfocused=0",
            "L.vertFocusDirection=down",
            "L.itemFocused=1",
            "L.scrollingStatus=false",
            "L.vertFocusDirection=none",
        ]);
    });

    test("a wrapping list scrolls across the wrap point and currFocusRow wraps with it", () => {
        const list = makeList("MarkupList", "fixedFocusWrap");
        tap(list, "up");
        advance(60);
        // Device: 0 -> 9.96, 9.71, ... 9.
        expect(row(list)).toBeGreaterThan(9);
        expect(row(list)).toBeLessThan(10);
        advance(300);
        expect(row(list)).toBe(9);
        expect(list.getValueJS("itemFocused")).toBe(9);
    });

    test("a list left at its default (fixedFocusWrap) style keeps the indicator still and scrolls the items", () => {
        // Regression: the ArrayGrid constructor cached its own floatingFocus default before the list's
        // fixedFocusWrap default existed, so the motion took the floating branch — the indicator walked
        // further down on every press while the items were redrawn in place.
        for (const type of ["LabelList", "MarkupList", "CheckList", "RadioButtonList"]) {
            const list = makeList(type);
            const interpreter = new core.Interpreter();
            for (let press = 0; press < 3; press++) {
                tap(list, "down");
                advance(64);
                list.renderNode(interpreter, [0, 0], 0, 1);
                const frame = list.listMotionFrame(4);
                expect(frame.focusSlot).toBe(0);
                // The items are still on their way up into place.
                expect(frame.shift).toBeGreaterThan(0);
                expect(frame.shift).toBeLessThan(1);
                advance(300);
            }
            expect(list.getValueJS("itemFocused")).toBe(3);
        }
    });

    /**
     * markupgrid-focus-resize-probe's lists: rows alternating 40 and 120 tall, 20 px apart. A MarkupList's
     * item components are not built (a unit test has no XML component).
     */
    function makeSizedList(type, style) {
        const list = SGNodeFactory.createNode(type);
        list.setValue("itemSize", new RoArray([new Float(420), new Float(48)]));
        list.setValue("itemSpacing", new RoArray([new Float(0), new Float(20)]));
        list.setValue("numRows", new Int32(4));
        const heights = [];
        for (let r = 0; r < 8; r++) {
            heights.push(new Float(r % 2 ? 120 : 40));
        }
        list.setValue("rowHeights", new RoArray(heights));
        list.setValue("vertFocusAnimationStyle", new BrsString(style));
        if (type === "MarkupList") {
            list.setValue("itemComponentName", new BrsString("SizedRow"));
        }
        const root = SGNodeFactory.createNode("ContentNode");
        for (let i = 0; i < 8; i++) {
            const item = SGNodeFactory.createNode("ContentNode");
            item.setValue("title", new BrsString(`I${i}`));
            root.appendChildToParent(item);
        }
        list.setValue("content", root);
        list.setNodeFocus(true);
        // The handler's return publishes the new content's reset to item 0 (list-focus-dispatch-probe).
        list.flushContentFocus();
        return list;
    }

    /** Paints one pass and returns the in-transit indicator rect and each drawn row's y. */
    function paintSized(list) {
        sgRoot.nodeDefMap.set("sizedrow", {});
        const result = { rowY: new Map() };
        list.renderMotionFocus = (focusRect) => {
            result.focus = { ...focusRect };
        };
        if (list.constructor.name === "MarkupList") {
            list.renderItemComponent = (_interpreter, index, itemRect) => {
                result.rowY.set(index, itemRect.y);
            };
        } else {
            list.renderItem = (index, _item, itemRect) => {
                result.rowY.set(index, itemRect.y);
            };
        }
        try {
            list.renderNode(new core.Interpreter(), [0, 0], 0, 1, new Proxy({}, { get: () => () => undefined }));
        } finally {
            sgRoot.nodeDefMap.delete("sizedrow");
        }
        return result;
    }

    test.each(["LabelList", "MarkupList"])(
        "%s: the floating indicator grows and shrinks to the row it moves to (device screenshot)",
        (type) => {
            // markupgrid-focus-resize-probe: the highlight's top and height take the same fraction
            // between the two rows' rects.
            const list = makeSizedList(type, "floatingFocus");
            tap(list, "down");
            advance(48);
            const f = list.motionPos;
            expect(f).toBeGreaterThan(0.2);
            expect(f).toBeLessThan(0.9);
            let { focus } = paintSized(list);
            expect(focus.y).toBeCloseTo(60 * f, 5);
            expect(focus.height).toBeCloseTo(40 + 80 * f, 5);
            expect(focus.width).toBe(420);
            advance(300);
            tap(list, "down");
            advance(48);
            const g = list.motionPos - 1;
            ({ focus } = paintSized(list));
            expect(focus.y).toBeCloseTo(60 + 140 * g, 5);
            expect(focus.height).toBeCloseTo(120 - 80 * g, 5);
        }
    );

    test.each(["LabelList", "MarkupList"])(
        "%s: fixed-focus rows scroll by their own heights under a resizing indicator (device screenshot)",
        (type) => {
            // markupgrid-focus-resize-probe: from the 120 px row down to the 40 px row, the highlight
            // stays at the top and shrinks while the rows move up by the 140 px the tall row spans.
            const list = makeSizedList(type, "fixedFocusWrap");
            tap(list, "down");
            advance(300);
            tap(list, "down");
            advance(48);
            const f = list.motionPos - 1;
            expect(f).toBeGreaterThan(0.2);
            expect(f).toBeLessThan(0.9);
            const { focus, rowY } = paintSized(list);
            expect(focus.y).toBeCloseTo(0, 5);
            expect(focus.height).toBeCloseTo(120 - 80 * f, 5);
            expect(rowY.get(2)).toBeCloseTo(140 * (1 - f), 5);
            expect(rowY.get(3)).toBeCloseTo(140 * (1 - f) + 60, 5);
        }
    );

    test("a layout pass mid-motion keeps the settled bounding rect and does not advance the motion", () => {
        const list = makeList("LabelList", "fixedFocusWrap");
        const interpreter = new core.Interpreter();
        list.renderNode(interpreter, [0, 0], 0, 1);
        const settled = list.getValueJS("translation");
        const rectBefore = list.getBoundingRect?.() ?? null;
        tap(list, "down");
        advance(64);
        const midRow = row(list);
        list.renderNode(interpreter, [0, 0], 0, 1);
        expect(row(list)).toBe(midRow);
        expect(list.getValueJS("translation")).toEqual(settled);
        if (rectBefore) {
            expect(list.getBoundingRect()).toEqual(rectBefore);
        }
    });

    test("with transitions off a key moves instantly in the same device order", () => {
        sgRoot.uiTransitionsEnabled = false;
        const list = makeList("LabelList", "floatingFocus");
        observe(list, "L", ["scrollingStatus", "itemUnfocused", "itemFocused"]);
        tap(list, "down");
        expect(log).toEqual([
            "L.scrollingStatus=true",
            "L.itemUnfocused=0",
            "L.itemFocused=1",
            "L.scrollingStatus=false",
        ]);
    });

    test("a motion started by a settle observer runs to its own settle", () => {
        const list = makeList("LabelList", "floatingFocus");
        const port = new RoMessagePort();
        port.pushMessage = (event) => {
            const field = event.fieldName.getValue();
            const value = event.fieldValue?.getValue?.();
            log.push(`L.${field}=${value}`);
            if (field === "itemFocused" && value === 1) {
                // An app skipping past an item from its itemFocused observer.
                list.setValue("animateToItem", new Int32(3));
            }
        };
        for (const field of ["itemFocused", "scrollingStatus"]) {
            list.addObserver(fakeInterpreter, "unscoped", new BrsString(field), port);
        }
        tap(list, "down");
        advance(1000);
        expect(list.getValueJS("itemFocused")).toBe(3);
        expect(row(list)).toBe(3);
        expect(list.getValueJS("scrollingStatus")).toBe(false);
        // The second motion opens after the first one's settle is complete.
        expect(log).toEqual([
            "L.scrollingStatus=true",
            "L.itemFocused=1",
            "L.scrollingStatus=false",
            "L.scrollingStatus=true",
            "L.itemFocused=3",
            "L.scrollingStatus=false",
        ]);
        expect(sgRoot.processTransitions()).toBe(false);
    });

    // Device (focus-motion-edge-probe, OS 16.0): focus taken mid-motion lets the motion finish with only
    // scrollingStatus false; `itemFocused` keeps the item left until the focus returns to the list.
    test("a motion settling outside the focus chain leaves itemFocused until the focus returns", () => {
        const list = makeList("LabelList", "floatingFocus");
        const items = attachItems(list, 3);
        observe(list, "L", ["itemFocused", "scrollingStatus"]);
        observe(items[1], "I1", ["itemHasFocus"]);
        tap(list, "down");
        advance(50);
        SGNodeFactory.createNode("Group").setNodeFocus(true);
        advance(500);
        expect(row(list)).toBe(1);
        expect(list.getValueJS("itemFocused")).toBe(0);
        expect(log).toEqual(["L.scrollingStatus=true", "L.scrollingStatus=false"]);
        log.length = 0;
        list.setNodeFocus(true);
        expect(log).toContain("I1.itemHasFocus=true");
        expect(log.at(-1)).toBe("L.itemFocused=1");
        expect(list.getValueJS("itemFocused")).toBe(1);
    });

    test("focus regained mid-motion publishes the target now and again when the motion settles", () => {
        const list = makeList("LabelList", "floatingFocus");
        const items = attachItems(list, 3);
        observe(list, "L", ["itemFocused", "scrollingStatus"]);
        observe(items[1], "I1", ["itemHasFocus"]);
        tap(list, "down");
        advance(50);
        SGNodeFactory.createNode("Group").setNodeFocus(true);
        list.setNodeFocus(true);
        expect(log).toEqual(["L.scrollingStatus=true", "I1.itemHasFocus=true", "L.itemFocused=1"]);
        expect(list.getValueJS("scrollingStatus")).toBe(true);
        // The motion runs on: the target item keeps its focus through the rest of it.
        list.updateItemFocus(1, true, true);
        expect(items[1].getValueJS("itemHasFocus")).toBe(true);
        advance(500);
        expect(row(list)).toBe(1);
        expect(log.slice(3)).toEqual(["L.itemFocused=1", "L.scrollingStatus=false"]);
    });

    test.each([
        ["another node takes the focus", (list) => SGNodeFactory.createNode("Group").setNodeFocus(true)],
        ["the list calls setFocus(false)", (list) => list.setNodeFocus(false)],
    ])("a hidden list drops its item's itemHasFocus at once when %s", (_name, unfocus) => {
        const list = makeList("LabelList", "floatingFocus");
        const items = attachItems(list, 3);
        list.updateItemFocus(0, true, true);
        expect(items[0].getValueJS("itemHasFocus")).toBe(true);
        list.setValue("visible", BrsBoolean.False);
        unfocus(list);
        expect(items[0].getValueJS("itemHasFocus")).toBe(false);
    });

    test("a key held at the end of a list stops redrawing until it is released", () => {
        const list = makeList("LabelList", "floatingFocus");
        list.setValue("jumpToItem", new Int32(8));
        observe(list, "L", ["itemFocused"]);
        list.handleKey("down", true);
        advance(1000);
        expect(row(list)).toBe(9);
        // Still held at the last item: nothing moves, so the pass asks for no frame.
        expect(sgRoot.processTransitions()).toBe(false);
        expect(log).toEqual([]);
        list.handleKey("down", false);
        expect(sgRoot.processTransitions()).toBe(true);
        expect(log).toEqual(["L.itemFocused=9"]);
        expect(sgRoot.processTransitions()).toBe(false);
    });
});
