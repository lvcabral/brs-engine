const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsBoolean, BrsDevice, BrsString, Float, Int32, RoArray, Interpreter } = core;

/**
 * Regression: boundingRect() of an INVISIBLE ArrayGrid-derived node. On Roku, layout and
 * bounding rects are independent of visibility — an app assigns content to a still-hidden
 * MarkupGrid, sizes sibling background posters from its boundingRect(), and only then makes
 * the menu visible. The invisible hard skip in ArrayGrid.renderNode used to return before
 * any rect was computed, so the query reported 0x0 and the app-sized backgrounds got zero
 * width (and negative height), never showing. The extent is now derived arithmetically on
 * measurement passes — without creating item components or loading textures.
 */
describe("hidden grid bounding rect measurement", () => {
    let interpreter;

    beforeAll(() => {
        // MarkupGrid's font-typed defaults need the common: fonts; mount the common volume once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    function vector(values) {
        return new RoArray(values.map((v) => new Float(v)));
    }

    function buildHiddenGrid(childCount) {
        const scene = SGNodeFactory.createNode("Scene");
        const root = SGNodeFactory.createNode("Group");
        const grid = SGNodeFactory.createNode("MarkupGrid");
        grid.setValue("itemSize", vector([438, 100]));
        grid.setValue("itemSpacing", vector([0, 0]));
        grid.setValue("numRows", new Int32(8));
        grid.setValue("numColumns", new Int32(1));
        grid.setValue("itemComponentName", new BrsString("Group"));
        grid.setValue("translation", vector([33, 91]));
        grid.setValue("visible", BrsBoolean.False);
        const content = SGNodeFactory.createNode("ContentNode");
        for (let i = 0; i < childCount; i++) {
            content.appendChildToParent(SGNodeFactory.createNode("ContentNode"));
        }
        grid.setValue("content", content);
        root.appendChildToParent(grid);
        scene.appendChildToParent(root);
        return { scene, root, grid };
    }

    test("boundingRect() of a hidden MarkupGrid returns the itemSize-derived extent", () => {
        const { grid } = buildHiddenGrid(4);

        const rect = grid.getBoundingRect("toParent", interpreter);

        // A device reports a MarkupGrid's rect as exactly the laid-out item extent — no
        // focus-bitmap outset (an app-sized background poster must align flush with the items).
        expect(rect.width).toBe(438);
        expect(rect.height).toBe(4 * 100);
        expect(rect.x).toBe(33);
        expect(rect.y).toBe(91);
    });

    test("the measurement creates no item components", () => {
        const { grid } = buildHiddenGrid(4);

        grid.getBoundingRect("toParent", interpreter);

        expect(grid.itemComps.filter(Boolean)).toHaveLength(0);
    });

    test("rows are capped at numRows and spacing is included", () => {
        const { grid } = buildHiddenGrid(12);
        grid.setValue("itemSpacing", vector([0, 12]));

        const rect = grid.getBoundingRect("toParent", interpreter);

        expect(rect.height).toBe(8 * 100 + 7 * 12);
    });

    test("a hidden grid with no content still reports a zero rect", () => {
        const { grid } = buildHiddenGrid(0);

        const rect = grid.getBoundingRect("toParent", interpreter);

        expect(rect.width).toBe(0);
        expect(rect.height).toBe(0);
    });

    test("the hidden grid does not union into its parent's bounds", () => {
        const { root, grid } = buildHiddenGrid(4);

        grid.getBoundingRect("toParent", interpreter);

        expect(root.getBoundingRect("toParent").height).toBe(0);
    });

    test("frame draws (draw2D present) still skip the invisible grid entirely", () => {
        const { grid } = buildHiddenGrid(4);
        const calls = [];
        const draw2D = {
            drawNinePatch: (...args) => calls.push(args),
            doDrawScaledObject: (...args) => calls.push(args),
            doDrawRotatedBitmap: (...args) => calls.push(args),
        };

        grid.renderNode(interpreter, [0, 0], 0, 1, draw2D);

        expect(calls).toHaveLength(0);
        expect(grid.itemComps.filter(Boolean)).toHaveLength(0);
    });
});
