const brs = require("../../../packages/node/bin/brs.node");
const UPNG = require("@lvcabral/upng");
const zlib = require("node:zlib");
const { createCanvas } = require("canvas");
const {
    RoBitmap,
    RoScreen,
    RoRegion,
    RoAssociativeArray,
    BrsString,
    BrsInvalid,
    Int32,
    Float,
    BrsBoolean,
    IfDraw2D,
    RectRect,
    RectCircle,
    CircleCircle,
    rgbaToTransparent,
    rgbaToOpaque,
    rgbaIntToHex,
    getDimensions,
    getDrawOffset,
    Dimensions,
    DrawOffset,
    drawObjectToComponent,
    drawBitmapOnBitmap,
    drawRotatedObject,
    createNewCanvas,
    releaseCanvas,
    drawImageAtPos,
    putImageAtPos,
    drawCanvasRegion,
} = brs.types;
const { Interpreter } = brs;

// BrightScript &hFF0000FF literals are two's-complement Int32s, not the plain positive JS number:
// `new Int32(0xff0000ff)` alone would clamp to Int32's max value (RBI truncation), not wrap.
function rgba(value) {
    return new Int32(value | 0);
}

function makeBitmap(width, height, alphaEnable) {
    return new RoBitmap(
        new RoAssociativeArray([
            { name: new BrsString("width"), value: new Int32(width) },
            { name: new BrsString("height"), value: new Int32(height) },
            { name: new BrsString("alphaEnable"), value: alphaEnable ? BrsBoolean.True : BrsBoolean.False },
        ])
    );
}

function pixelAt(ctx, width, x, y) {
    const data = ctx.getImageData(0, 0, width, ctx.canvas.height).data;
    const i = (x + y * width) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

describe("IfDraw2D", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    describe("geometry and color helpers", () => {
        it("RectRect detects overlap but not mere edge-touching", () => {
            expect(RectRect({ x: 0, y: 0, width: 5, height: 5 }, { x: 4, y: 4, width: 5, height: 5 })).toBe(true);
            expect(RectRect({ x: 0, y: 0, width: 5, height: 5 }, { x: 10, y: 10, width: 5, height: 5 })).toBe(false);
            expect(RectRect({ x: 0, y: 0, width: 5, height: 5 }, { x: 5, y: 0, width: 5, height: 5 })).toBe(false);
        });

        it("RectCircle detects containment, corner overlap, and misses", () => {
            const rect = { x: 0, y: 0, width: 10, height: 10 };
            expect(RectCircle(rect, { x: 5, y: 5, r: 1 })).toBe(true);
            expect(RectCircle(rect, { x: 100, y: 100, r: 1 })).toBe(false);
            expect(RectCircle(rect, { x: -3, y: -3, r: 5 })).toBe(true);
            expect(RectCircle(rect, { x: -5, y: -5, r: 5 })).toBe(false);
        });

        it("CircleCircle detects overlap and separation", () => {
            expect(CircleCircle({ x: 0, y: 0, r: 5 }, { x: 5, y: 0, r: 5 })).toBe(true);
            expect(CircleCircle({ x: 0, y: 0, r: 5 }, { x: 20, y: 0, r: 5 })).toBe(false);
        });

        it("rgbaToTransparent zeroes the alpha byte, rgbaToOpaque forces it to 0xff", () => {
            expect(rgbaToTransparent(0x11223344)).toBe(0x11223300);
            expect(rgbaToOpaque(0x11223300)).toBe(0x112233ff);
        });

        it("rgbaIntToHex packs RRGGBBAA, forcing opaque only when alpha=false", () => {
            expect(rgbaIntToHex(0xff0000ff)).toBe("#ff0000ff");
            expect(rgbaIntToHex(0x11223344, true)).toBe("#11223344");
            expect(rgbaIntToHex(0x11223344, false)).toBe("#112233ff");
        });

        it("Dimensions/DrawOffset are plain value holders", () => {
            const dims = new Dimensions(12, 34);
            expect(dims.width).toBe(12);
            expect(dims.height).toBe(34);
            const offset = new DrawOffset();
            expect(offset.x).toBe(0);
            expect(offset.y).toBe(0);
        });

        it("getDimensions/getDrawOffset default to size/zero for a plain bitmap", () => {
            const bmp = makeBitmap(20, 15, true);
            expect(getDimensions(bmp)).toEqual(new Dimensions(20, 15));
            expect(getDrawOffset(bmp)).toEqual({ x: 0, y: 0 });
        });

        it("getDimensions/getDrawOffset report a region's own rect and position", () => {
            const bmp = makeBitmap(20, 15, true);
            const region = new RoRegion(bmp, new Int32(3), new Int32(4), new Int32(5), new Int32(6));
            expect(getDimensions(region)).toEqual(new Dimensions(5, 6));
            expect(getDrawOffset(region)).toEqual({ x: 3, y: 4 });
        });
    });

    describe("drawRect", () => {
        it("fills only the requested rectangle with the given color", () => {
            const bmp = makeBitmap(10, 10, true);
            const result = bmp
                .getMethod("drawRect")
                .call(interpreter, new Int32(2), new Int32(2), new Int32(4), new Int32(4), rgba(0xff0000ff));
            expect(result).toBe(BrsBoolean.True);
            const ctx = bmp.getContext();
            expect(pixelAt(ctx, 10, 3, 3)).toEqual([255, 0, 0, 255]);
            expect(pixelAt(ctx, 10, 0, 0)).toEqual([0, 0, 0, 0]);
        });

        it("replaces (does not blend with) prior content on a non-alpha RoScreen", () => {
            const screen = new RoScreen(BrsBoolean.False, new Int32(20), new Int32(20));
            screen.getMethod("clear").call(interpreter, rgba(0x0000ffff));
            // A semi-transparent red drawn over the opaque blue background: on a normal alpha-enabled
            // surface this would blend toward purple. On a non-alpha RoScreen it clears first, so the
            // result is red at the color's own alpha over a now-transparent background, not a blend.
            screen
                .getMethod("drawRect")
                .call(interpreter, new Int32(2), new Int32(2), new Int32(4), new Int32(4), rgba(0xff000080));
            const ctx = screen.getContext();
            expect(pixelAt(ctx, 20, 3, 3)).toEqual([255, 0, 0, 128]);
            expect(pixelAt(ctx, 20, 0, 0)).toEqual([0, 0, 255, 255]);
        });

        // Regression (#1351): with alpha blending off, a device replaces the pixels with the RGBA given,
        // alpha included — on an roBitmap too, not only an roScreen. It used to paint the color opaque.
        it("keeps the color's alpha on a non-alpha RoBitmap, replacing prior content", () => {
            const bmp = makeBitmap(4, 4, false);
            bmp.getMethod("clear").call(interpreter, rgba(0xffffff00));
            bmp.getMethod("drawRect").call(
                interpreter,
                new Int32(0),
                new Int32(0),
                new Int32(4),
                new Int32(4),
                rgba(0xffffff40)
            );
            expect(pixelAt(bmp.getContext(), 4, 1, 1)).toEqual([255, 255, 255, 64]);

            // A second, more transparent rect replaces rather than blends over the first.
            bmp.getMethod("drawRect").call(
                interpreter,
                new Int32(1),
                new Int32(1),
                new Int32(2),
                new Int32(2),
                rgba(0xff000010)
            );
            expect(pixelAt(bmp.getContext(), 4, 1, 1)).toEqual([255, 0, 0, 16]);
            expect(pixelAt(bmp.getContext(), 4, 0, 0)).toEqual([255, 255, 255, 64]);
        });

        it("keeps the color's alpha on a non-alpha RoRegion", () => {
            const bmp = makeBitmap(8, 4, false);
            bmp.getMethod("clear").call(interpreter, rgba(0x0000ffff));
            const rgn = new RoRegion(bmp, new Int32(4), new Int32(0), new Int32(4), new Int32(4));
            rgn.getMethod("setAlphaEnable").call(interpreter, BrsBoolean.False);
            rgn.getMethod("drawRect").call(
                interpreter,
                new Int32(0),
                new Int32(0),
                new Int32(4),
                new Int32(4),
                rgba(0xff000080)
            );
            expect(pixelAt(bmp.getContext(), 8, 5, 1)).toEqual([255, 0, 0, 128]);
            expect(pixelAt(bmp.getContext(), 8, 1, 1)).toEqual([0, 0, 255, 255]);
        });
    });

    describe("drawLine and drawPoint", () => {
        it("drawLine paints along the requested segment", () => {
            const bmp = makeBitmap(10, 1, true);
            bmp.getMethod("drawLine").call(
                interpreter,
                new Int32(0),
                new Int32(0),
                new Int32(9),
                new Int32(0),
                rgba(0x00ff00ff)
            );
            const ctx = bmp.getContext();
            expect(pixelAt(ctx, 10, 5, 0)[1]).toBe(255);
        });

        // Expected pixels below are from a Roku Ultra (test/simulator/probes/drawline-probe).
        function line(bmp, x0, y0, x1, y1, color) {
            return bmp
                .getMethod("drawLine")
                .call(interpreter, new Int32(x0), new Int32(y0), new Int32(x1), new Int32(y1), rgba(color));
        }

        // Regression (#1340): a 1px line used to be anti-aliased at half strength over two rows.
        it("drawLine paints a horizontal line on one row at full strength", () => {
            const bmp = makeBitmap(16, 16, true);
            bmp.getMethod("clear").call(interpreter, rgba(0xffffffff));
            line(bmp, 0, 0, 15, 0, 0x808080ff);
            const ctx = bmp.getContext();
            expect(pixelAt(ctx, 16, 0, 0)).toEqual([128, 128, 128, 255]);
            expect(pixelAt(ctx, 16, 15, 0)).toEqual([128, 128, 128, 255]);
            expect(pixelAt(ctx, 16, 0, 1)).toEqual([255, 255, 255, 255]);
        });

        it("drawLine covers both ends of a horizontal line, in either direction", () => {
            for (const [x0, x1] of [
                [2, 10],
                [10, 2],
            ]) {
                const bmp = makeBitmap(12, 8, false);
                line(bmp, x0, 3, x1, 3, 0xff0000ff);
                const ctx = bmp.getContext();
                expect(pixelAt(ctx, 12, 1, 3)).toEqual([0, 0, 0, 0]);
                expect(pixelAt(ctx, 12, 2, 3)).toEqual([255, 0, 0, 255]);
                expect(pixelAt(ctx, 12, 10, 3)).toEqual([255, 0, 0, 255]);
                expect(pixelAt(ctx, 12, 11, 3)).toEqual([0, 0, 0, 0]);
                expect(pixelAt(ctx, 12, 6, 2)).toEqual([0, 0, 0, 0]);
                expect(pixelAt(ctx, 12, 6, 4)).toEqual([0, 0, 0, 0]);
            }
        });

        it("drawLine stops a vertical line short of its larger y, in either direction", () => {
            for (const [y0, y1] of [
                [1, 6],
                [6, 1],
            ]) {
                const bmp = makeBitmap(12, 8, false);
                line(bmp, 5, y0, 5, y1, 0xff0000ff);
                const ctx = bmp.getContext();
                expect(pixelAt(ctx, 12, 5, 0)).toEqual([0, 0, 0, 0]);
                expect(pixelAt(ctx, 12, 5, 1)).toEqual([255, 0, 0, 255]);
                expect(pixelAt(ctx, 12, 5, 5)).toEqual([255, 0, 0, 255]);
                expect(pixelAt(ctx, 12, 5, 6)).toEqual([0, 0, 0, 0]);
                expect(pixelAt(ctx, 12, 4, 3)).toEqual([0, 0, 0, 0]);
                expect(pixelAt(ctx, 12, 6, 3)).toEqual([0, 0, 0, 0]);
            }
        });

        it("drawLine paints nothing for a zero-length line", () => {
            const bmp = makeBitmap(12, 8, false);
            line(bmp, 4, 4, 4, 4, 0xff0000ff);
            expect(pixelAt(bmp.getContext(), 12, 4, 4)).toEqual([0, 0, 0, 0]);
        });

        // Regression (#1351): with alpha blending off the line replaces the pixels, its alpha included.
        it("drawLine keeps the color's alpha on a non-alpha bitmap, and blends on an alpha one", () => {
            const off = makeBitmap(10, 6, false);
            off.getMethod("clear").call(interpreter, rgba(0x0000ffff));
            line(off, 0, 2, 9, 2, 0xff000040);
            line(off, 4, 0, 4, 5, 0x00ff0080);
            expect(pixelAt(off.getContext(), 10, 1, 2)).toEqual([255, 0, 0, 64]);
            expect(pixelAt(off.getContext(), 10, 4, 1)).toEqual([0, 255, 0, 128]);
            expect(pixelAt(off.getContext(), 10, 1, 1)).toEqual([0, 0, 255, 255]);

            const on = makeBitmap(10, 6, true);
            on.getMethod("clear").call(interpreter, rgba(0x0000ffff));
            line(on, 0, 2, 9, 2, 0xff000040);
            expect(pixelAt(on.getContext(), 10, 1, 2)).toEqual([64, 0, 191, 255]);
        });

        it("drawLine replaces, not blends, along a diagonal on a non-alpha bitmap", () => {
            const bmp = makeBitmap(12, 8, false);
            bmp.getMethod("clear").call(interpreter, rgba(0x0000ffff));
            line(bmp, 0, 0, 6, 6, 0xff0000ff);
            const [r, g, b] = pixelAt(bmp.getContext(), 12, 3, 3);
            expect(r).toBeGreaterThan(200);
            expect(g).toBe(0);
            expect(b).toBeLessThan(55);
        });

        it("drawPoint paints a size x size square at the given position", () => {
            const bmp = makeBitmap(10, 10, true);
            const result = bmp
                .getMethod("drawPoint")
                .call(interpreter, new Int32(4), new Int32(4), new Float(2.0), rgba(0x0000ffff));
            expect(result).toBe(BrsBoolean.True);
            const ctx = bmp.getContext();
            expect(pixelAt(ctx, 10, 4, 4)).toEqual([0, 0, 255, 255]);
            expect(pixelAt(ctx, 10, 4, 6)).toEqual([0, 0, 0, 0]);
        });

        it("drawPoint clamps size to Roku's documented maximum of 100", () => {
            const bmp = makeBitmap(200, 200, true);
            bmp.getMethod("drawPoint").call(
                interpreter,
                new Int32(100),
                new Int32(100),
                new Float(500.0),
                rgba(0x0000ffff)
            );
            const ctx = bmp.getContext();
            expect(pixelAt(ctx, 200, 50, 50)).toEqual([0, 0, 255, 255]);
            expect(pixelAt(ctx, 200, 149, 149)).toEqual([0, 0, 255, 255]);
            expect(pixelAt(ctx, 200, 49, 49)).toEqual([0, 0, 0, 0]);
            expect(pixelAt(ctx, 200, 150, 150)).toEqual([0, 0, 0, 0]);
        });

        // Expected pixels below are from a Roku Ultra (test/simulator/probes/drawpoint-probe).
        it("drawPoint centers the square on (x, y)", () => {
            for (const [size, from, to] of [
                [1, 5, 5],
                [2, 4, 5],
                [3, 4, 6],
                [4, 3, 6],
                [5, 3, 7],
                [6, 2, 7],
            ]) {
                const bmp = makeBitmap(12, 12, false);
                bmp.getMethod("drawPoint").call(
                    interpreter,
                    new Int32(5),
                    new Int32(5),
                    new Float(size),
                    rgba(0xff0000ff)
                );
                const ctx = bmp.getContext();
                expect(pixelAt(ctx, 12, from, from), `size ${size}`).toEqual([255, 0, 0, 255]);
                expect(pixelAt(ctx, 12, to, to), `size ${size}`).toEqual([255, 0, 0, 255]);
                expect(pixelAt(ctx, 12, from - 1, from - 1), `size ${size}`).toEqual([0, 0, 0, 0]);
                expect(pixelAt(ctx, 12, to + 1, to + 1), `size ${size}`).toEqual([0, 0, 0, 0]);
            }
        });

        // Regression: with alpha blending off the point replaces the pixels, its alpha included.
        it("drawPoint keeps the color's alpha on a non-alpha bitmap, and blends on an alpha one", () => {
            for (const [alphaEnable, expected] of [
                [false, [255, 0, 0, 64]],
                [true, [64, 0, 191, 255]],
            ]) {
                const bmp = makeBitmap(12, 8, alphaEnable);
                bmp.getMethod("clear").call(interpreter, rgba(0x0000ffff));
                bmp.getMethod("drawPoint").call(
                    interpreter,
                    new Int32(1),
                    new Int32(1),
                    new Float(3),
                    rgba(0xff000040)
                );
                expect(pixelAt(bmp.getContext(), 12, 0, 0)).toEqual(expected);
                expect(pixelAt(bmp.getContext(), 12, 2, 2)).toEqual(expected);
                expect(pixelAt(bmp.getContext(), 12, 3, 3)).toEqual([0, 0, 255, 255]);
            }
        });
    });

    describe("drawObject family", () => {
        function greenSource() {
            const src = makeBitmap(4, 4, true);
            src.getMethod("clear").call(interpreter, rgba(0x00ff00ff));
            return src;
        }

        it("drawObject blits the source at (x, y) unscaled", () => {
            const src = greenSource();
            const dest = makeBitmap(10, 10, true);
            const result = dest.getMethod("drawObject").call(interpreter, new Int32(3), new Int32(3), src);
            expect(result).toBe(BrsBoolean.True);
            const ctx = dest.getContext();
            expect(pixelAt(ctx, 10, 4, 4)).toEqual([0, 255, 0, 255]);
            expect(pixelAt(ctx, 10, 0, 0)).toEqual([0, 0, 0, 0]);
        });

        it("drawScaledObject scales the source footprint", () => {
            const src = greenSource();
            const dest = makeBitmap(10, 10, true);
            dest.getMethod("drawScaledObject").call(
                interpreter,
                new Int32(0),
                new Int32(0),
                new Float(2.0),
                new Float(2.0),
                src
            );
            const ctx = dest.getContext();
            // A 4x4 source scaled 2x covers (0,0)-(8,8).
            expect(pixelAt(ctx, 10, 7, 7)[3]).toBeGreaterThan(0);
            expect(pixelAt(ctx, 10, 8, 8)[3]).toBe(0);
        });

        it("drawRotatedObject at theta=0 behaves like an unrotated blit", () => {
            const src = greenSource();
            const dest = makeBitmap(10, 10, true);
            dest.getMethod("drawRotatedObject").call(interpreter, new Int32(3), new Int32(3), new Float(0.0), src);
            const ctx = dest.getContext();
            expect(pixelAt(ctx, 10, 4, 4)).toEqual([0, 255, 0, 255]);
        });

        it("drawTransformedObject composes rotation and scale without throwing", () => {
            const src = greenSource();
            const dest = makeBitmap(10, 10, true);
            const result = dest
                .getMethod("drawTransformedObject")
                .call(interpreter, new Int32(5), new Int32(5), new Float(90.0), new Float(1.0), new Float(1.0), src);
            expect(result).toBe(BrsBoolean.True);
            const ctx = dest.getContext();
            // Some pixel near the pivot should have been painted; exact footprint is rotation math,
            // not what this test is pinning down.
            const total = ctx.getImageData(0, 0, 10, 10).data.reduce((sum, v) => sum + v, 0);
            expect(total).toBeGreaterThan(0);
        });
    });

    describe("isDrawable gating (roTextureRequest.SetDrawable)", () => {
        it("clear/draw* return false and leave the canvas untouched on a non-drawable bitmap", () => {
            const bmp = makeBitmap(10, 10, true);
            bmp.drawable = false;
            const src = makeBitmap(4, 4, true);

            expect(bmp.getMethod("clear").call(interpreter, rgba(0xaabbccff))).toBe(BrsBoolean.False);
            expect(
                bmp
                    .getMethod("drawRect")
                    .call(interpreter, new Int32(0), new Int32(0), new Int32(4), new Int32(4), rgba(0xff0000ff))
            ).toBe(BrsBoolean.False);
            expect(
                bmp
                    .getMethod("drawLine")
                    .call(interpreter, new Int32(0), new Int32(0), new Int32(9), new Int32(0), rgba(0x00ff00ff))
            ).toBe(BrsBoolean.False);
            expect(
                bmp
                    .getMethod("drawPoint")
                    .call(interpreter, new Int32(0), new Int32(0), new Float(2.0), rgba(0x0000ffff))
            ).toBe(BrsBoolean.False);
            expect(bmp.getMethod("drawObject").call(interpreter, new Int32(0), new Int32(0), src)).toBe(
                BrsBoolean.False
            );

            const ctx = bmp.getContext();
            expect(pixelAt(ctx, 10, 0, 0)).toEqual([0, 0, 0, 0]);
        });

        it("a directly-created roBitmap is drawable by default", () => {
            const bmp = makeBitmap(4, 4, true);
            expect(bmp.isDrawable()).toBe(true);
            expect(bmp.getMethod("clear").call(interpreter, rgba(0xaabbccff))).toBe(BrsBoolean.True);
        });

        it("a roRegion delegates isDrawable() to its underlying bitmap", () => {
            const bmp = makeBitmap(10, 10, true);
            bmp.drawable = false;
            const region = new RoRegion(bmp, new Int32(0), new Int32(0), new Int32(4), new Int32(4));

            expect(region.getMethod("clear").call(interpreter, rgba(0xaabbccff))).toBe(BrsBoolean.False);

            bmp.drawable = true;
            expect(region.getMethod("clear").call(interpreter, rgba(0xaabbccff))).toBe(BrsBoolean.True);
        });
    });

    describe("simple property Callables", () => {
        it("getWidth/getHeight report the component's size", () => {
            const bmp = makeBitmap(7, 9, false);
            expect(bmp.getMethod("getWidth").call(interpreter)).toEqual(new Int32(7));
            expect(bmp.getMethod("getHeight").call(interpreter)).toEqual(new Int32(9));
        });

        it("getAlphaEnable/setAlphaEnable round-trip", () => {
            const bmp = makeBitmap(7, 9, false);
            expect(bmp.getMethod("getAlphaEnable").call(interpreter)).toBe(BrsBoolean.False);
            bmp.getMethod("setAlphaEnable").call(interpreter, BrsBoolean.True);
            expect(bmp.getMethod("getAlphaEnable").call(interpreter)).toBe(BrsBoolean.True);
        });

        it("clear fills the whole canvas with the given color and returns true", () => {
            const bmp = makeBitmap(4, 4, true);
            const result = bmp.getMethod("clear").call(interpreter, rgba(0xaabbccff));
            expect(result).toBe(BrsBoolean.True);
            const ctx = bmp.getContext();
            expect(pixelAt(ctx, 4, 0, 0)).toEqual([170, 187, 204, 255]);
            expect(pixelAt(ctx, 4, 3, 3)).toEqual([170, 187, 204, 255]);
        });

        // Regression (#1337): roRegion.Clear() must replace the region's pixels like roBitmap.Clear(),
        // not blend the color over them (a transparent clear used to leave the old content intact).
        it("roRegion.clear(0) wipes only the region's pixels to transparent", () => {
            const bmp = makeBitmap(8, 4, true);
            bmp.getMethod("drawRect").call(
                interpreter,
                new Int32(0),
                new Int32(0),
                new Int32(8),
                new Int32(4),
                rgba(0xffffffff)
            );
            const rgn = new RoRegion(bmp, new Int32(0), new Int32(0), new Int32(4), new Int32(4));
            const result = rgn.getMethod("clear").call(interpreter, new Int32(0));
            expect(result).toBe(BrsBoolean.True);
            const ctx = bmp.getContext();
            expect(pixelAt(ctx, 8, 0, 0)).toEqual([0, 0, 0, 0]);
            expect(pixelAt(ctx, 8, 3, 3)).toEqual([0, 0, 0, 0]);
            expect(pixelAt(ctx, 8, 4, 0)).toEqual([255, 255, 255, 255]);
            expect(pixelAt(ctx, 8, 7, 3)).toEqual([255, 255, 255, 255]);
        });

        it("roRegion.clear with a translucent color replaces, not blends, the region's pixels", () => {
            const bmp = makeBitmap(4, 4, true);
            bmp.getMethod("drawRect").call(
                interpreter,
                new Int32(0),
                new Int32(0),
                new Int32(4),
                new Int32(4),
                rgba(0xffffffff)
            );
            const rgn = new RoRegion(bmp, new Int32(0), new Int32(0), new Int32(4), new Int32(4));
            rgn.getMethod("clear").call(interpreter, rgba(0xff000080));
            const [r, g, b, a] = pixelAt(bmp.getContext(), 4, 1, 1);
            expect([r, g, b]).toEqual([255, 0, 0]);
            expect(a).toBe(128);
        });

        it("finish is a no-op that returns invalid", () => {
            const bmp = makeBitmap(4, 4, true);
            const result = bmp.getMethod("finish").call(interpreter);
            expect(result.toString()).toBe("invalid");
        });
    });

    describe("getByteArray and getPng", () => {
        it("getByteArray returns the raw RGBA pixel bytes", () => {
            const bmp = makeBitmap(2, 2, true);
            bmp.getMethod("clear").call(interpreter, rgba(0xaabbccff));
            const byteArray = bmp
                .getMethod("getByteArray")
                .call(interpreter, new Int32(0), new Int32(0), new Int32(2), new Int32(2));
            expect(Array.from(byteArray.elements.slice(0, 4))).toEqual([170, 187, 204, 255]);
            expect(byteArray.elements.length).toBe(2 * 2 * 4);
        });

        it("getByteArray returns Invalid on a live RoScreen, matching hardware", () => {
            const screen = new RoScreen(BrsBoolean.False, new Int32(4), new Int32(4));
            const result = screen
                .getMethod("getByteArray")
                .call(interpreter, new Int32(0), new Int32(0), new Int32(1), new Int32(1));
            expect(result).toBe(BrsInvalid.Instance);
        });

        it("getPng round-trips a solid opaque color through the PNG codec", () => {
            const bmp = makeBitmap(4, 4, true);
            bmp.getMethod("clear").call(interpreter, rgba(0x112233ff));
            const png = bmp
                .getMethod("getPng")
                .call(interpreter, new Int32(0), new Int32(0), new Int32(4), new Int32(4));
            const decoded = UPNG.decode(Buffer.from(png.elements));
            expect(decoded.width).toBe(4);
            expect(decoded.height).toBe(4);
            const rgba8 = new Uint8Array(UPNG.toRGBA8(decoded)[0]);
            expect(Array.from(rgba8.slice(0, 4))).toEqual([17, 34, 51, 255]);
        });

        it("getPng writes a standard PNG: CRC-checked chunks and a zlib IDAT stream", () => {
            const bmp = makeBitmap(64, 64, true);
            bmp.getMethod("clear").call(interpreter, rgba(0xff8040ff));
            for (let i = 1; i < 64; i++) {
                bmp.getMethod("drawPoint").call(
                    interpreter,
                    new Float((i * 37) % 64),
                    new Float((i * 11) % 64),
                    new Float(1),
                    rgba(((i * 0x2f1d3b) << 8) | 0xff)
                );
            }
            for (const [w, h] of [
                [1, 1],
                [64, 64],
            ]) {
                const png = Buffer.from(
                    bmp.getMethod("getPng").call(interpreter, new Int32(0), new Int32(0), new Int32(w), new Int32(h))
                        .elements
                );
                expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
                const idat = [];
                const types = [];
                let off = 8;
                while (off < png.length) {
                    const len = png.readUInt32BE(off);
                    const type = png.toString("ascii", off + 4, off + 8);
                    expect(off + 12 + len).toBeLessThanOrEqual(png.length);
                    expect(png.readUInt32BE(off + 8 + len)).toBe(zlib.crc32(png.subarray(off + 4, off + 8 + len)));
                    types.push(type);
                    if (type === "IDAT") {
                        idat.push(png.subarray(off + 8, off + 8 + len));
                    }
                    off += 12 + len;
                }
                expect(types.at(-1)).toBe("IEND");
                expect(() => zlib.inflateSync(Buffer.concat(idat))).not.toThrow();
                const rgba8 = new Uint8Array(UPNG.toRGBA8(UPNG.decode(png))[0]);
                expect(Array.from(rgba8.slice(0, 4))).toEqual([255, 128, 64, 255]);
            }
        });
    });

    describe("clip stack (pushClip/popClip/resetClips/getClipDepth)", () => {
        it("clips drawing to the pushed rectangle and restores it on pop", () => {
            const bmp = makeBitmap(10, 10, true);
            const ifd = new IfDraw2D(bmp);
            expect(ifd.getClipDepth()).toBe(0);

            ifd.pushClip({ x: 2, y: 2, width: 4, height: 4 });
            expect(ifd.getClipDepth()).toBe(1);
            ifd.doDrawRotatedRect({ x: 0, y: 0, width: 10, height: 10 }, 0x00ff00ff | 0, 0);
            ifd.popClip();
            expect(ifd.getClipDepth()).toBe(0);

            const ctx = bmp.getContext();
            expect(pixelAt(ctx, 10, 3, 3)[3]).toBeGreaterThan(0);
            expect(pixelAt(ctx, 10, 0, 0)[3]).toBe(0);
            expect(pixelAt(ctx, 10, 9, 9)[3]).toBe(0);
        });

        it("resetClips unwinds an unbalanced push depth so a leaked clip cannot poison later frames", () => {
            const bmp = makeBitmap(4, 4, true);
            const ifd = new IfDraw2D(bmp);
            ifd.pushClip({ x: 0, y: 0, width: 1, height: 1 });
            ifd.pushClip({ x: 0, y: 0, width: 1, height: 1 });
            expect(ifd.getClipDepth()).toBe(2);

            ifd.resetClips();
            expect(ifd.getClipDepth()).toBe(0);
        });

        it("popClip at depth 0 is a no-op, not an error", () => {
            const bmp = makeBitmap(4, 4, true);
            const ifd = new IfDraw2D(bmp);
            expect(() => ifd.popClip()).not.toThrow();
            expect(ifd.getClipDepth()).toBe(0);
        });
    });

    describe("pushScale/popScale", () => {
        it("is a no-op at scale [1,1] and reports that nothing was pushed", () => {
            const bmp = makeBitmap(10, 10, true);
            const ifd = new IfDraw2D(bmp);
            expect(ifd.pushScale(0, 0, 1, 1)).toBe(false);
        });

        it("pushes a transform at any other scale and pairs cleanly with popScale", () => {
            const bmp = makeBitmap(10, 10, true);
            const ifd = new IfDraw2D(bmp);
            expect(ifd.pushScale(0, 0, 2, 2)).toBe(true);
            expect(() => ifd.popScale()).not.toThrow();
        });
    });

    describe("pushScaleFrame/popScaleFrame", () => {
        it("is a no-op at scale [1,1] and returns -1", () => {
            const bmp = makeBitmap(10, 10, true);
            const ifd = new IfDraw2D(bmp);
            expect(ifd.pushScaleFrame(0, 0, 1, 1)).toBe(-1);
            expect(ifd.getClipDepth()).toBe(0);
            ifd.popScaleFrame(-1);
            expect(ifd.getClipDepth()).toBe(0);
        });

        it("scales what is drawn inside it around the pivot, and only that", () => {
            const bmp = makeBitmap(10, 10, true);
            const ifd = new IfDraw2D(bmp);
            const depth = ifd.pushScaleFrame(2, 2, 0.5, 0.5);
            ifd.doDrawRotatedRect({ x: 2, y: 2, width: 8, height: 8 }, 0x00ff00ff | 0, 0);
            ifd.popScaleFrame(depth);
            ifd.doDrawRotatedRect({ x: 8, y: 8, width: 2, height: 2 }, 0xff0000ff | 0, 0);

            const ctx = bmp.getContext();
            expect(pixelAt(ctx, 10, 5, 5)).toEqual([0, 255, 0, 255]);
            expect(pixelAt(ctx, 10, 7, 7)[3]).toBe(0);
            expect(pixelAt(ctx, 10, 9, 9)).toEqual([255, 0, 0, 255]);
        });

        it("unwinds a clip left open inside it, so its own scale does not leak to later draws", () => {
            const bmp = makeBitmap(10, 10, true);
            const ifd = new IfDraw2D(bmp);
            const depth = ifd.pushScaleFrame(0, 0, 0.5, 0.5);
            ifd.pushClip({ x: 0, y: 0, width: 4, height: 4 });
            expect(ifd.getClipDepth()).toBe(2);
            ifd.popScaleFrame(depth);
            expect(ifd.getClipDepth()).toBe(0);
            // Unscaled and unclipped again: a full-size fill covers the far corner.
            ifd.doDrawRotatedRect({ x: 0, y: 0, width: 10, height: 10 }, 0x00ff00ff | 0, 0);
            expect(pixelAt(bmp.getContext(), 10, 9, 9)).toEqual([0, 255, 0, 255]);
        });

        it("is unwound by resetClips when it never gets popped", () => {
            const bmp = makeBitmap(10, 10, true);
            const ifd = new IfDraw2D(bmp);
            ifd.pushScaleFrame(0, 0, 0.5, 0.5);
            ifd.resetClips();
            expect(ifd.getClipDepth()).toBe(0);
            ifd.doDrawRotatedRect({ x: 0, y: 0, width: 10, height: 10 }, 0x00ff00ff | 0, 0);
            expect(pixelAt(bmp.getContext(), 10, 9, 9)).toEqual([0, 255, 0, 255]);
        });
    });

    describe("pushTransformReset", () => {
        it("draws unscaled inside an enclosing scale frame, and restores it when popped", () => {
            const bmp = makeBitmap(10, 10, true);
            const ifd = new IfDraw2D(bmp);
            const outer = ifd.pushScaleFrame(0, 0, 0.5, 0.5);
            const depth = ifd.pushTransformReset();
            expect(ifd.getClipDepth()).toBe(2);
            ifd.doDrawRotatedRect({ x: 8, y: 8, width: 2, height: 2 }, 0x00ff00ff | 0, 0);
            ifd.popScaleFrame(depth);
            // Scaled again: a 4x4 rect at [12,12] lands on [6,6]-[8,8].
            ifd.doDrawRotatedRect({ x: 12, y: 12, width: 4, height: 4 }, 0xff0000ff | 0, 0);
            ifd.popScaleFrame(outer);

            const ctx = bmp.getContext();
            expect(pixelAt(ctx, 10, 9, 9)).toEqual([0, 255, 0, 255]);
            expect(pixelAt(ctx, 10, 7, 7)).toEqual([255, 0, 0, 255]);
            expect(ifd.getClipDepth()).toBe(0);
        });

        it("keeps the clips pushed before it", () => {
            const bmp = makeBitmap(10, 10, true);
            const ifd = new IfDraw2D(bmp);
            ifd.pushClip({ x: 0, y: 0, width: 5, height: 5 });
            const outer = ifd.pushScaleFrame(0, 0, 2, 2);
            const depth = ifd.pushTransformReset();
            ifd.doDrawRotatedRect({ x: 0, y: 0, width: 10, height: 10 }, 0x00ff00ff | 0, 0);
            ifd.popScaleFrame(depth);
            ifd.popScaleFrame(outer);
            ifd.popClip();

            const ctx = bmp.getContext();
            expect(pixelAt(ctx, 10, 4, 4)).toEqual([0, 255, 0, 255]);
            expect(pixelAt(ctx, 10, 6, 6)[3]).toBe(0);
        });
    });

    describe("do* drawing primitives", () => {
        it("doClearCanvas fills the whole canvas", () => {
            const bmp = makeBitmap(5, 5, true);
            new IfDraw2D(bmp).doClearCanvas(0x00ff00ff | 0);
            expect(pixelAt(bmp.getContext(), 5, 0, 0)).toEqual([0, 255, 0, 255]);
        });

        it("doDrawScaledObject scales the source into the destination", () => {
            const src = makeBitmap(2, 2, true);
            new IfDraw2D(src).doClearCanvas(0xff0000ff | 0);
            const dest = makeBitmap(10, 10, true);
            const ok = new IfDraw2D(dest).doDrawScaledObject(1, 1, 3, 3, src);
            expect(ok).toBe(true);
            const ctx = dest.getContext();
            expect(pixelAt(ctx, 10, 3, 3)).toEqual([255, 0, 0, 255]);
            expect(pixelAt(ctx, 10, 7, 7)[3]).toBe(0);
        });

        it("doDrawScaledObject with a negative scaleX mirrors the source horizontally", () => {
            const src = makeBitmap(2, 2, true);
            const sctx = src.getContext();
            // Left column red, right column blue, so a horizontal flip is observable.
            sctx.fillStyle = "red";
            sctx.fillRect(0, 0, 1, 2);
            sctx.fillStyle = "blue";
            sctx.fillRect(1, 0, 1, 2);
            const dest = makeBitmap(10, 10, true);
            const ok = new IfDraw2D(dest).doDrawScaledObject(4, 0, -1, 1, src);
            expect(ok).toBe(true);
            const ctx = dest.getContext();
            // Unflipped the blit would occupy (4,0)-(6,2) with red on the left; a negative
            // scaleX mirrors it into (2,0)-(4,0), with red now on the right.
            expect(pixelAt(ctx, 10, 2, 0)).toEqual([0, 0, 255, 255]);
            expect(pixelAt(ctx, 10, 3, 0)).toEqual([255, 0, 0, 255]);
        });

        it("doDrawCroppedBitmap draws only the requested source sub-rect, scaled into destRect", () => {
            const src = makeBitmap(4, 4, true);
            new IfDraw2D(src).doClearCanvas(0x0000ffff | 0);
            const dest = makeBitmap(10, 10, true);
            new IfDraw2D(dest).doDrawCroppedBitmap(
                src,
                { x: 1, y: 1, width: 2, height: 2 },
                { x: 3, y: 3, width: 2, height: 2 }
            );
            const ctx = dest.getContext();
            expect(pixelAt(ctx, 10, 3, 3)).toEqual([0, 0, 255, 255]);
            expect(pixelAt(ctx, 10, 2, 2)[3]).toBe(0);
        });

        it("doDrawRotatedBitmap at 180 degrees flips the draw across its pivot", () => {
            const src = makeBitmap(2, 2, true);
            new IfDraw2D(src).doClearCanvas(0x0000ffff | 0);
            const dest = makeBitmap(10, 10, true);
            new IfDraw2D(dest).doDrawRotatedBitmap(4, 4, 1, 1, Math.PI, src);
            const ctx = dest.getContext();
            // Unrotated, a 2x2 blit at (4,4) would occupy (4,4)-(6,6); at 180deg it lands at (2,2)-(4,4).
            expect(pixelAt(ctx, 10, 2, 2)[3]).toBeGreaterThan(0);
            expect(pixelAt(ctx, 10, 4, 4)[3]).toBe(0);
        });

        it("doDrawRotatedRect scales around the rect's own origin as pivot", () => {
            const bmp = makeBitmap(10, 10, true);
            new IfDraw2D(bmp).doDrawRotatedRect(
                { x: 1, y: 1, width: 2, height: 2 },
                0xff0000ff | 0,
                0,
                undefined,
                1,
                2,
                2
            );
            const ctx = bmp.getContext();
            // A 2x2 rect at (1,1) scaled 2x around its own top-left corner covers (1,1)-(5,5).
            expect(pixelAt(ctx, 10, 1, 1)[3]).toBeGreaterThan(0);
            expect(pixelAt(ctx, 10, 4, 4)[3]).toBeGreaterThan(0);
            expect(pixelAt(ctx, 10, 5, 5)[3]).toBe(0);
        });

        it("doDrawClearedRect erases a rectangle back to transparent", () => {
            const bmp = makeBitmap(6, 6, true);
            const ifd = new IfDraw2D(bmp);
            ifd.doClearCanvas(0xffffffff | 0);
            ifd.doDrawClearedRect({ x: 1, y: 1, width: 2, height: 2 });
            const ctx = bmp.getContext();
            expect(pixelAt(ctx, 6, 1, 1)).toEqual([0, 0, 0, 0]);
            expect(pixelAt(ctx, 6, 0, 0)).toEqual([255, 255, 255, 255]);
        });

        it("doDrawText/doDrawRotatedText no-op on empty strings without touching the font", () => {
            const bmp = makeBitmap(5, 5, true);
            const ifd = new IfDraw2D(bmp);
            expect(() => ifd.doDrawText("", 0, 0, 0xffffffff | 0, 1, undefined)).not.toThrow();
            expect(() => ifd.doDrawRotatedText("", 0, 0, 0xffffffff | 0, 1, undefined, 0)).not.toThrow();
        });
    });

    describe("drawNinePatch", () => {
        function makeNinePatchSource() {
            const size = 10;
            const canvas = createCanvas(size, size);
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "rgba(255, 255, 255, 1)";
            ctx.fillRect(1, 1, size - 2, size - 2);
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fillRect(4, 0, 2, 1); // top stretch marker
            ctx.fillRect(0, 4, 1, 2); // left stretch marker
            ctx.fillStyle = "rgba(0, 0, 0, 1)";
            ctx.fillRect(0, size - 1, size, 1); // bottom padding marker through both corners
            return new RoBitmap(canvas.toBuffer("image/png"), "pkg:/images/bar.9.png");
        }

        it("clamps the drawn size to the fixed-corner sum instead of collapsing/inverting at 0", () => {
            const bitmap = makeNinePatchSource();
            expect(bitmap.getPatchSizes()).toEqual({
                left: 3,
                right: 3,
                top: 3,
                bottom: 3,
                margins: { left: 0, right: 0, top: 0, bottom: 0 },
            });

            const target = makeBitmap(20, 20, true);
            new IfDraw2D(target).drawNinePatch(bitmap, { x: 0, y: 0, width: 0, height: 0 }, undefined, 1);
            const ctx = target.getContext();
            let painted = 0;
            for (let x = 0; x < 20; x++) {
                if (pixelAt(ctx, 20, x, 3)[3] > 8) {
                    painted++;
                }
            }
            // left(3) + right(3) fixed corners, never fewer even when the requested size is 0.
            expect(painted).toBe(6);
        });
    });

    describe("module-level draw helpers", () => {
        function magentaSource() {
            const src = makeBitmap(4, 4, true);
            src.getMethod("clear").call(interpreter, rgba(0xff00ffff));
            return src;
        }

        it("drawObjectToComponent short-circuits at alpha=0 without touching the destination", () => {
            const src = magentaSource();
            const dest = makeBitmap(10, 10, true);
            const before = Buffer.from(dest.getContext().getImageData(0, 0, 10, 10).data);
            const result = drawObjectToComponent(dest, src, 2, 2, 1, 1, undefined, 0);
            expect(result).toBe(true);
            const after = Buffer.from(dest.getContext().getImageData(0, 0, 10, 10).data);
            expect(after.equals(before)).toBe(true);
        });

        it("drawObjectToComponent draws the source when alpha is non-zero", () => {
            const src = magentaSource();
            const dest = makeBitmap(10, 10, true);
            const result = drawObjectToComponent(dest, src, 2, 2);
            expect(result).toBe(true);
            expect(pixelAt(dest.getContext(), 10, 3, 3)).toEqual([255, 0, 255, 255]);
        });

        it("drawBitmapOnBitmap copies one bitmap's canvas onto another's", () => {
            const src = magentaSource();
            const dest = makeBitmap(4, 4, true);
            drawBitmapOnBitmap(src, dest);
            expect(pixelAt(dest.getContext(), 4, 1, 1)).toEqual([255, 0, 255, 255]);
        });

        it("drawRotatedObject (module function) rotates the draw about (x, y)", () => {
            const src = magentaSource();
            const dest = makeBitmap(10, 10, true);
            const ok = drawRotatedObject(dest, src, 4, 4, 180);
            expect(ok).toBe(true);
            expect(pixelAt(dest.getContext(), 10, 2, 2)[3]).toBeGreaterThan(0);
            expect(pixelAt(dest.getContext(), 10, 4, 4)[3]).toBe(0);
        });

        it("drawImageAtPos blits a canvas at a fixed position", () => {
            const src = magentaSource();
            const dest = makeBitmap(10, 10, true);
            drawImageAtPos(src.getCanvas(), dest.getContext(), 1, 1);
            expect(pixelAt(dest.getContext(), 10, 2, 2)).toEqual([255, 0, 255, 255]);
        });

        it("putImageAtPos writes raw ImageData at a fixed position", () => {
            const src = magentaSource();
            const dest = makeBitmap(10, 10, true);
            const imgData = src.getContext().getImageData(0, 0, 4, 4);
            putImageAtPos(imgData, dest.getContext(), 3, 3);
            expect(pixelAt(dest.getContext(), 10, 3, 3)).toEqual([255, 0, 255, 255]);
        });

        it("drawCanvasRegion blits a scaled sub-region between canvases", () => {
            const src = magentaSource();
            const dest = makeBitmap(10, 10, true);
            drawCanvasRegion(dest.getContext(), src.getCanvas(), 0, 0, 4, 4, 5, 5, 4, 4);
            expect(pixelAt(dest.getContext(), 10, 6, 6)).toEqual([255, 0, 255, 255]);
        });

        it("createNewCanvas/releaseCanvas allocate and free a canvas's backing size", () => {
            const canvas = createNewCanvas(5, 5);
            expect(canvas.width).toBe(5);
            expect(canvas.height).toBe(5);
            releaseCanvas(canvas);
            expect(canvas.width).toBe(0);
            expect(canvas.height).toBe(0);
        });
    });
});
