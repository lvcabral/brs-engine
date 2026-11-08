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
        expect(items[0].getValueJS("focusPercent")).toBeCloseTo(1 - fraction, 5);
        expect(items[1].getValueJS("focusPercent")).toBeCloseTo(fraction, 5);
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
});
