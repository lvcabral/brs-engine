const { createCanvas } = require("canvas");
const brs = require("../../../packages/node/bin/brs.node");
const { RoBitmap, RoAssociativeArray, BrsString, Int32, BrsBoolean, IfDraw2D } = brs.types;

/**
 * Regression: a blend color of 0x00000000 (fully transparent black) painted as SOLID BLACK.
 *
 * `0` is the only 32-bit color whose entire packed value is falsy, so the truthiness guard in
 * `setContextAlpha` dropped its alpha — while `RoBitmap.getRgbaCanvas` deliberately multiplies the
 * RGB tint at full strength regardless of alpha (#935). With the only consumer of the blend alpha
 * skipped, the black tint blitted at globalAlpha 1. Any non-zero color (even 0x0000FF00, also fully
 * transparent) took the guard and vanished correctly — that asymmetry is what this pins.
 */
describe("blend color alpha", () => {
    /** A blank 40x40 scratch bitmap to draw into (or a solid source to draw from). */
    function scratchBitmap(alphaEnable = true) {
        const fields = [
            { name: new BrsString("width"), value: new Int32(40) },
            { name: new BrsString("height"), value: new Int32(40) },
        ];
        if (alphaEnable) {
            fields.push({ name: new BrsString("alphaEnable"), value: BrsBoolean.True });
        }
        return new RoBitmap(new RoAssociativeArray(fields));
    }

    /** Opaque-white 9-patch with single-pixel center stretch markers and no content margins. */
    function whiteNinePatch() {
        const size = 11;
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgba(255, 255, 255, 1)";
        ctx.fillRect(1, 1, size - 2, size - 2);
        ctx.fillStyle = "rgba(0, 0, 0, 1)";
        const center = (size - 1) / 2;
        ctx.fillRect(center, 0, 1, 1); // top stretch marker
        ctx.fillRect(0, center, 1, 1); // left stretch marker
        ctx.fillRect(1, size - 1, size - 2, 1); // bottom padding marker
        ctx.fillRect(size - 1, 1, 1, size - 2); // right padding marker
        const bitmap = new RoBitmap(canvas.toBuffer("image/png"), "pkg:/images/frame.9.png");
        expect(bitmap.ninePatch).toBe(true);
        return bitmap;
    }

    /** Encoded/decoded once: every case draws the same frame, only the blend color varies. */
    let ninePatch;
    beforeAll(() => {
        ninePatch = whiteNinePatch();
    });

    /** Draws the 9-patch over a 40x40 transparent target and returns the center pixel's RGBA. */
    function centerPixel(rgba, opacity) {
        const target = scratchBitmap();
        new IfDraw2D(target).drawNinePatch(ninePatch, { x: 0, y: 0, width: 40, height: 40 }, rgba, opacity);
        const data = target.getContext().getImageData(20, 20, 1, 1).data;
        return [data[0], data[1], data[2], data[3]];
    }

    it("draws nothing for a fully transparent blend color", () => {
        // Used to paint 0,0,0,255 — a solid black frame over whatever was already on screen.
        expect(centerPixel(0x00000000, 1)).toEqual([0, 0, 0, 0]);
    });

    it("still applies an opaque tint at full strength", () => {
        expect(centerPixel(0x0000ffff, 1)).toEqual([0, 0, 255, 255]);
    });

    it("keeps opaque black opaque", () => {
        expect(centerPixel(0x000000ff, 1)).toEqual([0, 0, 0, 255]);
    });

    it("applies a partially transparent tint proportionally", () => {
        const [r, g, b, a] = centerPixel(0x0000ff80, 1);
        expect([r, g, b]).toEqual([0, 0, 255]);
        expect(a).toBe(128);
    });

    it("folds the node opacity into an opaque blend color", () => {
        // The other direction of the same multiply: combineRgbaOpacity scales the color's alpha by the
        // node opacity before setContextAlpha sees it.
        const [r, g, b, a] = centerPixel(0x0000ffff, 0.5);
        expect([r, g, b]).toEqual([0, 0, 255]);
        expect(a).toBe(128);
    });

    /** A 4x4 source filled at the given alpha, for the tint-math cases below. */
    function translucentSource(alpha) {
        const canvas = createCanvas(4, 4);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = `rgba(200, 100, 50, ${alpha})`;
        ctx.fillRect(0, 0, 4, 4);
        return new RoBitmap(canvas.toBuffer("image/png"), "pkg:/images/soft.png");
    }

    /** Blits `source` 1:1 into a scratch bitmap and returns the center pixel. */
    function blit(source, rgba, opacity, cropped = true) {
        const target = scratchBitmap();
        const rect = { x: 0, y: 0, width: 4, height: 4 };
        if (cropped) {
            new IfDraw2D(target).doDrawCroppedBitmap(source, rect, rect, rgba, opacity);
        } else {
            new IfDraw2D(target).doDrawScaledObject(0, 0, 1, 1, source, rgba, opacity);
        }
        const data = target.getContext().getImageData(1, 1, 1, 1).data;
        return [data[0], data[1], data[2], data[3]];
    }

    // `getRgbaCanvas` used to tint via `globalCompositeOperation = "multiply"`, which is the W3C BLEND
    // formula: over a semi-transparent backdrop it drags the result toward the tint by (1-alpha) rather
    // than multiplying by it. Opaque white was therefore not an identity, and only the caller's "the
    // default means no blend" guard kept that from being visible on every antialiased edge.
    it.each([1, 0.75, 0.5, 0.25])("an opaque-white blend color is an identity at source alpha %s", (alpha) => {
        const source = translucentSource(alpha);
        // Was 226,178,152 vs 198,98,48 at alpha 0.5 — a whole-hue shift, not rounding.
        expect(blit(source, 0xffffffff, 1)).toEqual(blit(source, undefined, 1));
        // The `-1` the field actually stores must behave identically to the documented spelling.
        expect(blit(source, -1, 1)).toEqual(blit(source, undefined, 1));
    });

    /**
     * Channel-wise comparison with a tolerance, because a blit through a premultiplied canvas
     * round-trips each channel and can land +/-2 off. The defects this file pins are tens of levels
     * wide (+29,+77,+103 and 114-vs-99), so a tight-but-not-exact bound still catches them.
     */
    function expectChannels(actual, expected) {
        for (const [i, channel] of expected.entries()) {
            expect(Math.abs(actual[i] - channel)).toBeLessThanOrEqual(3);
        }
    }

    it("applies a real tint as a true per-channel multiply", () => {
        // Half-strength grey must HALVE the channels. The blend formula returned 114,88,76 here —
        // lighter than the source it was supposedly darkening.
        const tinted = blit(translucentSource(0.5), 0x808080ff, 1);
        const [sr, sg, sb] = blit(translucentSource(0.5), undefined, 1);
        expectChannels(tinted, [sr / 2, sg / 2, sb / 2]);
        expect(tinted[0]).toBeLessThan(sr);
    });

    it("fades without tinting when only an opacity is given", () => {
        // `combineRgbaOpacity` fabricated opaque white as a base whenever an opacity was given, which
        // re-injected the sentinel the caller had just resolved away: every fade of an image with soft
        // edges took the tint path and faded toward WHITE (measured drift +29,+77,+103).
        const source = translucentSource(0.5);
        const full = blit(source, undefined, 1, false);
        const faded = blit(source, undefined, 0.5, false);
        expectChannels(faded, full.slice(0, 3));
        expectChannels([faded[3]], [full[3] / 2]);
    });

    it("treats a NaN blend color as no tint rather than drawing nothing", () => {
        // NaN reached `setContextAlpha`, where `NaN & 255` is 0 -> globalAlpha 0 -> an invisible draw,
        // while `getCanvasFromDraw2d` independently decided to skip the tint. The predicates disagreed.
        const source = translucentSource(1);
        expect(blit(source, NaN, 1)).toEqual(blit(source, undefined, 1));
    });

    it("does not leak globalAlpha to later draws on the same canvas", () => {
        // globalAlpha is PERSISTENT canvas state, and drawObjectToComponent — reached from every
        // RoBitmap/RoScreen/RoRegion/RoCompositor drawImage — sets it from the blend color. Now that
        // alpha 0 is honored, a leak would blank every later draw on the canvas rather than merely tint
        // it, so the reset lives at that shared choke point instead of in each caller.
        const target = scratchBitmap();
        const source = scratchBitmap(false);
        source.clearCanvas(0xffffffff | 0);

        target.drawImage(source, 0, 0, 1, 1, 0x00000000); // fully transparent blend
        target.drawImage(source, 0, 0, 1, 1); // untinted, must land fully opaque

        const data = target.getContext().getImageData(20, 20, 1, 1).data;
        expect([data[0], data[1], data[2], data[3]]).toEqual([255, 255, 255, 255]);
    });
});
