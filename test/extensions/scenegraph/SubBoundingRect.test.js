const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, Group, MarkupGrid, ContentNode, sgRoot } = scenegraph;
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

        group.rectToParent = { x: 50, y: 60, width: 500, height: 900 };
        grid.rectToParent = { x: 10, y: 20, width: 438, height: 800 };
        grid.rectLocal = { x: 0, y: 0, width: 438, height: 800 };
        grid.rectToScene = { x: 100, y: 200, width: 438, height: 800 };

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
