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

    it("accepts a single-axis 9-patch (top stretch marker only, no left marker)", () => {
        // A horizontal pill: only the TOP row has a stretch marker (fixed rounded caps, stretch
        // center); the LEFT column is blank because the height is fixed. This must still be a valid
        // 9-patch — the missing axis is fully stretchable (0 fixed insets), so it scales uniformly.
        // Requiring both markers rejected it, and it then drew as a plain stretched bitmap that
        // scaled the black marker border into view (visible edge lines).
        const w = 20;
        const h = 12;
        const canvas = createCanvas(w, h);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgba(255, 255, 255, 1)";
        ctx.fillRect(1, 1, w - 2, h - 2);
        ctx.fillStyle = "rgba(0, 0, 0, 1)";
        // Top stretch marker spanning the middle (fixed caps of 8 on each side: content 1..18,
        // marker 9..10 => before/after = 8).
        ctx.fillRect(9, 0, 2, 1);
        // No left column marker. Content-padding markers on bottom/right (full content).
        ctx.fillRect(1, h - 1, w - 2, 1);
        ctx.fillRect(w - 1, 1, 1, h - 2);

        const bitmap = new RoBitmap(canvas.toBuffer("image/png"), "pkg:/images/hpill.9.png");

        expect(bitmap.ninePatch).toBe(true);
        expect(bitmap.getPatchSizes()).toEqual({
            left: 8,
            right: 8,
            // No left marker => the whole height is stretchable: top/bottom fixed insets are 0.
            top: 0,
            bottom: 0,
            margins: { left: 0, right: 0, top: 0, bottom: 0 },
        });
    });

    it("accepts semi-transparent marker pixels", () => {
        // Authored `.9.png`s ship semi-transparent markers — a palette entry of rgba(0,0,0,128) is
        // common, since some optimizers quantize the 1px border. Requiring fully opaque black made
        // the scan miss those edges, so the insets came out wrong and the asset drew pinched at the
        // ends with a bulging middle instead of a uniform bar.
        const size = 10;
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgba(255, 255, 255, 1)";
        ctx.fillRect(1, 1, size - 2, size - 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; // 50% alpha markers, not opaque
        ctx.fillRect(4, 0, 2, 1); // top stretch marker
        ctx.fillRect(0, 4, 1, 2); // left stretch marker

        const bitmap = new RoBitmap(canvas.toBuffer("image/png"), "pkg:/images/faint.9.png");

        expect(bitmap.ninePatch).toBe(true);
        // Content spans 1..8; marker at 4..5 => fixed insets of 3 on every side.
        expect(bitmap.getPatchSizes()).toEqual({
            left: 3,
            right: 3,
            top: 3,
            bottom: 3,
            margins: { left: 0, right: 0, top: 0, bottom: 0 },
        });
    });

    it("ignores black corner pixels shared between two edge markers", () => {
        // A marker only ever spans the content range, so a black CORNER belongs to no edge. Counting
        // one dragged the marker's first/last index onto the border and yielded a NEGATIVE inset,
        // which drawNinePatch turned into a center band overlapping the fixed corners. Assets that
        // mark two adjacent edges commonly share the corner pixel, so this is not a malformed asset.
        const size = 10;
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgba(255, 255, 255, 1)";
        ctx.fillRect(1, 1, size - 2, size - 2);
        ctx.fillStyle = "rgba(0, 0, 0, 1)";
        ctx.fillRect(4, 0, 2, 1); // top stretch marker
        ctx.fillRect(0, 4, 1, 2); // left stretch marker
        // Bottom padding marker running into BOTH bottom corners, and a right marker into the
        // bottom-right corner — the shared-corner case.
        ctx.fillRect(0, size - 1, size, 1);
        ctx.fillRect(size - 1, 1, 1, size - 1);

        const bitmap = new RoBitmap(canvas.toBuffer("image/png"), "pkg:/images/corners.9.png");

        expect(bitmap.ninePatch).toBe(true);
        const sizes = bitmap.getPatchSizes();
        // Every inset must be >= 0: a negative one is what produced the deformed render.
        for (const key of ["left", "right", "top", "bottom"]) {
            expect(sizes[key]).toBeGreaterThanOrEqual(0);
        }
        for (const key of ["left", "right", "top", "bottom"]) {
            expect(sizes.margins[key]).toBeGreaterThanOrEqual(0);
        }
        expect(sizes).toEqual({
            left: 3,
            right: 3,
            top: 3,
            bottom: 3,
            margins: { left: 0, right: 0, top: 0, bottom: 0 },
        });
    });

    it("draws a wide bar from a small 9-patch at uniform height", () => {
        // End-to-end shape of the deformed-progress-bar report: a small rounded-bar asset drawn much
        // wider than its source must paint a CONSTANT height across its stretched middle. Wrong
        // insets made the center band taller than the fixed ends — thin at the borders, bulging in
        // the middle.
        const size = 10;
        const src = createCanvas(size, size);
        const sctx = src.getContext("2d");
        sctx.fillStyle = "rgba(255, 255, 255, 1)";
        sctx.fillRect(1, 1, size - 2, size - 2);
        sctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        sctx.fillRect(4, 0, 2, 1);
        sctx.fillRect(0, 4, 1, 2);
        sctx.fillStyle = "rgba(0, 0, 0, 1)";
        sctx.fillRect(0, size - 1, size, 1); // bottom marker through both corners
        const bitmap = new RoBitmap(src.toBuffer("image/png"), "pkg:/images/bar.9.png");
        expect(bitmap.ninePatch).toBe(true);

        const { RoAssociativeArray, BrsString, Int32, BrsBoolean, IfDraw2D } = brs.types;
        const target = new RoBitmap(
            new RoAssociativeArray([
                { name: new BrsString("width"), value: new Int32(60) },
                { name: new BrsString("height"), value: new Int32(30) },
                { name: new BrsString("alphaEnable"), value: BrsBoolean.True },
            ])
        );
        const barHeight = 6;
        new IfDraw2D(target).drawNinePatch(bitmap, { x: 0, y: 0, width: 40, height: barHeight }, undefined, 1);

        const data = target.getContext().getImageData(0, 0, 60, 30).data;
        const paintedHeight = (x) => {
            let count = 0;
            for (let y = 0; y < 30; y++) {
                if (data[(x + y * 60) * 4 + 3] > 8) {
                    count++;
                }
            }
            return count;
        };
        // Sample across the stretched middle (past the 3px fixed caps on each end).
        for (let x = 4; x < 36; x++) {
            expect(paintedHeight(x)).toBe(barHeight);
        }
        // Nothing painted beyond the requested width.
        expect(paintedHeight(41)).toBe(0);
    });
});
