const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot, sgClock } = scenegraph;
const { BrsDevice, BrsString, Int32, RoArray, Float, RoMessagePort } = core;

/**
 * Grid focus motion, pinned to a device trace (Roku Express 4K+, OS 16.0,
 * test/simulator/probes/grid-focus-motion-probe/device-trace-os16.0.txt).
 *
 * Same model as the lists, on two axes: each step is a cubic ease-out of ~330 ms (~315 ms for a row when
 * the grid's rows wrap); `horizFocusDirection` reports a column move the way `vertFocusDirection` reports
 * a row move; a held key repeats after ~530 ms; `animateToItem` moves both axes at once, each resetting
 * its direction as it lands.
 */
describe("Grid focus motion", () => {
    const fakeInterpreter = { environment: {}, inSubEnv: () => {} };
    let now;
    let log;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        now = 300_000;
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

    function observe(node, fields) {
        const port = new RoMessagePort();
        port.pushMessage = (event) => {
            log.push(`${event.fieldName.getValue()}=${event.fieldValue?.getValue?.()}`);
        };
        for (const field of fields) {
            node.addObserver(fakeInterpreter, "unscoped", new BrsString(field), port);
        }
    }

    const fields = ["scrollingStatus", "itemUnfocused", "itemFocused", "vertFocusDirection", "horizFocusDirection"];

    /** 15 items, 3 columns, 2 visible rows — the probe's grid. */
    function makeGrid(type, style) {
        const grid = SGNodeFactory.createNode(type);
        if (type === "PosterGrid") {
            grid.setValue("basePosterSize", new RoArray([new Float(180), new Float(100)]));
        } else {
            grid.setValue("itemSize", new RoArray([new Float(180), new Float(100)]));
        }
        grid.setValue("itemSpacing", new RoArray([new Float(10), new Float(10)]));
        grid.setValue("numColumns", new Int32(3));
        grid.setValue("numRows", new Int32(2));
        if (style) {
            grid.setValue("vertFocusAnimationStyle", new BrsString(style));
        }
        const root = SGNodeFactory.createNode("ContentNode");
        for (let i = 0; i < 15; i++) {
            const item = SGNodeFactory.createNode("ContentNode");
            item.setValue("shortDescriptionLine1", new BrsString(`I${i}`));
            root.appendChildToParent(item);
        }
        grid.setValue("content", root);
        grid.setNodeFocus(true);
        return grid;
    }

    const tap = (grid, key) => {
        grid.handleKey(key, true);
        grid.handleKey(key, false);
    };
    const col = (grid) => grid.getValueJS("currFocusColumn");
    const row = (grid) => grid.getValueJS("currFocusRow");

    test.each(["MarkupGrid", "PosterGrid"])("%s: a column move eases ~330 ms with horizFocusDirection", (type) => {
        const grid = makeGrid(type, "floatingFocus");
        observe(grid, fields);
        tap(grid, "right");
        expect(log).toEqual(["scrollingStatus=true", "itemUnfocused=0", "horizFocusDirection=right"]);
        const start = now;
        // Device checkpoints: +70 ms 0.5, +204 ms 0.94.
        advance(start + 70 - now, 1);
        expect(Math.abs(col(grid) - 0.5)).toBeLessThan(0.06);
        advance(start + 204 - now, 1);
        expect(Math.abs(col(grid) - 0.94)).toBeLessThan(0.03);
        advance(start + 380 - now);
        expect(col(grid)).toBe(1);
        expect(log).toEqual([
            "scrollingStatus=true",
            "itemUnfocused=0",
            "horizFocusDirection=right",
            "itemFocused=1",
            "scrollingStatus=false",
            "horizFocusDirection=none",
        ]);
    });

    test("a row move takes ~330 ms floating and ~315 ms when the rows wrap", () => {
        const floating = makeGrid("PosterGrid", "floatingFocus");
        tap(floating, "down");
        advance(320, 1);
        expect(floating.getValueJS("scrollingStatus")).toBe(true);
        advance(40);
        expect(floating.getValueJS("itemFocused")).toBe(3);

        const wrapping = makeGrid("PosterGrid");
        tap(wrapping, "down");
        advance(335, 1);
        expect(wrapping.getValueJS("itemFocused")).toBe(3);
        expect(row(wrapping)).toBe(1);
    });

    test("Right at the end of a row moves nothing and emits nothing", () => {
        const grid = makeGrid("MarkupGrid", "floatingFocus");
        tap(grid, "right");
        tap(grid, "right");
        advance(800);
        observe(grid, fields);
        expect(grid.handleKey("right", true)).toBe(false);
        advance(100);
        expect(log).toEqual([]);
    });

    test("a held key repeats after ~530 ms and eases into the last cell", () => {
        const grid = makeGrid("MarkupGrid", "floatingFocus");
        observe(grid, ["itemFocused"]);
        grid.handleKey("right", true);
        advance(500);
        expect(col(grid)).toBe(1);
        advance(150);
        // Device: the repeat starts at ~+542 ms and lands on the row's last column at ~+842 ms.
        expect(col(grid)).toBeGreaterThan(1);
        advance(300);
        expect(col(grid)).toBe(2);
        // Still held: the settle waits for the release.
        expect(log).toEqual([]);
        grid.handleKey("right", false);
        advance(50);
        expect(log).toEqual(["itemFocused=2"]);
    });

    test("animateToItem moves both axes and resets each direction as its axis lands", () => {
        const grid = makeGrid("MarkupGrid", "floatingFocus");
        tap(grid, "right");
        tap(grid, "right");
        advance(800);
        observe(grid, fields);
        grid.setValue("animateToItem", new Int32(7));
        // Device: scrollingStatus, itemUnfocused, horizFocusDirection=left, vertFocusDirection=down.
        expect(log).toEqual([
            "scrollingStatus=true",
            "itemUnfocused=2",
            "horizFocusDirection=left",
            "vertFocusDirection=down",
        ]);
        advance(420);
        // The column (one step) has landed, the rows (two steps) are still moving.
        expect(col(grid)).toBe(1);
        expect(log.at(-1)).toBe("horizFocusDirection=none");
        expect(grid.getValueJS("scrollingStatus")).toBe(true);
        advance(400);
        expect(row(grid)).toBe(2);
        expect(log.slice(-3)).toEqual(["itemFocused=7", "scrollingStatus=false", "vertFocusDirection=none"]);
    });

    test("with transitions off a column move is instant with the same field order", () => {
        sgRoot.uiTransitionsEnabled = false;
        const grid = makeGrid("MarkupGrid", "floatingFocus");
        observe(grid, fields);
        tap(grid, "right");
        expect(log).toEqual([
            "scrollingStatus=true",
            "itemUnfocused=0",
            "horizFocusDirection=right",
            "itemFocused=1",
            "scrollingStatus=false",
            "horizFocusDirection=none",
        ]);
    });

    /** A draw target that accepts every call — enough for a paint pass whose output is not inspected. */
    const nullDraw2D = () => new Proxy({}, { get: () => () => undefined });

    /** Renders one paint pass mid-motion and records the indicator vs. cell draw order. */
    function drawOrder(node, cellMethod) {
        const order = [];
        const drawFocus = node.renderMotionFocus.bind(node);
        node.renderMotionFocus = (...args) => {
            order.push("indicator");
            return drawFocus(...args);
        };
        const drawCell = node[cellMethod].bind(node);
        node[cellMethod] = (...args) => {
            order.push("cell");
            return drawCell(...args);
        };
        node.renderNode(new core.Interpreter(), [0, 0], 0, 1, nullDraw2D());
        return order;
    }

    test("a grid draws its moving indicator over every cell (device screenshot)", () => {
        // grid-focus-layer-probe: mid-glide, a MarkupGrid's focus ring crosses over the opaque cells on
        // both sides of it, with drawFocusFeedbackOnTop false or true.
        const grid = makeGrid("PosterGrid", "floatingFocus");
        tap(grid, "right");
        advance(100);
        const order = drawOrder(grid, "renderItemComponent");
        expect(order.filter((step) => step === "indicator")).toHaveLength(1);
        expect(order.at(-1)).toBe("indicator");
        expect(order.filter((step) => step === "cell").length).toBeGreaterThan(1);
    });

    test("drawFocusFeedbackOnTop written false draws a grid's moving indicator under the cells (device screenshot)", () => {
        // focus-opaque-layer-probe: with the field written false (XML or BrightScript), an opaque focus
        // bitmap stays under the item's content, at rest and while the focus moves.
        const grid = makeGrid("PosterGrid", "floatingFocus");
        grid.setValue("drawFocusFeedbackOnTop", core.BrsBoolean.False);
        tap(grid, "right");
        advance(100);
        const order = drawOrder(grid, "renderItemComponent");
        expect(order[0]).toBe("indicator");
        expect(order.filter((step) => step === "indicator")).toHaveLength(1);
    });

    test("a grid draws its settled indicator over the item until drawFocusFeedbackOnTop is written", () => {
        // focus-opaque-layer-probe: the field reads false, yet an unwritten grid draws the indicator on top.
        const order = (grid) => {
            const steps = [];
            const renderFocus = grid.renderFocus.bind(grid);
            grid.renderFocus = (...args) => {
                steps.push("indicator");
                return renderFocus(...args);
            };
            const renderItem = grid.renderItemClipped.bind(grid);
            grid.renderItemClipped = (...args) => {
                steps.push("item");
                return renderItem(...args);
            };
            grid.renderNode(new core.Interpreter(), [0, 0], 0, 1, nullDraw2D());
            const at = steps.indexOf("indicator");
            return [steps[at - 1], steps[at + 1]];
        };
        expect(SGNodeFactory.createNode("MarkupGrid").getValueJS("drawFocusFeedbackOnTop")).toBe(false);
        const unwritten = makeGrid("PosterGrid", "floatingFocus");
        expect(unwritten.getValueJS("drawFocusFeedbackOnTop")).toBe(false);
        expect(order(unwritten)[0]).toBe("item");
        const written = makeGrid("PosterGrid", "floatingFocus");
        written.setValue("drawFocusFeedbackOnTop", core.BrsBoolean.False);
        expect(order(written)[1]).toBe("item");
    });

    test("a list draws its moving indicator under its items (device screenshot)", () => {
        // grid-focus-layer-probe: mid-scroll, a LabelList's focused text and a MarkupList's opaque items
        // are drawn over the focus highlight.
        const list = SGNodeFactory.createNode("LabelList");
        list.setValue("itemSize", new RoArray([new Float(400), new Float(48)]));
        list.setValue("numRows", new Int32(4));
        list.setValue("vertFocusAnimationStyle", new BrsString("floatingFocus"));
        const root = SGNodeFactory.createNode("ContentNode");
        for (let i = 0; i < 8; i++) {
            root.appendChildToParent(SGNodeFactory.createNode("ContentNode"));
        }
        list.setValue("content", root);
        list.setNodeFocus(true);
        tap(list, "down");
        advance(100);
        const order = drawOrder(list, "renderItem");
        expect(order[0]).toBe("indicator");
        expect(order.filter((step) => step === "indicator")).toHaveLength(1);
    });

    test("a PosterGrid keeps its settled bounding rect while the rows scroll", () => {
        const grid = makeGrid("PosterGrid");
        const interpreter = new core.Interpreter();
        grid.renderNode(interpreter, [0, 0], 0, 1);
        const before = grid.getBoundingRect();
        tap(grid, "down");
        advance(100);
        grid.renderNode(interpreter, [0, 0], 0, 1);
        expect(grid.getBoundingRect()).toEqual(before);
    });
});
