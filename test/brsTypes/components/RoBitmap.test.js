const fs = require("fs");
const path = require("path");
const { createCanvas } = require("canvas");
const brs = require("../../../packages/node/bin/brs.node");
const { RoBitmap } = brs.types;

describe("RoBitmap 9-patch parsing", () => {
    it("flags non 9-patch bitmaps and returns no patch sizes", () => {
        const canvas = createCanvas(4, 4);
        const bitmap = new RoBitmap(canvas.toBuffer("image/png"), "pkg:/images/plain.png");

        expect(bitmap.ninePatch).toBe(false);
        expect(bitmap.getPatchSizes()).toBeUndefined();
    });

    it("parses asymmetric stretch markers and content margins (inputField.9.png)", () => {
        const fixture = path.join(__dirname, "../../../src/extensions/scenegraph/common/images/inputField.9.png");
        const bitmap = new RoBitmap(fs.readFileSync(fixture), "pkg:/images/inputField.9.png");

        expect(bitmap.ninePatch).toBe(true);
        // 75x75 image; top marker x:[12,63], left marker y:[13,61] => asymmetric left(11) != right(10)
        // bottom/right padding markers span 25..49 => margins of 24 on every side.
        expect(bitmap.getPatchSizes()).toEqual({
            left: 11,
            right: 10,
            top: 12,
            bottom: 12,
            margins: { left: 24, right: 24, top: 24, bottom: 24 },
        });
    });

    it("parses a single-pixel center marker (pill-style) keeping the caps fixed", () => {
        // 11x11 image: stretch marker is a single pixel at the center of the top row / left column,
        // padding markers span the full content edge (margins of 0) - the pill_button layout.
        const size = 11;
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgba(0, 0, 0, 1)";
        const center = (size - 1) / 2; // 5
        ctx.fillRect(center, 0, 1, 1); // top stretch marker (single pixel)
        ctx.fillRect(0, center, 1, 1); // left stretch marker (single pixel)
        ctx.fillRect(1, size - 1, size - 2, 1); // bottom padding marker (full content)
        ctx.fillRect(size - 1, 1, 1, size - 2); // right padding marker (full content)

        const bitmap = new RoBitmap(canvas.toBuffer("image/png"), "pkg:/images/pill.9.png");

        expect(bitmap.ninePatch).toBe(true);
        // content length = 9; marker at index 5 => fixed inset 4 on each side, center stretch = 1.
        expect(bitmap.getPatchSizes()).toEqual({
            left: 4,
            right: 4,
            top: 4,
            bottom: 4,
            margins: { left: 0, right: 0, top: 0, bottom: 0 },
        });
    });
});
