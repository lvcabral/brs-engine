const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot, getBrsValueFromFieldType, ComponentDefinition } = scenegraph;
const { BrsDevice, BrsBoolean, BrsString, Int32, Interpreter } = core;

/**
 * `subBoundingRect("item<row>_<col>")` on a row-based grid reports the ITEM COMPONENT's own rect —
 * the bare poster — in every coordinate space. Three separate outsets meet on this path and only two
 * of them are real:
 *
 *   1. `rectMargins()` -> `ArrayGrid.updateRect` outsets THE GRID's own reported rect by
 *      marginX/marginY (device-measured; see PosterGridExtent.test.js and Group.updateBoundingRects).
 *   2. `focusMargins()` -> `ArrayGrid.renderFocus` outsets THE DRAWN 9-patch focus frame by the
 *      bitmap's declared content margins. Paint only — nothing reports it.
 *   3. An ITEM sub-rect gets NEITHER.
 *
 * (1) does not leak into (3) only because `Node.getSubBoundingRect` computes
 * `base.y + (subScene.y - this.rectToScene.y)` and `base` (rectToParent/rectLocal) and `rectToScene`
 * carry the outset identically, so it cancels. A `rectToParent` bug used to drop it from `base`,
 * leaving a `+marginY` residue — which in turn hid a `-focusMargins().top` subtraction that had been
 * added to `RowList.getSubBoundingRect`. The two cancelled for one particular focus bitmap and read
 * as correct; fixing the residue surfaced the double subtraction as a focused-item overlay drawn one
 * focus margin too high.
 *
 * This file therefore pins the COMPOSITION, not any single mechanism: SubBoundingRect.test.js works
 * on injected rects, so it cannot catch a drift between the outset a grid applies to itself and the
 * cancellation that keeps it out of an item rect. Everything here goes through a real render.
 */
describe("row grids report an item sub-rect as the bare item component", () => {
    let interpreter;

    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    beforeEach(() => {
        interpreter = new Interpreter();
        // ZoomRowList refuses to render without a resolvable custom itemComponentName
        // (validateRenderPrerequisites -> customNodeExists), so register a minimal one. It extends
        // Rectangle rather than Group so it fills the cell the grid sizes it to — a bare Group has no
        // geometry of its own and would report a degenerate (zero-sized) rect, which every assertion
        // below would then pass trivially.
        const def = new ComponentDefinition("pkg:/components/SubRectItem.xml");
        def.name = "SubRectItem";
        def.xmlNode = { attr: { name: "SubRectItem", extends: "Rectangle" } };
        sgRoot.setNodeDefMap(new Map([["subrectitem", def]]));
    });

    afterEach(() => {
        sgRoot.setFocused();
        sgRoot.setNodeDefMap(new Map());
    });

    /** Two rows of three items. */
    function buildContent() {
        const root = SGNodeFactory.createNode("ContentNode");
        for (let r = 0; r < 2; r++) {
            const row = SGNodeFactory.createNode("ContentNode");
            for (let c = 0; c < 3; c++) {
                const item = SGNodeFactory.createNode("ContentNode");
                item.setValue("title", new BrsString(`R${r}C${c}`));
                row.appendChildToParent(item);
            }
            root.appendChildToParent(row);
        }
        return root;
    }

    /**
     * Creates and renders a row grid at the given resolution. The node type's margins are read in its
     * constructor, so the scene's resolution must be set BEFORE the node is created (poking
     * `sgRoot._resolution` does not work).
     */
    function renderGrid(type, resolution, translation, options = {}) {
        const previousScene = sgRoot.scene;
        const scene = SGNodeFactory.createNode("Scene");
        sgRoot.setScene(scene);
        scene.setResolution(resolution);
        try {
            const grid = SGNodeFactory.createNode(type);
            grid.setValue("itemComponentName", new BrsString("SubRectItem"));
            grid.setValue("numRows", new Int32(2));
            grid.setValue("translation", getBrsValueFromFieldType("vector2d", `[${translation.join(",")}]`));
            grid.setValue("itemSize", getBrsValueFromFieldType("vector2d", "[300,200]"));
            grid.setValue("itemSpacing", getBrsValueFromFieldType("vector2d", "[0,0]"));
            if (type === "RowList") {
                grid.setValue("rowItemSize", getBrsValueFromFieldType("vector2darray", "[[300,200]]"));
            }
            for (const [name, value] of Object.entries(options)) {
                grid.setValue(name, value);
            }
            grid.setValue("content", buildContent());
            // Focus row 0 / col 1. Both node types are fixed-focus: the focused row is laid out AT the
            // focus band, so focusing row 1 would scroll row 0 out of a 2-row window and leave it with
            // no item components to compare against.
            grid.setValue("jumpToRowItem", getBrsValueFromFieldType("intarray", "[0,1]"));
            grid.setNodeFocus(true);

            // Records the 9-patch focus frames; every other draw/clip call is a no-op.
            const frames = [];
            const draw2D = new Proxy(
                {},
                {
                    get: (_t, prop) => (prop === "drawNinePatch" ? (_bmp, rect) => frames.push({ ...rect }) : () => 0),
                }
            );
            grid.renderNode(interpreter, [0, 0], 0, 1, draw2D);
            return { grid, frames };
        } finally {
            sgRoot.setScene(previousScene ?? SGNodeFactory.createNode("Scene"));
        }
    }

    const round = (rect) => ({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
    });

    for (const resolution of ["HD", "FHD"]) {
        for (const type of ["RowList", "ZoomRowList"]) {
            for (const translation of [
                [0, 0],
                [100, 300],
            ]) {
                const label = `${type} @ ${resolution} at [${translation}]`;

                test(`${label}: an item sub-rect is the item component's own rect in all three spaces`, () => {
                    const { grid } = renderGrid(type, resolution, translation);
                    // The focused cell (row 0 / col 1) and non-focused ones; the focused cell is the
                    // case an outset was once applied to, so all of them must agree.
                    for (const [id, item] of [
                        ["item0_0", grid.rowItemComps[0][0]],
                        ["item1_1", grid.rowItemComps[1][1]],
                        ["item0_1", grid.rowItemComps[0][1]],
                        ["focusItem", grid.rowItemComps[0][1]],
                        ["focusIndicator", grid.rowItemComps[0][1]],
                    ]) {
                        expect(item).toBeDefined();
                        const poster = round(item.rectToScene);
                        // A degenerate item rect would satisfy everything below vacuously.
                        expect(poster.width).toBeGreaterThan(0);
                        expect(poster.height).toBeGreaterThan(0);
                        expect(round(grid.getSubBoundingRect("toScene", id, interpreter))).toEqual(poster);
                        expect(round(grid.getSubBoundingRect("toParent", id, interpreter))).toEqual(poster);
                        // Local space is parent space minus the node's own translation.
                        expect(round(grid.getSubBoundingRect("local", id, interpreter))).toEqual({
                            ...poster,
                            x: poster.x - translation[0],
                            y: poster.y - translation[1],
                        });
                    }
                });

                test(`${label}: the focus bitmap does not influence the reported item rect`, () => {
                    const withFocus = renderGrid(type, resolution, translation);
                    const focused = round(withFocus.grid.getSubBoundingRect("toScene", "focusItem", interpreter));

                    // Suppressing the drawn frame changes nothing...
                    const noDraw = renderGrid(type, resolution, translation, {
                        drawFocusFeedback: BrsBoolean.False,
                    });
                    expect(round(noDraw.grid.getSubBoundingRect("toScene", "focusItem", interpreter))).toEqual(focused);

                    // ...and neither does removing the focus bitmaps entirely. This forecloses
                    // re-deriving any part of the reported rect from the 9-patch's margins.
                    const noBitmap = renderGrid(type, resolution, translation, {
                        focusBitmapUri: new BrsString(""),
                        focusFootprintBitmapUri: new BrsString(""),
                    });
                    expect(round(noBitmap.grid.getSubBoundingRect("toScene", "focusItem", interpreter))).toEqual(
                        focused
                    );
                });

                // Only RowList reports its own extent (renderContent -> updateRect). ZoomRowList never
                // calls updateRect, so its own rect stays zero-sized — a separate, pre-existing gap.
                const ownRectTest = type === "RowList" ? test : test.skip;
                ownRectTest(`${label}: the grid's OWN rect stays outset by marginX/marginY`, () => {
                    // The counterpart of the assertion above: the grid's own reported rect IS outset
                    // (device-measured), so "the item rect carries no outset" must not be achieved by
                    // dropping the grid's outset — which is how a revert of that fix would look.
                    const { grid } = renderGrid(type, resolution, translation);
                    const own = round(grid.getBoundingRect("toParent", interpreter));
                    const firstItem = round(grid.rowItemComps[0][0].rectToScene);
                    expect(grid.marginX).toBeGreaterThan(0);
                    expect(grid.marginY).toBeGreaterThan(0);
                    expect(own.x).toBe(firstItem.x - grid.marginX);
                    expect(own.y).toBe(firstItem.y - grid.marginY);
                });

                test(`${label}: the DRAWN focus frame is outset even though the reported rect is not`, () => {
                    // What made the double subtraction plausible: the painted frame really does sit
                    // above the poster. It is drawn geometry, not reported geometry — the two are
                    // allowed (required) to differ, so do not "correct" one to match the other.
                    const { grid, frames } = renderGrid(type, resolution, translation);
                    const poster = round(grid.rowItemComps[0][1].rectToScene);
                    const bmp = grid.getBitmap("focusBitmapUri");
                    expect(bmp?.isValid()).toBe(true);
                    const margins = grid.focusMargins(bmp);
                    expect(margins.top).toBeGreaterThan(0);

                    const frame = frames.find(
                        (f) => Math.round(f.x) === poster.x - margins.left && Math.round(f.y) === poster.y - margins.top
                    );
                    expect(frame).toBeDefined();
                    expect(Math.round(frame.width)).toBe(poster.width + margins.left + margins.right);
                    expect(Math.round(frame.height)).toBe(poster.height + margins.top + margins.bottom);

                    // ...and the reported rect for that same cell is still the bare poster.
                    expect(round(grid.getSubBoundingRect("toScene", "focusItem", interpreter))).toEqual(poster);
                });
            }
        }
    }
});
