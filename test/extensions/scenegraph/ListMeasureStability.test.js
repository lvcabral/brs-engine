const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { MarkupList } = scenegraph;
const { BrsDevice, Int32, Float, RoArray } = core;

/**
 * Regression: a MarkupList's reported bounding rect must not depend on the list's focus state.
 * renderFocus re-derives hasNinePatch from whichever bitmap was drawn last (focus vs. footprint), so a
 * list with a 9-patch focus bitmap but a plain-image footprint reported a rect that grew while focused
 * and shrank when focus left — a LayoutGroup stacking siblings below the list visibly jumped as focus
 * moved. The outset is constant: 24/6 above and to the sides, 30 below at HD (DEVICE-MEASURED,
 * `test/simulator/probes/grid-rect-probe`, cases `ml_*`).
 */
describe("MarkupList measured extent is focus-independent", () => {
    beforeAll(() => {
        // MarkupList font-typed defaults need the common: fonts; mount once.
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    function vector(values) {
        return new RoArray(values.map((v) => new Float(v)));
    }

    /** Calls the protected updateRect with a fresh rect and returns the computed size. */
    function measure(list, numRows, itemSize) {
        const rect = { x: 0, y: 0, width: 0, height: 0 };
        list.updateRect(rect, numRows, itemSize);
        return rect;
    }

    test("the extent's outset does not depend on hasNinePatch", () => {
        // Mirrors a settings ratings menu: 6 rows of 560x80 with 8px between rows.
        const list = new MarkupList();
        list.setValue("numRows", new Int32(12));
        list.setValue("itemSpacing", vector([0, 8]));
        const itemSize = [560, 80];
        const expected = { width: 24 + 560 + 24, height: 6 + 6 * (80 + 8) + 30 };

        // Focused state: the 9-patch focus bitmap was drawn last (hasNinePatch = true).
        list.hasNinePatch = true;
        const focusedRect = measure(list, 6, itemSize);

        // Unfocused state: a plain-image footprint was drawn last (hasNinePatch = false).
        list.hasNinePatch = false;
        const unfocusedRect = measure(list, 6, itemSize);

        expect(focusedRect).toEqual({ x: -24, y: -6, ...expected });
        expect(unfocusedRect).toEqual(focusedRect);
    });
});
