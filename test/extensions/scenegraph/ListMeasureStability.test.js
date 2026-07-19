const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { MarkupList } = scenegraph;
const { BrsDevice, Int32, Float, RoArray } = core;

/**
 * Regression: a MarkupList's reported bounding rect must be exactly the laid-out item extent
 * (rows of itemSize plus spacing), with NO focus-bitmap outset, and must not depend on the
 * list's focus state. renderFocus re-derives hasNinePatch from whichever bitmap was drawn last
 * (focus vs. footprint), so a list with a 9-patch focus bitmap but a plain-image footprint
 * (e.g. a transparent placeholder) reported a rect that grew by the margin outset while focused
 * and shrank when focus left — a LayoutGroup stacking siblings below the list (a label/button
 * section) visibly jumped as focus moved between the list and the section below it.
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

    test("the extent has no focus-bitmap outset regardless of hasNinePatch", () => {
        // Mirrors a settings ratings menu: 6 rows of 560x80 with 8px between rows.
        const list = new MarkupList();
        list.setValue("numRows", new Int32(12));
        list.setValue("itemSpacing", vector([0, 8]));
        const itemSize = [560, 80];
        const expected = { width: 560, height: 6 * 80 + 5 * 8 };

        // Focused state: the 9-patch focus bitmap was drawn last (hasNinePatch = true).
        list.hasNinePatch = true;
        const focusedRect = measure(list, 6, itemSize);

        // Unfocused state: a plain-image footprint was drawn last (hasNinePatch = false).
        list.hasNinePatch = false;
        const unfocusedRect = measure(list, 6, itemSize);

        expect(focusedRect).toEqual({ x: 0, y: 0, ...expected });
        expect(unfocusedRect).toEqual(focusedRect);
    });
});
