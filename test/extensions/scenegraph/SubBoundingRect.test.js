const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, Group, MarkupGrid, RowList, ZoomRowList, ContentNode, sgRoot } = scenegraph;
const { BrsDevice, Interpreter, BrsString, Float, RoArray } = core;

function vector(values) {
    return new RoArray(values.map((v) => (Array.isArray(v) ? vector(v) : new Float(v))));
}

describe("ifSGNodeBoundingRect sub-part methods", () => {
    beforeAll(() => {
        // MarkupGrid's font-typed defaults need the common: fonts; mount the common volume once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    test("subBoundingRect/localSubBoundingRect/sceneSubBoundingRect/ancestorSubBoundingRect are registered on nodes", () => {
        const node = new Node([], "Node");
        for (const method of [
            "subBoundingRect",
            "localSubBoundingRect",
            "sceneSubBoundingRect",
            "ancestorSubBoundingRect",
        ]) {
            expect(node.getMethod(method)).toBeTruthy();
        }
    });

    test("falls back to the node's own bounding rect when the sub part does not exist", () => {
        const node = new Group([], "Group");
        node.rectToParent = { x: 10, y: 20, width: 100, height: 50 };
        node.rectLocal = { x: 0, y: 0, width: 100, height: 50 };
        node.rectToScene = { x: 110, y: 220, width: 100, height: 50 };

        // Plain nodes have no sub parts; per the Roku spec the node's own rect is returned.
        expect(node.getSubBoundingRect("toParent", "item3")).toEqual(node.rectToParent);
        expect(node.getSubBoundingRect("local", "focusItem")).toEqual(node.rectLocal);
        expect(node.getSubBoundingRect("toScene", "item1_2")).toEqual(node.rectToScene);
    });

    // DEVICE-MEASURED (Roku OS 16.0, probe `subrect-space-probe`): subBoundingRect is measured from the
    // grid's own translation origin (not its parent's), localSubBoundingRect is the item's own space,
    // and a sub part the grid does not have is a zero-size rect at the grid's origin.
    test("resolves itemX and focusItem on an ArrayGrid-derived node", () => {
        const grid = new MarkupGrid();
        // Translation [10,20] under a parent at scene [90,180], with the grid's own rect outset by
        // [10,12]: the outset must cancel out of every sub part rect.
        grid.setValue("translation", vector([10, 20]));
        grid.rectToParent = { x: 0, y: 8, width: 458, height: 824 };
        grid.rectLocal = { x: -10, y: -12, width: 458, height: 824 };
        grid.rectToScene = { x: 90, y: 188, width: 458, height: 824 };

        // Simulate two rendered item components (itemComps are created during rendering).
        const item0 = new Group([], "Group");
        item0.rectToScene = { x: 100, y: 200, width: 438, height: 72 };
        const item1 = new Group([], "Group");
        item1.rectToScene = { x: 100, y: 284, width: 438, height: 72 };
        grid.itemComps[0] = item0;
        grid.itemComps[1] = item1;
        grid.content.push(new ContentNode(), new ContentNode());
        grid.focusIndex = 1;

        // itemX relative to the grid's translation origin.
        expect(grid.getSubBoundingRect("toParent", "item1")).toEqual({ x: 0, y: 84, width: 438, height: 72 });
        expect(grid.getSubBoundingRect("toParent", "item0")).toEqual({ x: 0, y: 0, width: 438, height: 72 });
        // itemX in its own coordinate system.
        expect(grid.getSubBoundingRect("local", "item1")).toEqual({ x: 0, y: 0, width: 438, height: 72 });
        // itemX in scene coordinates is the tracked rect itself.
        expect(grid.getSubBoundingRect("toScene", "item0")).toEqual(item0.rectToScene);
        // focusItem/focusIndicator resolve to the focused item component.
        expect(grid.getSubBoundingRect("toParent", "focusItem")).toEqual({ x: 0, y: 84, width: 438, height: 72 });
        expect(grid.getSubBoundingRect("toParent", "focusIndicator")).toEqual({
            x: 0,
            y: 84,
            width: 438,
            height: 72,
        });
        // ancestorSubBoundingRect walks up from the grid's parent space: through its translation.
        expect(grid.getSubBoundingRect("ancestor", "item1")).toEqual({ x: 10, y: 104, width: 438, height: 72 });
        // An item with no component (never rendered, or out of range) is a zero rect at the grid's origin.
        for (const id of ["item7", "bogus"]) {
            expect(grid.getSubBoundingRect("toParent", id)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
            expect(grid.getSubBoundingRect("local", id)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
            expect(grid.getSubBoundingRect("toScene", id)).toEqual({ x: 100, y: 200, width: 0, height: 0 });
            expect(grid.getSubBoundingRect("ancestor", id)).toEqual({ x: 10, y: 20, width: 0, height: 0 });
        }
    });

    test("a missing sub part is exactly zero in parent/local space under a fractional scale", () => {
        const grid = new MarkupGrid();
        grid.setValue("scale", new RoArray([new Float(0.6), new Float(0.6)]));
        grid.setValue("translation", vector([100, 300]));
        grid.sceneMap = { sx: 0.6, sy: 0.6, bx: 0, by: 0 };
        grid.rectLocal = { x: -33, y: -6, width: 666, height: 112 };
        grid.rectToParent = { x: 80.2, y: 296.4, width: 399.6, height: 67.2 };
        grid.rectToScene = { x: 108.12, y: 177.84, width: 239.76, height: 40.32 };

        for (const type of ["toParent", "local"]) {
            expect(grid.getSubBoundingRect(type, "bogus")).toEqual({ x: 0, y: 0, width: 0, height: 0 });
        }
        // The origin: the rect's corner moved back by the outset, in scene (x0.36) units, and the grid's
        // translation in its parent's.
        const scene = grid.getSubBoundingRect("toScene", "bogus");
        expect(scene.x).toBeCloseTo(108.12 + 33 * 0.36, 5);
        expect(scene.y).toBeCloseTo(177.84 + 6 * 0.36, 5);
        expect(grid.getSubBoundingRect("ancestor", "bogus")).toEqual({ x: 100, y: 300, width: 0, height: 0 });
    });

    test("a missing sub part refreshes layout before reading the grid's origin", () => {
        const grid = new MarkupGrid();
        grid.rectLocal = { x: 0, y: 0, width: 100, height: 100 };
        grid.rectToScene = { x: 0, y: 0, width: 100, height: 100 };
        const interpreter = new Interpreter();
        // Stands in for a refresh that lays the grid out at its newly written translation.
        grid.getBoundingRect = (type, interp) => {
            expect(interp).toBe(interpreter);
            grid.rectToScene = { x: 500, y: 40, width: 100, height: 100 };
            return grid.rectToScene;
        };
        expect(grid.getSubBoundingRect("toScene", "bogus", interpreter)).toEqual({
            x: 500,
            y: 40,
            width: 0,
            height: 0,
        });
    });

    // DEVICE-MEASURED (Roku OS 16, probe `group-scale-probe` S4): under a scaled ancestor the
    // parent and local sub part rects are in the grid's unscaled units (a 100x100 PosterGrid item under
    // a Group scaled 0.5 reports subBoundingRect 100x100 and sceneSubBoundingRect 50x50; the same under
    // the grid's own scale 0.5 in `subrect-space-probe`).
    test("re-expresses an itemX scene rect in unscaled units under ancestor and own scale", () => {
        const grid = new MarkupGrid();
        grid.setValue("scale", new RoArray([new Float(0.5), new Float(0.5)]));
        grid.setValue("translation", vector([10, 20]));
        // Ancestors scale by 0.5 and the grid by another 0.5: one parent unit is 0.5 scene units,
        // one local unit 0.25.
        grid.sceneMap = { sx: 0.5, sy: 0.5, bx: 50, by: 100 };
        grid.rectToParent = { x: 10, y: 20, width: 220, height: 400 };
        grid.rectLocal = { x: 0, y: 0, width: 440, height: 800 };
        grid.rectToScene = { x: 55, y: 110, width: 110, height: 200 };

        const item1 = new Group([], "Group");
        item1.rectToScene = { x: 55, y: 131, width: 110, height: 18 };
        grid.itemComps[1] = item1;
        grid.content.push(new ContentNode(), new ContentNode());

        expect(grid.getSubBoundingRect("toParent", "item1")).toEqual({ x: 0, y: 84, width: 440, height: 72 });
        expect(grid.getSubBoundingRect("local", "item1")).toEqual({ x: 0, y: 0, width: 440, height: 72 });
        expect(grid.getSubBoundingRect("ancestor", "item1")).toEqual({ x: 10, y: 62, width: 220, height: 36 });
        expect(grid.getSubBoundingRect("toScene", "item1")).toEqual(item1.rectToScene);
    });

    // A RowList's sub parts come from its layout (DEVICE-MEASURED, OS 16.0, `grid-rect-probe` cases
    // `rl_*` and `x_*`): a cell is its `rowItemSize` slot at its laid-out position, `item<row>` is the
    // whole row at the focused item's x, and rows outside the window are reported too.
    // Two rows of three 200x120 cells 20 apart in 1000x140 rows 20 apart; row 1 / col 2 focused, so
    // fixedFocus puts row 1 at the top and row 0 above it.
    const buildRowList = () => {
        const list = new RowList();
        list.setValue("itemSize", vector([1000, 140]));
        list.setValue("itemSpacing", vector([0, 20]));
        list.setValue("rowItemSize", vector([[200, 120]]));
        list.setValue("rowItemSpacing", vector([[20, 0]]));
        for (let r = 0; r < 2; r++) {
            const row = new ContentNode();
            for (let c = 0; c < 3; c++) {
                row.appendChildToParent(new ContentNode());
            }
            list.content.push(row);
        }
        list.focusIndex = 1;
        list.rowFocus[0] = 1;
        list.rowFocus[1] = 2;
        // At translation [100,200], outset by 22.
        list.rectLocal = { x: -22, y: -22, width: 1044, height: 344 };
        list.rectToScene = { x: 78, y: 178, width: 1044, height: 344 };
        return list;
    };

    test("a RowList reports cells and rows from its layout, including rows above the window", () => {
        const list = buildRowList();

        expect(list.getSubBoundingRect("toParent", "item1_2")).toEqual({ x: 440, y: 0, width: 200, height: 120 });
        expect(list.getSubBoundingRect("toParent", "item0_0")).toEqual({ x: 0, y: -160, width: 200, height: 120 });
        // A row: the focused item's x in every row, the list's width and the row's height.
        expect(list.getSubBoundingRect("toParent", "item0")).toEqual({ x: 440, y: -160, width: 1000, height: 140 });
        expect(list.getSubBoundingRect("local", "item1")).toEqual({ x: 0, y: 0, width: 1000, height: 140 });
        // A column past the row's end is a zero rect at the row's left edge; a row past the content is missing.
        expect(list.getSubBoundingRect("toParent", "item0_7")).toEqual({ x: 0, y: -160, width: 0, height: 0 });
        expect(list.getSubBoundingRect("toParent", "item9_9")).toEqual({ x: 0, y: 0, width: 0, height: 0 });
        expect(list.getSubBoundingRect("toScene", "item1_2")).toEqual({ x: 540, y: 200, width: 200, height: 120 });
        expect(list.getSubBoundingRect("toScene", "item9_9")).toEqual({ x: 100, y: 200, width: 0, height: 0 });
    });

    // The focused cell reports its bare slot, like any other cell: neither the drawn focus frame nor the
    // list's own outset reaches an item sub-rect.
    test("RowList reports the focused item's bare slot, not the focus-feedback footprint", () => {
        const list = buildRowList();
        const slot = { x: 440, y: 0, width: 200, height: 120 };

        for (const id of ["item1_2", "focusItem", "focusIndicator"]) {
            expect(list.getSubBoundingRect("toParent", id)).toEqual(slot);
        }
        list.setValue("drawFocusFeedback", core.BrsBoolean.False);
        expect(list.getSubBoundingRect("toParent", "item1_2")).toEqual(slot);
        list.setValue("focusBitmapUri", new core.BrsString(""));
        list.setValue("focusFootprintBitmapUri", new core.BrsString(""));
        expect(list.getSubBoundingRect("toParent", "item1_2")).toEqual(slot);
    });

    test("a RowList's floating focus scrolls a row longer than the list to keep the focus inside it", () => {
        // DEVICE-MEASURED (grid-rect-probe case x_float): ten 100px items 20 apart in a 600px list; a jump
        // to column 5 scrolls the row by one item, so the focus sits at x 480.
        const list = new RowList();
        list.setValue("itemSize", vector([600, 100]));
        list.setValue("rowItemSize", vector([[100, 100]]));
        list.setValue("rowItemSpacing", vector([[20, 0]]));
        const row = new ContentNode();
        for (let c = 0; c < 10; c++) {
            row.appendChildToParent(new ContentNode());
        }
        list.content.push(row);
        list.setValue("jumpToRowItem", vector([0, 5]));

        expect(list.getSubBoundingRect("toParent", "focusItem")).toEqual({ x: 480, y: 0, width: 100, height: 100 });
        expect(list.getSubBoundingRect("toParent", "item0_0")).toEqual({ x: -120, y: 0, width: 100, height: 100 });
    });

    test("a ZoomRowList resolves cells from cached rects and rows from the last frame", () => {
        const list = new ZoomRowList();
        list.rectLocal = { x: 0, y: 0, width: 1000, height: 400 };
        list.rectToScene = { x: 100, y: 200, width: 1000, height: 400 };
        const cell = (x, y) => {
            const g = new Group([], "Group");
            g.rectToScene = { x, y, width: 200, height: 120 };
            return g;
        };
        list.rowItemComps[0] = [cell(100, 200), cell(320, 200), cell(540, 200)];
        list.rowItemComps[1] = [cell(100, 340), cell(320, 340), cell(540, 340)];
        list.content.push(new ContentNode(), new ContentNode());
        list.focusIndex = 1;
        list.rowFocus[1] = 2;
        list.renderedRowRects.set(0, { x: 0, y: 0, width: 600, height: 120 });

        expect(list.getSubBoundingRect("toScene", "item0_0")).toEqual(list.rowItemComps[0][0].rectToScene);
        expect(list.getSubBoundingRect("toScene", "focusItem")).toEqual(list.rowItemComps[1][2].rectToScene);
        // DEVICE-MEASURED (grid-rect-probe case zr_base): `item<row>` is the row, at x 0, rowWidth wide.
        expect(list.getSubBoundingRect("toParent", "item0")).toEqual({ x: 0, y: 0, width: 600, height: 120 });
        // An unrendered cell or row is a zero rect at the list's origin.
        expect(list.getSubBoundingRect("toScene", "item9_9")).toEqual({ x: 100, y: 200, width: 0, height: 0 });
        expect(list.getSubBoundingRect("toScene", "item1")).toEqual({ x: 100, y: 200, width: 0, height: 0 });
    });
});

describe("ancestorSubBoundingRect", () => {
    let interpreter;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    function readRect(aa) {
        return {
            x: aa.get(new BrsString("x")).getValue(),
            y: aa.get(new BrsString("y")).getValue(),
            width: aa.get(new BrsString("width")).getValue(),
            height: aa.get(new BrsString("height")).getValue(),
        };
    }

    // Scene -> group -> grid, with the grid holding one rendered item component.
    function buildGrid() {
        const scene = new Group([], "Group");
        const group = new Group([], "Group");
        const grid = new MarkupGrid();
        scene.appendChildToParent(group);
        group.appendChildToParent(grid);

        // Inject a non-zero local rect on every ancestor so getBoundingRect treats them as already
        // laid out and returns these values as-is (a zero-sized local rect signals an unmeasured
        // node, which getBoundingRect re-measures with a local render even while `rendering`).
        group.setValue("translation", vector([50, 60]));
        grid.setValue("translation", vector([10, 20]));
        group.rectLocal = { x: 0, y: 0, width: 500, height: 900 };
        group.rectToParent = { x: 50, y: 60, width: 500, height: 900 };
        grid.rectToParent = { x: 10, y: 20, width: 438, height: 800 };
        grid.rectLocal = { x: 0, y: 0, width: 438, height: 800 };
        grid.rectToScene = { x: 100, y: 200, width: 438, height: 800 };
        // A real laid-out node also has `measureStale` clear; the tree above was assembled by field
        // writes (which set it) and never rendered, so clear it too. Leaving it set makes the
        // mid-render fallback re-measure these nodes at origin [0,0] and discard the injected rects.
        for (const node of [scene, group, grid]) {
            node.measureStale = false;
        }

        const item1 = new Group([], "Group");
        item1.rectToScene = { x: 100, y: 284, width: 438, height: 72 };
        grid.itemComps[1] = item1;
        grid.content.push(new ContentNode(), new ContentNode());

        return { scene, group, grid };
    }

    test("expresses a sub part rect in an ancestor's coordinate system", () => {
        const { scene, grid } = buildGrid();

        // Skip the layout-refresh render so the manually injected rects are measured as-is.
        sgRoot.rendering = true;
        try {
            const result = grid.getMethod("ancestorSubBoundingRect").call(interpreter, new BrsString("item1"), scene);
            // item1 is {10,104} in the grid's parent (group) space; the group's translation {50,60}
            // re-expresses it in the scene's coordinate system.
            expect(readRect(result)).toEqual({ x: 60, y: 164, width: 438, height: 72 });
        } finally {
            sgRoot.rendering = false;
        }
    });

    test("falls back to the node's own sub part rect when the ancestor is not in the chain", () => {
        const { grid } = buildGrid();
        const stranger = new Group([], "Group");

        sgRoot.rendering = true;
        try {
            const result = grid
                .getMethod("ancestorSubBoundingRect")
                .call(interpreter, new BrsString("item1"), stranger);
            // Not an ancestor: returns subBoundingRect, item1 in the grid's own space (DEVICE-MEASURED,
            // grid-rect-probe case a_chain).
            expect(readRect(result)).toEqual({ x: 0, y: 84, width: 438, height: 72 });
        } finally {
            sgRoot.rendering = false;
        }
    });
});

// DEVICE-MEASURED (OS 16.0, `test/simulator/probes/grid-rect-probe` case `a_chain`, HD and FHD): the rect
// in the ancestor's own coordinates, through each node in between's translation, scale and rotation.
describe("ancestorBoundingRect", () => {
    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    function readRect(aa) {
        return ["x", "y", "width", "height"].map((k) => aa.get(new BrsString(k)).getValue());
    }

    function group(parent, fields) {
        const node = new Group([], "Group");
        for (const [name, value] of Object.entries(fields)) {
            node.setValue(name, Array.isArray(value) ? vector(value) : new Float(value));
        }
        parent?.appendChildToParent(node);
        return node;
    }

    function ancestorRect(node, ancestor) {
        node.rectLocal = { x: 0, y: 0, width: 40, height: 30 };
        node.measureStale = false;
        // Skip the layout-refresh render so the injected rect is measured as-is.
        sgRoot.rendering = true;
        try {
            return readRect(node.getMethod("ancestorBoundingRect").call(new Interpreter(), ancestor));
        } finally {
            sgRoot.rendering = false;
        }
    }

    test("applies the scale of every node in between", () => {
        const scene = group(undefined, {});
        const g1 = group(scene, { translation: [100, 50] });
        const g2 = group(g1, { translation: [50, 60], scale: [0.5, 0.5] });
        const g3 = group(g2, { translation: [30, 40] });
        const r = group(g3, { translation: [5, 5] });
        r.rectToParent = { x: 5, y: 5, width: 40, height: 30 };

        expect(ancestorRect(r, g3)).toEqual([5, 5, 40, 30]);
        expect(ancestorRect(r, g2)).toEqual([35, 45, 40, 30]);
        expect(ancestorRect(r, g1)).toEqual([67.5, 82.5, 20, 15]);
        expect(ancestorRect(r, scene)).toEqual([167.5, 132.5, 20, 15]);
        // Not an ancestor (itself, or a stranger): boundingRect.
        expect(ancestorRect(r, r)).toEqual([5, 5, 40, 30]);
        expect(ancestorRect(r, group(undefined, {}))).toEqual([5, 5, 40, 30]);
    });

    test("applies the rotation of every node in between", () => {
        const scene = group(undefined, {});
        const h1 = group(scene, { translation: [600, 300], rotation: Math.PI / 2 });
        const h2 = group(h1, { translation: [20, 0] });
        const rr = group(h2, { translation: [10, 0] });
        rr.rectToParent = { x: 10, y: 0, width: 40, height: 20 };

        expect(ancestorRect(rr, h1)).toEqual([30, 0, 40, 20]);
        const [x, y, width, height] = ancestorRect(rr, scene);
        expect([x, y, width, height].map((v) => Math.round(v))).toEqual([600, 230, 20, 40]);
    });
});
