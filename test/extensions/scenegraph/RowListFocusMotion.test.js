const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot, sgClock } = scenegraph;
const { BrsDevice, BrsString, Int32, Float, RoArray, RoMessagePort } = core;

/**
 * RowList focus motion, pinned to a device trace (Roku Express 4K+, OS 16.0,
 * test/simulator/probes/rowlist-focus-motion-probe/device-trace-os16.0.txt).
 *
 * Steps are ~330 ms cubic ease-outs on both axes. A row change opens with scrollingStatus, itemUnfocused
 * and vertFocusDirection and settles itemFocused, the rowHasFocus swap, scrollingStatus=false, then
 * rowItemFocused; a move along a row settles rowItemFocused BEFORE scrollingStatus falls and reports no
 * direction. rowFocusPercent follows the row fraction. An app's jumpToRowItem publishes no
 * itemFocused/itemUnfocused.
 */
describe("RowList focus motion", () => {
    const fakeInterpreter = { environment: {}, inSubEnv: () => {} };
    let now;
    let log;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        now = 400_000;
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

    function observe(node, fields, label = "") {
        const port = new RoMessagePort();
        port.pushMessage = (event) => {
            const value = event.fieldValue?.getValue?.();
            log.push(`${label}${event.fieldName.getValue()}=${Array.isArray(value) ? "[...]" : value}`);
        };
        for (const field of fields) {
            node.addObserver(fakeInterpreter, "unscoped", new BrsString(field), port);
        }
    }

    const fields = [
        "scrollingStatus",
        "itemUnfocused",
        "itemFocused",
        "rowItemFocused",
        "vertFocusDirection",
        "horizFocusDirection",
    ];

    /** 4 rows of 8 items. */
    function makeList() {
        const list = SGNodeFactory.createNode("RowList");
        list.setValue("itemSize", new RoArray([new Float(1120), new Float(120)]));
        list.setValue("numRows", new Int32(2));
        const root = SGNodeFactory.createNode("ContentNode");
        for (let r = 0; r < 4; r++) {
            const row = SGNodeFactory.createNode("ContentNode");
            for (let c = 0; c < 8; c++) {
                row.appendChildToParent(SGNodeFactory.createNode("ContentNode"));
            }
            root.appendChildToParent(row);
        }
        list.setValue("content", root);
        list.setNodeFocus(true);
        return list;
    }

    /** Stand-in item components (a unit test cannot build XML ones). */
    function attachItems(list, rows, cols) {
        const items = [];
        for (let r = 0; r < rows; r++) {
            list.rowItemComps[r] = [];
            items[r] = [];
            for (let c = 0; c < cols; c++) {
                const item = SGNodeFactory.createNode("Group");
                for (const [name, type] of [
                    ["focusPercent", "float"],
                    ["rowFocusPercent", "float"],
                    ["itemHasFocus", "boolean"],
                    ["rowHasFocus", "boolean"],
                ]) {
                    item.addNodeField(name, type, false);
                }
                list.rowItemComps[r][c] = item;
                items[r][c] = item;
            }
        }
        items[0][0].setValue("focusPercent", new Float(1));
        items[0][0].setValue("rowFocusPercent", new Float(1));
        return items;
    }

    const tap = (list, key) => {
        list.handleKey(key, true);
        list.handleKey(key, false);
    };

    test("a row change eases ~330 ms and settles in the device order", () => {
        const list = makeList();
        observe(list, fields);
        tap(list, "down");
        expect(log).toEqual(["scrollingStatus=true", "itemUnfocused=0", "vertFocusDirection=down"]);
        const start = now;
        // Device checkpoints: +97 ms 0.64, +181 ms 0.9.
        advance(start + 97 - now, 1);
        expect(Math.abs(list.getValueJS("currFocusRow") - 0.64)).toBeLessThan(0.05);
        advance(start + 181 - now, 1);
        expect(Math.abs(list.getValueJS("currFocusRow") - 0.9)).toBeLessThan(0.03);
        advance(start + 380 - now);
        expect(list.getValueJS("currFocusRow")).toBe(1);
        expect(log).toEqual([
            "scrollingStatus=true",
            "itemUnfocused=0",
            "vertFocusDirection=down",
            "itemFocused=1",
            "scrollingStatus=false",
            "rowItemFocused=[...]",
            "vertFocusDirection=none",
        ]);
    });

    test("a move along a row settles rowItemFocused before scrollingStatus falls, with no direction", () => {
        const list = makeList();
        observe(list, fields);
        tap(list, "right");
        expect(log).toEqual(["scrollingStatus=true"]);
        advance(97, 1);
        expect(Math.abs(list.getValueJS("currFocusColumn") - 0.64)).toBeLessThan(0.05);
        advance(300);
        expect(list.getValueJS("rowItemFocused")).toEqual([0, 1]);
        expect(log).toEqual(["scrollingStatus=true", "rowItemFocused=[...]", "scrollingStatus=false"]);
    });

    test("rowFocusPercent follows the row fraction and rowHasFocus swaps only at the settle", () => {
        const list = makeList();
        const items = attachItems(list, 2, 2);
        items[0][0].setValue("rowHasFocus", core.BrsBoolean.True);
        tap(list, "down");
        advance(97, 1);
        const fraction = list.getValueJS("currFocusRow");
        expect(items[0][0].getValueJS("rowFocusPercent")).toBeCloseTo(1 - fraction, 2);
        expect(items[1][0].getValueJS("rowFocusPercent")).toBeCloseTo(fraction, 2);
        expect(items[1][0].getValueJS("focusPercent")).toBeCloseTo(fraction, 2);
        expect(items[1][0].getValueJS("rowHasFocus")).toBe(false);
        expect(items[0][0].getValueJS("itemHasFocus")).toBe(false);
        advance(300);
        expect(items[1][0].getValueJS("rowFocusPercent")).toBe(1);
        expect(items[0][0].getValueJS("rowFocusPercent")).toBe(0);
        expect(items[1][0].getValueJS("rowHasFocus")).toBe(true);
        expect(items[0][0].getValueJS("rowHasFocus")).toBe(false);
        expect(items[1][0].getValueJS("itemHasFocus")).toBe(true);
    });

    test("an app's jumpToRowItem moves at once without itemFocused, itemUnfocused or scrollingStatus", () => {
        const list = makeList();
        observe(list, fields);
        list.setValue("jumpToRowItem", new RoArray([new Int32(2), new Int32(3)]));
        expect(list.getValueJS("rowItemFocused")).toEqual([2, 3]);
        expect(list.getValueJS("itemFocused")).toBe(0);
        expect(log).toEqual(["rowItemFocused=[...]"]);
    });

    test("a held key publishes an interim rowItemFocused while it pauses before repeating", () => {
        const list = makeList();
        observe(list, ["rowItemFocused", "itemFocused"]);
        list.handleKey("down", true);
        advance(450);
        // Paused on row 1, still held: the interim settle went out, itemFocused did not.
        expect(log).toEqual(["rowItemFocused=[...]"]);
        expect(list.getValueJS("rowItemFocused")).toEqual([1, 0]);
        advance(500);
        expect(list.getValueJS("currFocusRow")).toBeGreaterThan(1);
        list.handleKey("down", false);
        advance(500);
        expect(log.at(-2)).toMatch(/^itemFocused=/);
        expect(log.at(-1)).toBe("rowItemFocused=[...]");
    });

    test("animateToItem eases ~330 ms per row", () => {
        const list = makeList();
        observe(list, ["scrollingStatus", "itemFocused"]);
        list.setValue("animateToItem", new Int32(2));
        advance(640);
        expect(list.getValueJS("scrollingStatus")).toBe(true);
        advance(100);
        expect(log).toEqual(["scrollingStatus=true", "itemFocused=2", "scrollingStatus=false"]);
    });

    describe("ZoomRowList", () => {
        function makeZoom() {
            const list = SGNodeFactory.createNode("ZoomRowList");
            list.setValue("itemComponentName", new BrsString("X"));
            const root = SGNodeFactory.createNode("ContentNode");
            for (let r = 0; r < 4; r++) {
                const row = SGNodeFactory.createNode("ContentNode");
                for (let c = 0; c < 8; c++) {
                    row.appendChildToParent(SGNodeFactory.createNode("ContentNode"));
                }
                root.appendChildToParent(row);
            }
            list.setValue("content", root);
            list.setNodeFocus(true);
            return list;
        }

        test("a row change drops scrollingStatus ahead of rowFocused (device order)", () => {
            const list = makeZoom();
            observe(list, ["scrollingStatus", "rowUnfocused", "rowFocused", "rowItemFocused"]);
            tap(list, "down");
            expect(log).toEqual(["scrollingStatus=true", "rowUnfocused=0"]);
            advance(380);
            expect(log).toEqual([
                "scrollingStatus=true",
                "rowUnfocused=0",
                "scrollingStatus=false",
                "rowFocused=1",
                "rowItemFocused=[...]",
            ]);
        });

        test("the zoom percents ramp between the rows while moving", () => {
            const list = makeZoom();
            const items = [];
            for (let r = 0; r < 2; r++) {
                list.rowItemComps[r] = [];
                const item = SGNodeFactory.createNode("Group");
                for (const name of ["focusPercent", "rowFocusPercent", "rowHeightPercent"]) {
                    item.addNodeField(name, "float", false);
                }
                for (const name of ["itemHasFocus", "rowHasFocus"]) {
                    item.addNodeField(name, "boolean", false);
                }
                list.rowItemComps[r][0] = item;
                items.push(item);
            }
            tap(list, "down");
            advance(97, 1);
            const fraction = list.getValueJS("currFocusRow");
            expect(fraction).toBeGreaterThan(0.5);
            expect(items[1].getValueJS("rowHeightPercent")).toBeCloseTo(fraction, 2);
            expect(items[0].getValueJS("rowFocusPercent")).toBeCloseTo(1 - fraction, 2);
            advance(300);
            expect(items[1].getValueJS("rowHeightPercent")).toBe(1);
            expect(items[0].getValueJS("rowHeightPercent")).toBe(0);
            expect(items[1].getValueJS("rowHasFocus")).toBe(true);
        });

        test("animateToRow moves ~265 ms per row", () => {
            const list = makeZoom();
            observe(list, ["rowFocused"]);
            list.setValue("animateToRow", new Int32(2));
            advance(500);
            expect(log).toEqual([]);
            advance(80);
            expect(log).toEqual(["rowFocused=2"]);
        });
    });
});
