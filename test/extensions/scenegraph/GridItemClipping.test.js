const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, Float, RoArray } = core;

/** Minimal interpreter accepted by renderNode → renderChildren. */
const fakeInterpreter = {};

function vector(values) {
    return new RoArray(values.map((v) => new Float(v)));
}

/**
 * Regression: on Roku, each ArrayGrid/MarkupGrid item is clipped to its cell (`itemSize`). Content
 * an item draws beyond its own width/height is not shown. Apps use this to collapse item content by
 * shrinking `itemSize` — e.g. the SGDEX-style vertical button bar whose title label is parked just
 * past the item's right edge (translation x == itemSize width) so only the icon shows until the bar
 * expands. The simulator used to render item components unclipped, so those labels always drew.
 */
describe("grid items are clipped to their cell", () => {
    beforeAll(() => {
        // Grids resolve fonts/focus bitmaps from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    function record() {
        const events = [];
        const draw2D = {
            pushClip: (rect) => events.push(["push", { ...rect }]),
            popClip: () => events.push(["pop"]),
            doDrawRotatedRect: (rect) => events.push(["draw", { ...rect }]),
        };
        return { events, draw2D };
    }

    test("wraps the item render in a clip equal to the item cell", () => {
        const grid = SGNodeFactory.createNode("MarkupGrid");
        const item = SGNodeFactory.createNode("Group");
        // A label-like child parked at the cell's right edge (x = itemSize width) — visible only once
        // the cell grows wider than 108.
        const label = SGNodeFactory.createNode("Rectangle");
        label.setValue("width", new Float(80));
        label.setValue("height", new Float(20));
        label.setValue("translation", vector([108, 0]));
        item.appendChildToParent(label);

        const { events, draw2D } = record();
        const itemRect = { x: 0, y: 0, width: 108, height: 52 };
        grid.renderItemClipped(fakeInterpreter, item, [0, 0], itemRect, 0, 1, draw2D);

        // A clip equal to the item cell is pushed first and popped last...
        expect(events[0]).toEqual(["push", { x: 0, y: 0, width: 108, height: 52 }]);
        expect(events[events.length - 1]).toEqual(["pop"]);
        // ...and the child draw happens while that clip is active (between the push and the pop).
        const drawIdx = events.findIndex((e) => e[0] === "draw");
        expect(drawIdx).toBeGreaterThan(0);
        expect(drawIdx).toBeLessThan(events.length - 1);
    });

    test("a measurement pass (no draw2D) is not clipped so bounding rects still compute", () => {
        const grid = SGNodeFactory.createNode("MarkupGrid");
        const item = SGNodeFactory.createNode("Group");
        const label = SGNodeFactory.createNode("Rectangle");
        label.setValue("width", new Float(80));
        label.setValue("height", new Float(20));
        label.setValue("translation", vector([108, 0]));
        item.appendChildToParent(label);

        const itemRect = { x: 0, y: 0, width: 108, height: 52 };
        // No draw2D → the label is laid out (measured) beyond the cell without being clipped.
        grid.renderItemClipped(fakeInterpreter, item, [0, 0], itemRect, 0, 1, undefined);

        const rect = item.getBoundingRect("toScene");
        // The label is laid out at its true position beyond the 108-wide cell, not clipped away.
        expect(rect.x).toBe(108);
        expect(rect.width).toBe(80);
    });
});
