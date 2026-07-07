const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory } = scenegraph;
const { BrsDevice } = core;

/**
 * ZoomRowList zoom sizing: the focused row uses `rowZoomHeight` and must render LARGER than the
 * unfocused rows (which use `rowHeight`). When an app does not set these fields (as in the
 * living_room_devices sample), the node falls back to resolution-specific defaults. A regression
 * had the HD defaults swapped (base 214 / zoom 136), which made the focused row shrink instead of
 * grow. These defaults also back the item-height fallbacks in getRowMetrics.
 */
describe("ZoomRowList zoom defaults", () => {
    beforeAll(() => {
        // ZoomRowList resolves fonts/focus bitmap from the common: volume; mount it once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    test("HD zoom-height default is larger than the base row-height default", () => {
        // A bare node defaults to HD resolution (Group falls back to "HD").
        const node = SGNodeFactory.createNode("ZoomRowList");
        expect(node.defaultRowZoomHeight).toBeGreaterThan(node.defaultRowHeight);
    });
});
