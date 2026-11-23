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

describe("RoBitmap tint cache", () => {
    const { RoAssociativeArray, BrsString, Int32, BrsBoolean, RoRegion } = brs.types;
    const RED = 0xff0000ff;
    const GREEN = 0x00ff00ff;
    const BLUE = 0x0000ffff;

    afterEach(() => {
        vi.useRealTimers();
    });

    function whiteBitmap(size = 8, height = size) {
        const bitmap = new RoBitmap(
            new RoAssociativeArray([
                { name: new BrsString("width"), value: new Int32(size) },
                { name: new BrsString("height"), value: new Int32(height) },
                { name: new BrsString("alphaEnable"), value: BrsBoolean.True },
            ])
        );
        bitmap.clearCanvas(0xffffffff);
        return bitmap;
    }

    function pixel(canvas, x = 0, y = 0) {
        return Array.from(canvas.getContext("2d").getImageData(x, y, 1, 1).data);
    }

    it("returns the right colour for each tint when tints alternate", () => {
        const bitmap = whiteBitmap();
        // A tinted canvas is drawn right away; it only has to hold until the next tint.
        for (let i = 0; i < 3; i++) {
            expect(pixel(bitmap.getRgbaCanvas(RED))).toEqual([255, 0, 0, 255]);
            expect(pixel(bitmap.getRgbaCanvas(GREEN))).toEqual([0, 255, 0, 255]);
            expect(pixel(bitmap.getRgbaCanvas(BLUE))).toEqual([0, 0, 255, 255]);
        }
    });

    it("reuses the tinted canvas when a tint comes back", () => {
        const bitmap = whiteBitmap();
        const first = bitmap.getRgbaCanvas(RED);
        bitmap.getRgbaCanvas(GREEN);
        expect(bitmap.getRgbaCanvas(RED)).toBe(first);
        expect(pixel(first)).toEqual([255, 0, 0, 255]);
    });

    it("re-tints every cached colour after the bitmap is drawn into", () => {
        const bitmap = whiteBitmap();
        bitmap.getRgbaCanvas(RED);
        bitmap.getRgbaCanvas(GREEN);
        // Grey source: every tint must now come out at half strength.
        bitmap.clearCanvas(0x808080ff);
        expect(pixel(bitmap.getRgbaCanvas(RED))).toEqual([128, 0, 0, 255]);
        expect(pixel(bitmap.getRgbaCanvas(GREEN))).toEqual([0, 128, 0, 255]);
        bitmap.makeDirty();
        bitmap.getContext().fillStyle = "#000000";
        bitmap.getContext().fillRect(0, 0, 8, 8);
        expect(pixel(bitmap.getRgbaCanvas(RED))).toEqual([0, 0, 0, 255]);
    });

    it("re-tints after a compositor draws into the bitmap", () => {
        const bitmap = whiteBitmap();
        bitmap.getRgbaCanvas(RED);
        const black = whiteBitmap();
        black.clearCanvas(0x000000ff);
        // roCompositor writes its sprites into the destination through drawImageToContext.
        bitmap.drawImageToContext(black.getCanvas(), 0, 0);
        expect(pixel(bitmap.getRgbaCanvas(GREEN))).toEqual([0, 0, 0, 255]);
        expect(pixel(bitmap.getRgbaCanvas(RED))).toEqual([0, 0, 0, 255]);
    });

    it("keeps tinting correctly past the cache size", () => {
        const bitmap = whiteBitmap();
        for (let i = 0; i < 600; i++) {
            const level = i % 256;
            const rgba = ((level << 24) | 0xff) >>> 0;
            expect(pixel(bitmap.getRgbaCanvas(rgba))).toEqual([level, 0, 0, 255]);
        }
    });

    function region(bitmap, x, y, width, height) {
        return new RoRegion(bitmap, new Int32(x), new Int32(y), new Int32(width), new Int32(height));
    }

    function countReads(bitmap) {
        const ctx = bitmap.getContext();
        const read = ctx.getImageData.bind(ctx);
        const counter = { reads: 0 };
        ctx.getImageData = (...args) => {
            counter.reads++;
            return read(...args);
        };
        return counter;
    }

    it("re-tints after a region of the bitmap is drawn tinted into it", () => {
        // Device-checked (test/simulator/probes/bitmap-tint-cache-probe, self.region).
        const bitmap = whiteBitmap(32, 16);
        bitmap.getContext().fillStyle = "#000000";
        bitmap.getContext().fillRect(16, 0, 16, 16);
        bitmap.makeDirty();
        expect(pixel(bitmap.getRgbaCanvas(GREEN))).toEqual([0, 255, 0, 255]);
        bitmap.drawImage(region(bitmap, 16, 0, 16, 16), 0, 0, 1, 1, RED);
        expect(pixel(bitmap.getCanvas())).toEqual([0, 0, 0, 255]);
        expect(pixel(bitmap.getRgbaCanvas(GREEN))).toEqual([0, 0, 0, 255]);
        expect(pixel(bitmap.getRgbaCanvas(RED))).toEqual([0, 0, 0, 255]);
    });

    it("shares one copy between blend colors that differ only in alpha", () => {
        const bitmap = whiteBitmap();
        const opaque = bitmap.getRgbaCanvas(RED);
        expect(bitmap.getRgbaCanvas(0xff000080)).toBe(opaque);
        expect(bitmap.getRgbaCanvas(0xff000000)).toBe(opaque);
        // BrightScript passes &hFF0000FF as a signed Integer.
        expect(bitmap.getRgbaCanvas(RED | 0)).toBe(opaque);
        expect(pixel(opaque)).toEqual([255, 0, 0, 255]);
    });

    it("keeps one copy of a bitmap larger than the cache budget", () => {
        const bitmap = whiteBitmap(2001, 2000);
        const counter = countReads(bitmap);
        const first = bitmap.getRgbaCanvas(RED);
        expect(bitmap.getRgbaCanvas(RED)).toBe(first);
        expect(counter.reads).toBe(1);
        bitmap.dispose();
    });

    it("keeps the source pixels only for a bitmap drawn with several tints", () => {
        const single = whiteBitmap();
        single.getRgbaCanvas(RED);
        single.getRgbaCanvas(RED);
        expect(single.tints.source).toBeUndefined();

        const multi = whiteBitmap();
        const counter = countReads(multi);
        multi.getRgbaCanvas(RED);
        multi.getRgbaCanvas(GREEN);
        expect(counter.reads).toBe(2);
        multi.makeDirty();
        multi.getRgbaCanvas(RED);
        multi.getRgbaCanvas(GREEN);
        multi.getRgbaCanvas(BLUE);
        expect(counter.reads).toBe(3);
        expect(pixel(multi.getRgbaCanvas(BLUE))).toEqual([0, 0, 255, 255]);
    });

    it("gives a tint its own copy only when it comes back", () => {
        const bitmap = whiteBitmap();
        bitmap.getRgbaCanvas(RED);
        // A colour animation: every tint is new.
        for (let level = 0; level < 100; level++) {
            expect(pixel(bitmap.getRgbaCanvas(((level << 16) | 0xff) >>> 0))).toEqual([0, level, 0, 255]);
        }
        expect(bitmap.tints.entries.size).toBe(1);
        const green = bitmap.getRgbaCanvas(GREEN);
        expect(bitmap.getRgbaCanvas(GREEN)).not.toBe(green);
        expect(bitmap.tints.entries.size).toBe(2);
        expect(bitmap.getRgbaCanvas(GREEN)).toBe(bitmap.getRgbaCanvas(GREEN));
    });

    it("releases idle copies and pixels, keeping the latest copy", () => {
        vi.useFakeTimers({ toFake: ["performance"] });
        const bitmap = whiteBitmap();
        for (let i = 0; i < 3; i++) {
            bitmap.getRgbaCanvas(RED);
            bitmap.getRgbaCanvas(GREEN);
        }
        expect(bitmap.tints.entries.size).toBe(2);
        expect(bitmap.tints.source).toBeDefined();
        vi.advanceTimersByTime(1500);
        // Any tinted draw sweeps the idle caches.
        whiteBitmap().getRgbaCanvas(RED);
        expect(bitmap.tints.entries.size).toBe(1);
        expect(bitmap.tints.scratch).toBeUndefined();
        expect(bitmap.tints.source).toBeUndefined();
        expect(pixel(bitmap.getRgbaCanvas(GREEN))).toEqual([0, 255, 0, 255]);
        expect(pixel(bitmap.getRgbaCanvas(RED))).toEqual([255, 0, 0, 255]);
    });

    it("frees idle copies on an untinted draw", () => {
        vi.useFakeTimers({ toFake: ["performance"] });
        const bitmap = whiteBitmap();
        for (let i = 0; i < 3; i++) {
            bitmap.getRgbaCanvas(RED);
            bitmap.getRgbaCanvas(GREEN);
        }
        expect(bitmap.tints.entries.size).toBe(2);
        vi.advanceTimersByTime(1500);
        whiteBitmap().drawImage(whiteBitmap(), 0, 0);
        expect(bitmap.tints.entries.size).toBe(1);
    });

    it("stops keeping the source pixels once the bitmap is tinted one way again", () => {
        const bitmap = whiteBitmap();
        bitmap.getRgbaCanvas(RED);
        bitmap.getRgbaCanvas(GREEN);
        bitmap.makeDirty();
        bitmap.getRgbaCanvas(RED);
        expect(bitmap.tints.source).toBeDefined();
        bitmap.makeDirty();
        bitmap.getRgbaCanvas(RED);
        expect(bitmap.tints.source).toBeUndefined();
    });

    it("re-tints at the new size when the surface is resized without being marked dirty", () => {
        const bitmap = whiteBitmap();
        bitmap.getRgbaCanvas(RED);
        bitmap.getRgbaCanvas(GREEN);
        const canvas = bitmap.getCanvas();
        canvas.width = 4;
        canvas.height = 4;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 4, 4);
        const blue = bitmap.getRgbaCanvas(BLUE);
        expect(blue.width).toBe(4);
        expect(pixel(blue, 3, 3)).toEqual([0, 0, 255, 255]);
        const red = bitmap.getRgbaCanvas(RED);
        expect(red.width).toBe(4);
        expect(pixel(red, 3, 3)).toEqual([255, 0, 0, 255]);
    });

    it("repaints an existing copy instead of adding a scratch canvas past the global budget", () => {
        const alternate = (bitmap) => {
            for (let i = 0; i < 3; i++) {
                bitmap.getRgbaCanvas(RED);
                bitmap.getRgbaCanvas(GREEN);
            }
        };
        // Each holds a scratch canvas and its source pixels: 2 x 4M of the 16M budget.
        const full = [whiteBitmap(2000), whiteBitmap(2000)];
        for (const bitmap of full) {
            alternate(bitmap);
            expect(bitmap.tints.scratch).toBeDefined();
        }
        const over = whiteBitmap(2000);
        alternate(over);
        expect(over.tints.scratch).toBeUndefined();
        expect(over.tints.source).toBeUndefined();
        expect(over.tints.entries.size).toBe(1);
        expect(pixel(over.getRgbaCanvas(GREEN))).toEqual([0, 255, 0, 255]);
        expect(pixel(over.getRgbaCanvas(RED))).toEqual([255, 0, 0, 255]);
        for (const bitmap of [...full, over]) {
            bitmap.dispose();
        }
    });
});
