const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, Int32 } = core;

describe("ArrayGrid focus feedback rendering", () => {
    beforeAll(() => {
        // The default focus bitmap (common:/images/focus_grid.9.png) lives in the common: volume.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    test("tints the focus bitmap with focusBitmapBlendColor and hugs the item via 9-patch margins", () => {
        const grid = SGNodeFactory.createNode("RowList"); // sets focusBitmapUri=focus_grid.9.png, hasNinePatch
        const purple = 0x7b2ff7ff | 0;
        grid.setValue("focusBitmapBlendColor", new Int32(purple));

        // Record the 9-patch draw (focusRect + blend color). drawImage routes 9-patch draws here.
        const calls = [];
        const draw2D = {
            drawNinePatch: (bmp, rect, rgba, opacity) => calls.push({ rect: { ...rect }, rgba }),
        };

        const itemRect = { x: 100, y: 100, width: 300, height: 300 };
        grid.renderFocus(itemRect, 1, true, draw2D);

        expect(calls).toHaveLength(1);
        // Color: the purple blend color must reach the draw call (it used to be dropped → white).
        expect(calls[0].rgba).toBe(grid.getValueJS("focusBitmapBlendColor"));
        // Gap: the frame is inset by the 9-patch content margins (19px), not the larger marginX/Y.
        expect(calls[0].rect.x).toBe(81);
        expect(calls[0].rect.y).toBe(81);
        expect(calls[0].rect.width).toBe(338);
        expect(calls[0].rect.height).toBe(338);
    });
});
