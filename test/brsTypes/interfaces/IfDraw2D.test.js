const brs = require("../../../packages/node/bin/brs.node");
const UPNG = require("@lvcabral/upng");
const { createCanvas } = require("canvas");
const {
    RoBitmap,
    RoScreen,
    RoRegion,
    RoAssociativeArray,
    BrsString,
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

        it("drawPoint paints a size x size square at the given position", () => {
            const bmp = makeBitmap(10, 10, true);
            bmp.getMethod("drawPoint").call(interpreter, new Int32(4), new Int32(4), new Float(2.0), rgba(0x0000ffff));
            const ctx = bmp.getContext();
            expect(pixelAt(ctx, 10, 4, 4)).toEqual([0, 0, 255, 255]);
            expect(pixelAt(ctx, 10, 4, 6)).toEqual([0, 0, 0, 0]);
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

        it("clear fills the whole canvas with the given color", () => {
            const bmp = makeBitmap(4, 4, true);
            bmp.getMethod("clear").call(interpreter, rgba(0xaabbccff));
            const ctx = bmp.getContext();
            expect(pixelAt(ctx, 4, 0, 0)).toEqual([170, 187, 204, 255]);
            expect(pixelAt(ctx, 4, 3, 3)).toEqual([170, 187, 204, 255]);
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
