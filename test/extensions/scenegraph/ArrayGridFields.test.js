const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { RowList, ZoomRowList, MarkupGrid, SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Int32, RoMessagePort } = core;

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

describe("ArrayGrid scrollingStatus field", () => {
    beforeAll(() => {
        // List/grid nodes have font-typed defaults; mount the common: volume once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    test("is present (default false) on ArrayGrid-derived list and grid nodes", () => {
        // Documented under ZoomRowList but present on all ArrayGrid-derived nodes on a real
        // device — apps alias it on plain RowList, and an unresolvable alias target aborts the
        // component's remaining <interface> fields, cascading into missing-field errors.
        for (const NodeType of [RowList, ZoomRowList, MarkupGrid]) {
            const node = new NodeType();
            expect(node.hasNodeField("scrollingstatus")).toBe(true);
            expect(node.getValueJS("scrollingStatus")).toBe(false);
        }
    });
});

/**
 * `scrollingStatus` must PULSE true → false around a key-driven focus move. Per the reference it is
 * "set to true whenever the list is scrolling the focus horizontally or vertically"; our scroll is
 * instant, so both edges land in the same frame — which makes their ORDER relative to the focus
 * fields the whole contract.
 *
 * On a device the scroll spans several frames: the field goes true, the focus fields pass through
 * in-transit values, and it goes false BEFORE the focus finally settles. Apps depend on that
 * interleave in both directions — the falling edge is where they tear transient scroll state down
 * (hiding a shared overlay/preview container that belongs to the outgoing item) and the *settle*
 * emission of the focus fields is what rebuilds it at the new position. So the falling edge must be
 * emitted BEFORE the settled focus fields; emitting it afterwards leaves such an app with its
 * overlay torn down and nothing left to restore it.
 *
 * By the same reasoning the pulse must NOT be emitted when nothing scrolls — a boundary press on a
 * non-wrapping list, or any key while the list is outside the focus chain. Those paths publish no
 * focus fields at all, so a pulse there is a teardown with no settle behind it to rebuild from, and
 * the field is not alwaysNotify, so a device emits nothing.
 */
describe("ArrayGrid scrollingStatus pulses on key navigation", () => {
    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    const fakeInterpreter = { environment: {}, inSubEnv: () => {} };

    /**
     * Observes `fields` on `node` through one shared port and returns the merged notification log as
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

    /** A list of `rows`, focused by default — focus fields only notify while the list is focused. */
    function makeList(type, rows, focused = true) {
        const list = SGNodeFactory.createNode(type);
        list.setValue("content", buildContent(rows));
        if (focused) {
            list.setNodeFocus(true);
        }
        return list;
    }

    test("vertical navigation closes the pulse BEFORE the settled focus fields", () => {
        const list = makeList("RowList", [["A", "B"], ["C", "D"], ["E"]]);
        const log = observe(list, [
            "scrollingStatus",
            "itemUnfocused",
            "itemFocused",
            "currFocusRow",
            "rowItemFocused",
        ]);

        expect(list.handleKey("down", true)).toBe(true);

        // Both edges come first, then EVERY settled focus field — itemUnfocused included, so the
        // ordering matches ArrayGrid.setFocusedItem. An app that tears its transient scroll state
        // down on the falling edge still gets the focus notifications afterwards to rebuild from.
        expect(log[0]).toBe("scrollingStatus=true");
        expect(log[1]).toBe("scrollingStatus=false");
        expect(log.indexOf("itemUnfocused=0")).toBeGreaterThan(1);
        expect(log.indexOf("currFocusRow=1")).toBeGreaterThan(1);
        expect(log.lastIndexOf("rowItemFocused=[...]")).toBeGreaterThan(log.indexOf("currFocusRow=1"));
        // Exactly one pulse per key press (no duplicate same-value notifications).
        expect(log.filter((e) => e === "scrollingStatus=true").length).toBe(1);
        expect(log.filter((e) => e === "scrollingStatus=false").length).toBe(1);
        // And the field settles back to false.
        expect(list.getValueJS("scrollingStatus")).toBe(false);
    });

    test("horizontal navigation also closes the pulse before the settle", () => {
        const list = makeList("RowList", [["A", "B", "C"]]);
        const log = observe(list, ["scrollingStatus", "rowItemFocused"]);

        expect(list.handleKey("right", true)).toBe(true);
        expect(log[0]).toBe("scrollingStatus=true");
        expect(log[1]).toBe("scrollingStatus=false");
        expect(log).toContain("rowItemFocused=[...]");
        expect(log.lastIndexOf("rowItemFocused=[...]")).toBeGreaterThan(1);
        expect(list.getValueJS("scrollingStatus")).toBe(false);
    });

    test("a navigation key that scrolls nothing emits no pulse at all", () => {
        // A single-row list has nowhere to go vertically, so the key stays unhandled and bubbles, and
        // nothing scrolled: emitting a pulse here would hand an app a teardown edge with no focus
        // settle behind it — the same failure as emitting the edges in the wrong order.
        const list = makeList("RowList", [["A", "B"]]);
        const log = observe(list, ["scrollingStatus"]);

        expect(list.handleKey("up", true)).toBe(false);
        expect(log).toEqual([]);
        expect(list.getValueJS("scrollingStatus")).toBe(false);
    });

    test("a boundary press at the end of a row emits no pulse", () => {
        const list = makeList("RowList", [["A", "B"]]);
        expect(list.handleKey("right", true)).toBe(true); // to the last column
        const log = observe(list, ["scrollingStatus", "rowItemFocused"]);

        expect(list.handleKey("right", true)).toBe(false); // nowhere left to go
        expect(log).toEqual([]);
    });

    test("no pulse while the list is outside the focus chain (it notifies no focus fields there)", () => {
        // Reachable in practice: dialog/panel container nodes forward keys to children without
        // checking focus. An unfocused list records the cursor silently, so a pulse would be an
        // unaccompanied teardown.
        const list = makeList(
            "RowList",
            [
                ["A", "B"],
                ["C", "D"],
            ],
            false
        );
        const log = observe(list, ["scrollingStatus", "itemFocused", "rowItemFocused"]);

        list.handleKey("down", true);
        expect(log).toEqual([]);
        expect(list.getValueJS("scrollingStatus")).toBe(false);
    });

    test("OK does not pulse (it selects, it does not scroll the focus)", () => {
        const list = makeList("RowList", [["A", "B"]]);
        const log = observe(list, ["scrollingStatus"]);

        list.handleKey("OK", true);
        list.handleKey("OK", false);
        expect(log).toEqual([]);
    });

    test("ZoomRowList pulses once per edge, ahead of its settle, on both axes", () => {
        // ZoomRowList used to emit the field manually and redeclare it with alwaysNotify, which
        // produced a spurious same-value notification; both are gone and the base pulse covers it.
        // Its vertical and horizontal handlers emit the settle by different routes (setFocusedItem
        // vs. a direct rowItemFocused write), so both have to close the pulse first.
        const list = makeList("ZoomRowList", [
            ["A", "B"],
            ["C", "D"],
        ]);
        list.setValue("itemComponentName", new BrsString("X"));
        const log = observe(list, ["scrollingStatus", "rowUnfocused", "rowFocused", "rowItemFocused"]);

        expect(list.handleKey("down", true)).toBe(true);
        expect(log[0]).toBe("scrollingStatus=true");
        expect(log[1]).toBe("scrollingStatus=false");
        expect(log.lastIndexOf("rowItemFocused=[...]")).toBeGreaterThan(1);
        // handleUpDown must not pre-assign focusIndex: setFocusedItem reads it as the OUTGOING row,
        // so doing so made rowUnfocused dead and an app collapsing that row never heard about it.
        expect(log).toContain("rowUnfocused=0");
        expect(log).toContain("rowFocused=1");

        log.length = 0;
        expect(list.handleKey("right", true)).toBe(true);
        expect(log[0]).toBe("scrollingStatus=true");
        expect(log[1]).toBe("scrollingStatus=false");
        expect(log.lastIndexOf("rowItemFocused=[...]")).toBeGreaterThan(1);
    });

    test("a grid node pulses too (the emission is central to ArrayGrid, not per node type)", () => {
        const grid = SGNodeFactory.createNode("MarkupGrid");
        // numColumns defaults to 1, which would leave `right` with nowhere to go.
        grid.setValue("numColumns", new Int32(4));
        grid.setValue("content", buildContent([["A", "B", "C", "D"]]).getNodeChildren()[0]);
        grid.setNodeFocus(true);
        const log = observe(grid, ["scrollingStatus", "itemFocused"]);

        grid.handleKey("right", true);
        expect(log[0]).toBe("scrollingStatus=true");
        expect(log[1]).toBe("scrollingStatus=false");
        expect(log.lastIndexOf("itemFocused=1")).toBeGreaterThan(1);
    });
});

/**
 * `currFocusRow`/`currFocusColumn` (documented on the base `ArrayGrid`, arraygrid.md) must already
 * reflect the newly focused position by the time `itemFocused` fires. Apps commonly read them
 * synchronously from inside an `itemFocused` observer — e.g. a header that collapses once the
 * focused row leaves index 0 — and a stale (pre-navigation) value there makes the app react one
 * navigation late, or never, depending on how many rows exist. Regression for two bugs found via a
 * real app (Jellyfin-Roku's VisualLibraryScene): RowList emitted itemFocused BEFORE updating
 * currFocusRow, and grid types (MarkupGrid/PosterGrid, via the base ArrayGrid.setFocusedItem) never
 * updated currFocusRow/currFocusColumn at all.
 */
describe("ArrayGrid currFocusRow/currFocusColumn reflect the new focus before itemFocused fires", () => {
    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    const fakeInterpreter = { environment: {}, inSubEnv: () => {} };

    test("RowList: an itemFocused observer reading currFocusRow synchronously sees the NEW row", () => {
        const list = SGNodeFactory.createNode("RowList");
        list.setValue("content", buildContent([["A", "B"], ["C", "D"], ["E"]]));
        list.setNodeFocus(true);

        const seenDuringItemFocused = [];
        const port = new RoMessagePort();
        const originalPush = port.pushMessage.bind(port);
        port.pushMessage = (event) => {
            const name = event.fieldName ? event.fieldName.getValue() : "";
            if (name === "itemFocused") {
                seenDuringItemFocused.push(list.getValueJS("currFocusRow"));
            }
            originalPush(event);
        };
        list.addObserver(fakeInterpreter, "unscoped", new BrsString("itemFocused"), port);

        expect(list.handleKey("down", true)).toBe(true);

        expect(seenDuringItemFocused).toEqual([1]);
    });

    test("MarkupGrid: currFocusRow/currFocusColumn track focus as the grid navigates", () => {
        const grid = SGNodeFactory.createNode("MarkupGrid");
        grid.setValue("numColumns", new Int32(2));
        grid.setValue("content", buildContent([["A", "B", "C", "D"]]).getNodeChildren()[0]);
        grid.setNodeFocus(true);

        expect(grid.getValueJS("currFocusRow")).toBe(0);
        expect(grid.getValueJS("currFocusColumn")).toBe(0);

        expect(grid.handleKey("right", true)).toBe(true);
        expect(grid.getValueJS("currFocusRow")).toBe(0);
        expect(grid.getValueJS("currFocusColumn")).toBe(1);

        expect(grid.handleKey("down", true)).toBe(true);
        expect(grid.getValueJS("currFocusRow")).toBe(1);
        expect(grid.getValueJS("currFocusColumn")).toBe(1);
    });
});

describe("ArrayGrid numColumns/numRows string coercion", () => {
    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    // Settings looked up from the registry come back as strings (e.g. "7"), and apps assign
    // them straight to the integer numColumns/numRows fields. The field coerces the string,
    // but the internal layout cache (this.numCols/this.numRows) must track that too, or the
    // grid keeps rendering the XML-default column count.
    test("caches a numeric string assigned to numColumns/numRows on MarkupGrid", () => {
        const node = new MarkupGrid();

        node.setValue("numColumns", new BrsString("7"));
        node.setValue("numRows", new BrsString("3"));

        // The field itself coerced the string to an integer (matches Roku).
        expect(node.getValueJS("numColumns")).toBe(7);
        expect(node.getValueJS("numRows")).toBe(3);

        // The layout cache the render loop actually reads must match the field.
        expect(node.numCols).toBe(7);
        expect(node.numRows).toBe(3);
    });
});
