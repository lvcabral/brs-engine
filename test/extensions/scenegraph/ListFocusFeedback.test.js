const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, Int32 } = core;

describe("LabelList focus feedback rendering", () => {
    beforeAll(() => {
        // The default focus bitmap (common:/images/focus_list.9.png) lives in the common: volume.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    // Regression for #970: a short list row must hug the focus frame using the grid's marginX/marginY,
    // NOT the 9-patch's own 19px content margins (which made the frame overflow into neighbouring rows).
    test("hugs the short row via marginX/marginY, not the 9-patch content margins, and keeps the blend color", () => {
        const list = SGNodeFactory.createNode("LabelList"); // focus_list.9.png, hasNinePatch
        const purple = 0x7b2ff7ff | 0;
        list.setValue("focusBitmapBlendColor", new Int32(purple));

        const calls = [];
        const draw2D = {
            drawNinePatch: (bmp, rect, rgba, opacity) => calls.push({ rect: { ...rect }, rgba }),
        };

        // Default LabelList itemSize height is short (48px HD / 72px FHD).
        const itemRect = { x: 100, y: 100, width: 340, height: 48 };
        list.renderFocus(itemRect, 1, true, draw2D);

        expect(calls).toHaveLength(1);
        // Blend color still reaches the draw (shared with the grid path).
        expect(calls[0].rgba).toBe(list.getValueJS("focusBitmapBlendColor"));

        // Outset is the grid's marginX/marginY, not the 9-patch's 19px content margins.
        const mx = list.marginX;
        const my = list.marginY;
        // The reported regression was vertical (too-tall frame): marginY is tighter than the
        // 9-patch's 19px content margin, so the row hugs instead of overflowing its neighbours.
        expect(my).toBeLessThan(19);
        expect(calls[0].rect.x).toBe(itemRect.x - mx);
        expect(calls[0].rect.y).toBe(itemRect.y - my);
        expect(calls[0].rect.width).toBe(itemRect.width + mx * 2);
        expect(calls[0].rect.height).toBe(itemRect.height + my * 2);
    });
});
