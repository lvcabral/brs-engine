const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { Node, Group, MarkupGrid, ContentNode } = scenegraph;
const { BrsDevice } = core;

describe("ifSGNodeBoundingRect sub-part methods", () => {
    beforeAll(() => {
        // MarkupGrid's font-typed defaults need the common: fonts; mount the common volume once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    test("subBoundingRect/localSubBoundingRect/sceneSubBoundingRect are registered on nodes", () => {
        const node = new Node([], "Node");
        for (const method of ["subBoundingRect", "localSubBoundingRect", "sceneSubBoundingRect"]) {
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
