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

    test("losing focus keeps the row an app's jumpToRowItem moved to", () => {
        const list = makeList();
        list.setValue("jumpToRowItem", new RoArray([new Int32(2), new Int32(3)]));
        list.setNodeFocus(false);
        expect(list.getValueJS("rowItemFocused")).toEqual([2, 3]);
        list.setNodeFocus(true);
        expect(list.getValueJS("rowItemFocused")).toEqual([2, 3]);
    });

    test("an unfocused content reset moves rowHasFocus back to row 0", () => {
        const list = makeList();
        list.setValue("jumpToRowItem", new RoArray([new Int32(2), new Int32(0)]));
        SGNodeFactory.createNode("Group").setNodeFocus(true);
        const root = SGNodeFactory.createNode("ContentNode");
        for (let r = 0; r < 3; r++) {
            const row = SGNodeFactory.createNode("ContentNode");
            row.appendChildToParent(SGNodeFactory.createNode("ContentNode"));
            root.appendChildToParent(row);
        }
        list.setValue("content", root);
        expect(list.flaggedRow).toBe(0);
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

    /** Records the clips one paint pass pushes (a draw target that accepts every other call). */
    function paintClips(list) {
        const clips = [];
        const draw2D = new Proxy(
            {},
            {
                get: (_target, name) => (name === "pushClip" ? (rect) => clips.push(rect) : () => undefined),
            }
        );
        list.renderNode(new core.Interpreter(), [0, 0], 0, 1, draw2D);
        return clips;
    }

    /** rowlist-clip-probe's list: 150 px rows 20 px apart, two visible. */
    function makeClipList() {
        const list = makeList();
        list.setValue("itemSize", new RoArray([new Float(1160), new Float(150)]));
        list.setValue("itemSpacing", new RoArray([new Float(0), new Float(20)]));
        list.setValue("rowItemSize", new RoArray([new RoArray([new Float(160), new Float(100)])]));
        list.setValue("itemComponentName", new BrsString("Group"));
        return list;
    }

    test("a move along a row clips nothing (device screenshot)", () => {
        // rowlist-clip-probe: mid-move, captions below the posters stay visible on every row.
        const list = makeClipList();
        tap(list, "right");
        advance(100);
        expect(paintClips(list).filter((clip) => clip.width >= 200000)).toEqual([]);
    });

    test("a row change clips to the window plus the last row's spacing (device screenshot)", () => {
        // rowlist-clip-probe: mid-scroll the rows are cut at y = top + 2 x (150 + 20), not at the last row's bottom.
        const list = makeClipList();
        tap(list, "down");
        advance(100);
        const clips = paintClips(list).filter((clip) => clip.width >= 200000);
        expect(clips).toHaveLength(1);
        expect(clips[0].y).toBe(0);
        expect(clips[0].height).toBe(340);
    });

    test("a row change scrolls by the heights of the rows it passes, without overshooting", () => {
        // JellyRock's home rows: per-row rowHeights/rowSpacings, fixedFocus. Row 1 must glide from where it
        // sat (row 0's height plus its spacing below the top) to the top, never past it.
        const list = makeClipList();
        list.setValue("vertFocusAnimationStyle", new BrsString("fixedFocus"));
        list.setValue("rowHeights", new RoArray([new Float(100), new Float(300), new Float(100), new Float(300)]));
        list.setValue("rowSpacings", new RoArray([new Float(20), new Float(60), new Float(20), new Float(60)]));
        const rowTop = () => {
            let top;
            const render = list.renderSingleRow.bind(list);
            list.renderSingleRow = (rowIndex, slot, context) => {
                if (rowIndex === 1) {
                    top = context.itemRect.y;
                }
                return render(rowIndex, slot, context);
            };
            paintClips(list);
            list.renderSingleRow = render;
            return top;
        };
        expect(rowTop()).toBe(120);
        tap(list, "down");
        const tops = [];
        for (let i = 0; i < 25; i++) {
            advance(16);
            tops.push(rowTop());
        }
        expect(tops[0]).toBeLessThanOrEqual(120);
        expect(tops[0]).toBeGreaterThan(60);
        for (let i = 1; i < tops.length; i++) {
            expect(tops[i]).toBeLessThanOrEqual(tops[i - 1]);
            expect(tops[i]).toBeGreaterThanOrEqual(0);
        }
        expect(rowTop()).toBe(0);
    });

    test("an animation started from a settle observer has its first frame applied before the paint", () => {
        // JellyRock's backdrop: a rowItemFocused observer swaps the image and starts a fade-in from 0. The
        // settle runs in this pass's transitions, so animations must tick after them or the paint shows the
        // new image at its old opacity of 1 for a frame.
        const list = makeList();
        const backdrop = SGNodeFactory.createNode("Rectangle");
        backdrop.setValue("id", new BrsString("backdrop"));
        backdrop.setValue("opacity", new Float(1));
        const parent = SGNodeFactory.createNode("Group");
        parent.appendChildToParent(backdrop);
        const fade = SGNodeFactory.createNode("Animation");
        fade.setValue("duration", new Float(0.5));
        const interpolator = SGNodeFactory.createNode("FloatFieldInterpolator");
        interpolator.setValue("key", new RoArray([new Float(0), new Float(1)]));
        interpolator.setValue("keyValue", new RoArray([new Float(0), new Float(1)]));
        interpolator.setValue("fieldToInterp", new BrsString("backdrop.opacity"));
        fade.appendChildToParent(interpolator);
        parent.appendChildToParent(fade);
        const port = new RoMessagePort();
        port.pushMessage = () => fade.setValue("control", new BrsString("start"));
        list.addObserver(fakeInterpreter, "unscoped", new BrsString("rowItemFocused"), port);
        tap(list, "right");
        // Whole render passes: in the pass that publishes the settle, the fade's first frame is applied too.
        for (let pass = 0; pass < 40 && list.getValueJS("rowItemFocused")[1] !== 1; pass++) {
            expect(backdrop.getValueJS("opacity")).toBe(1);
            now += 16;
            sgRoot.processScenePass();
        }
        expect(list.getValueJS("rowItemFocused")).toEqual([0, 1]);
        expect(backdrop.getValueJS("opacity")).toBeCloseTo(0, 2);
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

        test("jumpToRowItem mid-motion lands the motion first and publishes nothing after the jump", () => {
            const list = makeZoom();
            observe(list, ["scrollingStatus", "rowFocused", "rowItemFocused"]);
            tap(list, "down");
            advance(100);
            list.setValue("jumpToRowItem", new RoArray([new Int32(0), new Int32(0)]));
            const settled = log.length;
            expect(log.slice(0, settled).filter((entry) => entry.startsWith("rowFocused"))).toEqual([
                "rowFocused=1",
                "rowFocused=0",
            ]);
            advance(500);
            expect(log.length).toBe(settled);
            expect(list.getValueJS("currFocusRow")).toBe(0);
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
