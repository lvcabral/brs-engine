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
