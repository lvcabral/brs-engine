const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, Group, MarkupGrid, RowList, ZoomRowList, ContentNode, sgRoot } = scenegraph;
const { BrsDevice, Interpreter, BrsString } = core;

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

    test("resolves itemX and focusItem on an ArrayGrid-derived node", () => {
        const grid = new MarkupGrid();
        grid.rectToParent = { x: 10, y: 20, width: 438, height: 800 };
        grid.rectLocal = { x: 0, y: 0, width: 438, height: 800 };
        grid.rectToScene = { x: 100, y: 200, width: 438, height: 800 };

        // Simulate two rendered item components (itemComps are created during rendering).
        const item0 = new Group([], "Group");
        item0.rectToScene = { x: 100, y: 200, width: 438, height: 72 };
        const item1 = new Group([], "Group");
        item1.rectToScene = { x: 100, y: 284, width: 438, height: 72 };
        grid.itemComps[0] = item0;
        grid.itemComps[1] = item1;
        grid.content.push(new ContentNode(), new ContentNode());
        grid.focusIndex = 1;

        // itemX in the parent's coordinate system: grid position + offset within the grid.
        expect(grid.getSubBoundingRect("toParent", "item1")).toEqual({ x: 10, y: 104, width: 438, height: 72 });
        // itemX in the grid's local coordinate system.
        expect(grid.getSubBoundingRect("local", "item1")).toEqual({ x: 0, y: 84, width: 438, height: 72 });
        // itemX in scene coordinates is the tracked rect itself.
        expect(grid.getSubBoundingRect("toScene", "item0")).toEqual(item0.rectToScene);
        // focusItem/focusIndicator resolve to the focused item component.
        expect(grid.getSubBoundingRect("toParent", "focusItem")).toEqual({ x: 10, y: 104, width: 438, height: 72 });
        expect(grid.getSubBoundingRect("toParent", "focusIndicator")).toEqual({
            x: 10,
            y: 104,
            width: 438,
            height: 72,
        });
        // An item that was never rendered (no component yet) falls back to the grid's rect.
        expect(grid.getSubBoundingRect("toParent", "item7")).toEqual(grid.rectToParent);
    });

    // RowList (and ZoomRowList) hold a 2-D grid of item components in rowItemComps[row][col], not the
    // flat itemComps[] array, so they need their own resolveSubpart. Apps place a focused-item overlay
    // from subBoundingRect("item<row>_<col>"); before the override every query fell back to the
    // whole-list rect (verified against a real device, which returns the focused item's rect). The
    // resolved path also must NOT force a re-render — it reads the item's cached last-frame rect.
    // Shared fixture: two rows of three poster-sized cells, row 1 / col 2 focused.
    const buildRowGrid = (list) => {
        list.rectToParent = { x: 10, y: 20, width: 1000, height: 400 };
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
        list.rowFocus[0] = 1;
        list.rowFocus[1] = 2;
    };

    for (const { label, make } of [
        { label: "RowList", make: () => new RowList() },
        { label: "ZoomRowList", make: () => new ZoomRowList() },
    ]) {
        test(`resolves item<row>_<col>/item<row>/focusItem on a ${label} from cached rects`, () => {
            const list = make();
            buildRowGrid(list);

            // A NON-focused cell resolves to its exact poster rect (the base parseInt would drop the _col).
            expect(list.getSubBoundingRect("toScene", "item0_0")).toEqual(list.rowItemComps[0][0].rectToScene);
            // item<row> (no underscore) resolves to that row's focused column (non-focused row 0 → col 1).
            expect(list.getSubBoundingRect("toScene", "item0")).toEqual(list.rowItemComps[0][1].rectToScene);
            // An unrendered cell falls back to the list's own rect.
            expect(list.getSubBoundingRect("toScene", "item9_9")).toEqual(list.rectToScene);
        });
    }

    // A device reports the FOCUSED cell's sub-rect as the bare poster — the same rect it reports for a
    // non-focused cell. The focus 9-patch frame is drawn outset around the poster, and the list's OWN
    // boundingRect is outset by rectMargins, but neither reaches an item sub-rect. An outset used to be
    // subtracted here (the 9-patch's top margin, to make an overlay land on the poster); it was double
    // counting, silently cancelled by a rectToParent bug that dropped the rectMargins outset from the
    // base rect. This pins the un-outset result so the subtraction is not re-introduced.
    test("RowList reports the focused item's bare poster rect, not the focus-feedback footprint", () => {
        const list = new RowList();
        buildRowGrid(list);
        const focusedPoster = list.rowItemComps[1][2].rectToScene;

        for (const id of ["item1_2", "item1", "focusItem", "focusIndicator"]) {
            expect(list.getSubBoundingRect("toScene", id)).toEqual(focusedPoster);
        }

        // A non-focused cell reports its bare poster rect too — focus makes no difference.
        expect(list.getSubBoundingRect("toScene", "item0_0")).toEqual(list.rowItemComps[0][0].rectToScene);

        // Nothing about the focus feedback influences the reported rect: neither suppressing the drawn
        // frame nor clearing both focus bitmaps changes it.
        list.setValue("drawFocusFeedback", core.BrsBoolean.False);
        expect(list.getSubBoundingRect("toScene", "item1_2")).toEqual(focusedPoster);

        list.setValue("focusBitmapUri", new core.BrsString(""));
        list.setValue("focusFootprintBitmapUri", new core.BrsString(""));
        expect(list.getSubBoundingRect("toScene", "item1_2")).toEqual(focusedPoster);
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
            // subBoundingRect("item1") is {10,104} in the grid's parent (group) space; adding the
            // group's own parent-space offset {50,60} re-expresses it in the scene's coordinate system.
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
            // Not an ancestor: returns subBoundingRect("item1") unchanged (grid's parent space).
            expect(readRect(result)).toEqual({ x: 10, y: 104, width: 438, height: 72 });
        } finally {
            sgRoot.rendering = false;
        }
    });
});
