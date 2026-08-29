import {
    BrsBoolean,
    BrsInvalid,
    BrsString,
    Callable,
    Float,
    RoAnimatedImage,
    RoBitmap,
    RoByteArray,
    RoFont,
    RoRegion,
    RoScreen,
    StdlibArgument,
    ValueKind,
} from "..";
import { numberToHex } from "../../common";
import { Interpreter } from "../../interpreter";
import { BrsComponent } from "../components/BrsComponent";
import { RoCompositor } from "../components/RoCompositor";
import { Int32 } from "../Int32";
import { Canvas, CanvasRenderingContext2D, createCanvas, ImageData as NodeImageData } from "canvas";
import UPNG from "@lvcabral/upng";

export type BrsCanvas = OffscreenCanvas | Canvas;
export type BrsCanvasContext2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
export type BrsImageData = ImageData | NodeImageData;
export type Rect = { x: number; y: number; width: number; height: number };
export type Circle = { x: number; y: number; r: number };
export type MeasuredText = { text: string; width: number; height: number; ellipsized: boolean };

/**
 * BrightScript Interface ifDraw2D
 * https://developer.roku.com/docs/references/brightscript/interfaces/ifdraw2d.md
 */
export class IfDraw2D {
    private readonly component: BrsDraw2D;
    /** Depth of the active pushClip()/popClip() stack, so an unbalanced frame can be unwound. */
    private clipDepth: number = 0;

    constructor(component: BrsDraw2D) {
        this.component = component;
    }

    doClearCanvas(rgba: number) {
        this.component.clearCanvas(rgba);
    }

    doDrawScaledObject(
        x: number,
        y: number,
        scaleX: number,
        scaleY: number,
        object: RoBitmap | RoAnimatedImage,
        rgba?: number,
        opacity?: number
    ): boolean {
        const style = resolveBlitStyle(rgba, opacity);
        return this.component.drawImage(object, x, y, scaleX, scaleY, style.rgba, style.alpha);
    }

    doDrawCroppedBitmap(
        object: RoBitmap | RoAnimatedImage,
        sourceRect: Rect,
        destRect: Rect,
        rgba?: number,
        opacity?: number
    ): boolean {
        const ctx = this.component.getContext();
        const style = resolveBlitStyle(rgba, opacity);
        const image = getCanvasFromDraw2d(object, style.rgba);
        ctx.save();
        // Set context properties (alpha blending, smoothing)
        setContextGlobalAlpha(ctx, style.alpha);
        const smoothing = object.scaleMode === 1;
        ctx.imageSmoothingEnabled = smoothing;
        if (smoothing && "imageSmoothingQuality" in ctx) {
            ctx.imageSmoothingQuality = "high";
        }
        // Draw the cropped and scaled image using ctx.drawImage directly
        const chunk: DrawChunk = {
            sx: sourceRect.x,
            sy: sourceRect.y,
            sw: sourceRect.width,
            sh: sourceRect.height,
            dx: destRect.x,
            dy: destRect.y,
            dw: destRect.width,
            dh: destRect.height,
        };
        drawChunk(ctx, image, chunk);
        ctx.restore();
        this.component.makeDirty();
        return true;
    }

    doDrawRotatedBitmap(
        x: number,
        y: number,
        scaleX: number,
        scaleY: number,
        rotation: number,
        object: RoBitmap | RoAnimatedImage,
        centerX?: number,
        centerY?: number,
        rgba?: number,
        opacity?: number
    ) {
        const baseX = this.component.x;
        const baseY = this.component.y;
        const ctx = this.component.getContext();
        const style = resolveBlitStyle(rgba, opacity);
        ctx.save();
        const rotationCenterX = centerX ?? 0;
        const rotationCenterY = centerY ?? 0;
        // Apply translation for centering, regardless of rotation
        ctx.translate(baseX + x + rotationCenterX, baseY + y + rotationCenterY);
        // Apply rotation only if necessary
        if (rotation !== 0) {
            ctx.rotate(-rotation);
        }
        // Apply scaling
        ctx.scale(scaleX, scaleY);
        // Translate back to the origin after scaling and rotation
        ctx.translate(-rotationCenterX / scaleX, -rotationCenterY / scaleY);
        // Draw Bitmap
        this.component.drawImage(object, 0, 0, 1, 1, style.rgba, style.alpha);
        ctx.restore();
        this.component.makeDirty();
    }

    doDrawRotatedRect(
        rect: Rect,
        rgba: number,
        rotation: number,
        center?: number[],
        opacity: number = 1,
        scaleX: number = 1,
        scaleY: number = 1
    ) {
        const baseX = this.component.x;
        const baseY = this.component.y;
        const ctx = this.component.getContext();
        ctx.save();
        // Default to top-left corner if centerX and centerY are not provided
        const rotationCenterX = center === undefined ? 0 : center[0];
        const rotationCenterY = center === undefined ? 0 : center[1];
        if (scaleX !== 1 || scaleY !== 1) {
            // Division-free scale-around-pivot bracket: exactly a no-op at scale [1,1] for any
            // pivot, and collapses to a single point at scale [0,0] instead of the NaN/Infinity
            // risk a fused rotate+scale transform (see doDrawRotatedBitmap) would hit there.
            // Pivot is rect.x/y as-is, NOT + rotationCenterX/Y: rect.x/y already bakes in
            // scaleRotateCenter's position compensation via Group.getTranslation(), so adding the
            // center again here would double-count it (see Group.applyScale for the derivation).
            // Composed onto the ctx.save() already opened above (this method restores it below);
            // pushScale (used by text drawing) does the same composition with its own save/restore.
            this.composeScalePivot(ctx, baseX + rect.x, baseY + rect.y, scaleX, scaleY);
        }
        if (rotation === 0) {
            ctx.translate(baseX + rect.x, baseY + rect.y);
        } else {
            ctx.translate(baseX + rect.x + rotationCenterX, baseY + rect.y + rotationCenterY);
            ctx.rotate(-rotation); // Apply the rotation
            ctx.translate(-rotationCenterX, -rotationCenterY); // Translate back
        }
        ctx.globalAlpha = opacity; // Set the opacity
        ctx.fillStyle = rgbaIntToHex(rgba, this.component.getCanvasAlpha());
        ctx.fillRect(0, 0, rect.width, rect.height); // Draw the rectangle at the origin
        ctx.restore();
        this.component.makeDirty();
    }

    doDrawClearedRect(rect: Rect) {
        const baseX = this.component.x + rect.x;
        const baseY = this.component.y + rect.y;
        const ctx = this.component.getContext();
        ctx.save();
        ctx.clearRect(baseX, baseY, rect.width, rect.height);
        ctx.restore();
    }

    doDrawText(text: string, x: number, y: number, rgba: number, opacity: number, font: RoFont) {
        if (text === "") {
            // nothing to draw
            return;
        }
        const baseX = this.component.x;
        const baseY = this.component.y;
        const ctx = this.component.getContext();
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = rgbaIntToHex(rgba, this.component.getCanvasAlpha());
        ctx.font = font.toFontString();
        ctx.textBaseline = "alphabetic";
        ctx.fillText(text, baseX + x, baseY + y + font.getBaselineOffset(text));
        ctx.restore();
        this.component.makeDirty();
    }

    doDrawRotatedText(
        text: string,
        x: number,
        y: number,
        rgba: number,
        opacity: number,
        font: RoFont,
        rotation: number
    ) {
        if (text === "") {
            // nothing to draw
            return;
        }
        const baseX = this.component.x;
        const baseY = this.component.y;
        const ctx = this.component.getContext();
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(baseX + x, baseY + y);
        if (rotation !== 0) {
            ctx.rotate(-rotation);
        }
        ctx.fillStyle = rgbaIntToHex(rgba, this.component.getCanvasAlpha());
        ctx.font = font.toFontString();
        ctx.textBaseline = "alphabetic";
        ctx.fillText(text, 0, font.getBaselineOffset(text));
        ctx.restore();
        this.component.makeDirty();
    }

    /**
     * Saves the current drawing context state and applies a rectangular clipping region.
     * Subsequent drawing operations will be limited to this rectangle.
     * Must be paired with a call to popClip().
     * @param rect The clipping rectangle in the current coordinate system.
     */
    pushClip(rect: Rect) {
        const ctx = this.component.getContext();
        ctx.save();
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.clip();
        this.clipDepth++;
    }

    /**
     * Restores the drawing context state that was saved by the corresponding pushClip() call,
     * effectively removing the last applied clipping region.
     */
    popClip() {
        if (this.clipDepth === 0) {
            return;
        }
        const ctx = this.component.getContext();
        ctx.restore();
        this.clipDepth--;
    }

    /**
     * Unwinds any clipping regions still active, restoring the context to its unclipped state.
     *
     * `pushClip` is `ctx.save()` and `popClip` is `ctx.restore()`, so an unbalanced pair is not a
     * transient glitch: the canvas keeps the stale clip for the rest of its life, and every later
     * frame draws inside it. Render code brackets its own clips with try/finally, but an error
     * escaping from arbitrary BrightScript (an item component's `init()`, a field observer) can
     * still unwind past a bracket that has not been reached yet. Called from a `finally` around the
     * per-frame paint so one bad frame cannot poison the next.
     */
    resetClips() {
        while (this.clipDepth > 0) {
            this.popClip();
        }
    }

    /** Depth of the active clip stack. Exposed for the frame-level balance check and tests. */
    getClipDepth(): number {
        return this.clipDepth;
    }

    /**
     * Applies a division-free scale-around-pivot bracket: translate(pivot) -> scale -> translate(-pivot).
     * `pivotX`/`pivotY` are in the node's local (pre-canvas-origin) coordinate space - the same
     * convention every doDrawRotated* method uses - so this adds `this.component.x/y` internally.
     *
     * Mathematically an exact no-op at scale [1,1] for any pivot, so callers may compute the pivot
     * from whatever origin/scaleRotateCenter is convenient without perturbing the common, unscaled
     * case. Never divides by scale, so scale [0,0] just collapses everything drawn inside the
     * bracket to the pivot point rather than risking a NaN/Infinity translate.
     *
     * Kept independent of the clip stack: this only ever brackets a synchronous, JS-only draw call
     * with a try/finally around it (no BrightScript runs in between), so there's no equivalent of
     * the cross-frame clip leak that `resetClips()` guards against.
     *
     * @returns Whether a transform was pushed (false at scale [1,1] - caller can skip popScale()).
     */
    pushScale(pivotX: number, pivotY: number, scaleX: number, scaleY: number): boolean {
        if (scaleX === 1 && scaleY === 1) {
            return false;
        }
        const ctx = this.component.getContext();
        ctx.save();
        this.composeScalePivot(ctx, this.component.x + pivotX, this.component.y + pivotY, scaleX, scaleY);
        return true;
    }

    /**
     * Composes `translate(pivot) -> scale -> translate(-pivot)` onto the canvas's CURRENT
     * transform. Caller owns `ctx.save()`/`ctx.restore()` — shared by `doDrawRotatedRect` (which
     * composes onto its own already-open save, alongside rotation) and `pushScale` (which opens
     * its own save for text drawing, since `doDrawRotatedText` never takes a scale param).
     */
    private composeScalePivot(ctx: BrsCanvasContext2D, pivotX: number, pivotY: number, scaleX: number, scaleY: number) {
        ctx.translate(pivotX, pivotY);
        ctx.scale(scaleX, scaleY);
        ctx.translate(-pivotX, -pivotY);
    }

    /** Pairs with a `pushScale()` call that returned true. */
    popScale(): void {
        this.component.getContext().restore();
    }

    drawNinePatch(bitmap: RoBitmap, rect: Rect, rgba?: number, opacity?: number) {
        const ctx = this.component.getContext();
        const style = resolveBlitStyle(rgba, opacity);
        const image = getCanvasFromDraw2d(bitmap, style.rgba);
        const patchSizes = bitmap.getPatchSizes();
        if (!patchSizes) {
            return;
        }
        const x = rect.x;
        const y = rect.y;
        const width = rect.width;
        const height = rect.height;
        const sw = image.width;
        const sh = image.height;

        const lw = patchSizes.left; // Left fixed-corner width
        const rw = patchSizes.right; // Right fixed-corner width
        const th = patchSizes.top; // Top fixed-corner height
        const bh = patchSizes.bottom; // Bottom fixed-corner height

        const cw = Math.max(0, sw - 2 - lw - rw); // Center source width (drawable area)
        const ch = Math.max(0, sh - 2 - th - bh); // Center source height (drawable area)

        // A 9-patch cannot render smaller than its fixed corners, so clamp the drawn size to the
        // corner sum. This keeps the rounded ends from overlapping/inverting at tiny sizes (e.g. a
        // progress-bar fill at 0.0, which collapses to a single pill/dot instead of disappearing or
        // rendering reversed). For normal sizes (width/height >= corner sum) this is a no-op.
        const drawW = Math.max(width, lw + rw); // Drawn width (never below the fixed corners)
        const drawH = Math.max(height, th + bh); // Drawn height (never below the fixed corners)

        const targetCW = Math.max(0, drawW - lw - rw); // Target center width
        const targetCH = Math.max(0, drawH - th - bh); // Target center height

        const drawPart = (
            sx: number,
            sy: number,
            sw: number,
            sh: number,
            dx: number,
            dy: number,
            dw: number,
            dh: number
        ) => {
            // Ensure destination coords/dims are integers to potentially avoid sub-pixel gaps/overlaps
            const i_dx = Math.round(dx);
            const i_dy = Math.round(dy);
            const i_dw = Math.round(dw);
            const i_dh = Math.round(dh);
            // Only draw if source and rounded destination dimensions are positive
            if (sw > 0 && sh > 0 && i_dw > 0 && i_dh > 0) {
                drawChunk(ctx, image, { sx, sy, sw, sh, dx: i_dx, dy: i_dy, dw: i_dw, dh: i_dh });
            }
        };

        ctx.save();
        // Set context properties (alpha blending, smoothing)
        setContextGlobalAlpha(ctx, style.alpha);
        const smoothing = bitmap.scaleMode === 1;
        ctx.imageSmoothingEnabled = smoothing;
        if (smoothing && "imageSmoothingQuality" in ctx) {
            ctx.imageSmoothingQuality = "high";
        }

        // Top-left corner
        drawPart(1, 1, lw, th, x, y, lw, th);

        // Top edge
        drawPart(1 + lw, 1, cw, th, x + lw, y, targetCW, th);

        // Top-right corner
        drawPart(sw - 1 - rw, 1, rw, th, x + drawW - rw, y, rw, th);

        // Left edge
        drawPart(1, 1 + th, lw, ch, x, y + th, lw, targetCH);

        // Center
        drawPart(1 + lw, 1 + th, cw, ch, x + lw, y + th, targetCW, targetCH);

        // Right edge
        drawPart(sw - 1 - rw, 1 + th, rw, ch, x + drawW - rw, y + th, rw, targetCH);

        // Bottom-left corner
        drawPart(1, sh - 1 - bh, lw, bh, x, y + drawH - bh, lw, bh);

        // Bottom edge
        drawPart(1 + lw, sh - 1 - bh, cw, bh, x + lw, y + drawH - bh, targetCW, bh);

        // Bottom-right corner
        drawPart(sw - 1 - rw, sh - 1 - bh, rw, bh, x + drawW - rw, y + drawH - bh, rw, bh);

        ctx.restore();
        this.component.makeDirty();
    }

    /** Clear the bitmap, and fill with the specified RGBA color */
    readonly clear = new Callable("clear", {
        signature: {
            args: [new StdlibArgument("rgba", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, rgba: Int32) => {
            this.doClearCanvas(rgba.getValue());
            return BrsInvalid.Instance;
        },
    });

    /** Draw the source object, where src is an roBitmap or an roRegion object, at position x,y */
    readonly drawObject = new Callable("drawObject", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("object", ValueKind.Object),
                new StdlibArgument("rgba", ValueKind.Int32, BrsInvalid.Instance),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, x: Int32, y: Int32, object: BrsComponent, rgba: Int32 | BrsInvalid) => {
            const didDraw = this.component.drawImage(
                object,
                x.getValue(),
                y.getValue(),
                1,
                1,
                rgba instanceof Int32 ? rgba.getValue() : undefined
            );
            return BrsBoolean.from(didDraw);
        },
    });

    /** Draw the source object at position x,y rotated by angle theta degrees. */
    readonly drawRotatedObject = new Callable("drawRotatedObject", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("theta", ValueKind.Float),
                new StdlibArgument("object", ValueKind.Object),
                new StdlibArgument("rgba", ValueKind.Int32, BrsInvalid.Instance),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, x: Int32, y: Int32, theta: Float, object: BrsComponent, rgba: Int32 | BrsInvalid) => {
            const didDraw = drawRotatedObject(
                this.component,
                object,
                x.getValue(),
                y.getValue(),
                theta.getValue(),
                rgba instanceof Int32 ? rgba.getValue() : undefined
            );
            this.component.makeDirty();
            return BrsBoolean.from(didDraw);
        },
    });

    /** Draw the source object, at position x,y, scaled horizontally by scaleX and vertically by scaleY. */
    readonly drawScaledObject = new Callable("drawScaledObject", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("scaleX", ValueKind.Float),
                new StdlibArgument("scaleY", ValueKind.Float),
                new StdlibArgument("object", ValueKind.Object),
                new StdlibArgument("rgba", ValueKind.Int32, BrsInvalid.Instance),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (
            _: Interpreter,
            x: Int32,
            y: Int32,
            scaleX: Float,
            scaleY: Float,
            object: BrsComponent,
            rgba: Int32 | BrsInvalid
        ) => {
            const didDraw = this.component.drawImage(
                object,
                x.getValue(),
                y.getValue(),
                scaleX.getValue(),
                scaleY.getValue(),
                rgba instanceof Int32 ? rgba.getValue() : undefined
            );
            return BrsBoolean.from(didDraw);
        },
    });

    /** Draw the source object, at position x,y, rotated by theta and scaled horizontally by scaleX and vertically by scaleY. */
    readonly drawTransformedObject = new Callable("drawTransformedObject", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("theta", ValueKind.Float),
                new StdlibArgument("scaleX", ValueKind.Float),
                new StdlibArgument("scaleY", ValueKind.Float),
                new StdlibArgument("object", ValueKind.Object),
                new StdlibArgument("rgba", ValueKind.Int32, BrsInvalid.Instance),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (
            _: Interpreter,
            x: Int32,
            y: Int32,
            theta: Float,
            scaleX: Float,
            scaleY: Float,
            object: BrsComponent,
            rgba: Int32 | BrsInvalid
        ) => {
            const ctx = this.component.getContext();
            const positionX = x.getValue();
            const positionY = y.getValue();
            const angleInRad = (-theta.getValue() * Math.PI) / 180;
            ctx.save();
            ctx.translate(positionX, positionY);
            ctx.rotate(angleInRad);
            const didDraw = this.component.drawImage(
                object,
                0,
                0,
                scaleX.getValue(),
                scaleY.getValue(),
                rgba instanceof Int32 ? rgba.getValue() : undefined
            );
            ctx.restore();
            return BrsBoolean.from(didDraw);
        },
    });

    /** Draw a line from (xStart, yStart) to (xEnd, yEnd) with RGBA color */
    readonly drawLine = new Callable("drawLine", {
        signature: {
            args: [
                new StdlibArgument("xStart", ValueKind.Int32),
                new StdlibArgument("yStart", ValueKind.Int32),
                new StdlibArgument("xEnd", ValueKind.Int32),
                new StdlibArgument("yEnd", ValueKind.Int32),
                new StdlibArgument("rgba", ValueKind.Int32),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, xStart: Int32, yStart: Int32, xEnd: Int32, yEnd: Int32, rgba: Int32) => {
            const baseX = this.component.x;
            const baseY = this.component.y;
            const ctx = this.component.getContext();
            ctx.beginPath();
            ctx.strokeStyle = rgbaIntToHex(rgba.getValue(), this.component.getCanvasAlpha());
            ctx.moveTo(baseX + xStart.getValue(), baseY + yStart.getValue());
            ctx.lineTo(baseX + xEnd.getValue(), baseY + yEnd.getValue());
            ctx.stroke();
            this.component.makeDirty();
            return BrsBoolean.True;
        },
    });

    /** Draws a point at (x,y) with the given size and RGBA color */
    readonly drawPoint = new Callable("drawPoint", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("size", ValueKind.Float),
                new StdlibArgument("rgba", ValueKind.Int32),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, x: Int32, y: Int32, size: Float, rgba: Int32) => {
            const baseX = this.component.x;
            const baseY = this.component.y;
            const ctx = this.component.getContext();
            ctx.fillStyle = rgbaIntToHex(rgba.getValue(), this.component.getCanvasAlpha());
            ctx.fillRect(baseX + x.getValue(), baseY + y.getValue(), size.getValue(), size.getValue());
            this.component.makeDirty();
            return BrsBoolean.True;
        },
    });

    /** Fill the specified rectangle from left (x), top (y) to right (x + width), bottom (y + height) with the RGBA color */
    readonly drawRect = new Callable("drawRect", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("width", ValueKind.Int32),
                new StdlibArgument("height", ValueKind.Int32),
                new StdlibArgument("rgba", ValueKind.Int32),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, x: Int32, y: Int32, width: Int32, height: Int32, rgba: Int32) => {
            const baseX = this.component.x + x.getValue();
            const baseY = this.component.y + y.getValue();
            const ctx = this.component.getContext();
            if (this.component instanceof RoScreen && !this.component.getCanvasAlpha()) {
                ctx.clearRect(baseX, baseY, width.getValue(), height.getValue());
                ctx.fillStyle = rgbaIntToHex(rgba.getValue(), true);
            } else {
                ctx.fillStyle = rgbaIntToHex(rgba.getValue(), this.component.getCanvasAlpha());
            }
            ctx.fillRect(baseX, baseY, width.getValue(), height.getValue());
            this.component.makeDirty();
            return BrsBoolean.True;
        },
    });

    /** Draws the text at position (x,y) using the specified RGBA color and roFont font object. */
    readonly drawText = new Callable("drawText", {
        signature: {
            args: [
                new StdlibArgument("text", ValueKind.String),
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("rgba", ValueKind.Int32),
                new StdlibArgument("font", ValueKind.Object),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, text: BrsString, x: Int32, y: Int32, rgba: Int32, font: RoFont) => {
            this.doDrawText(text.value, x.getValue(), y.getValue(), rgba.getValue(), 1, font);
            return BrsBoolean.True;
        },
    });

    /** Realize the bitmap by finishing all queued draw calls. */
    readonly finish = new Callable("finish", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.component.finishDraw();
            return BrsInvalid.Instance;
        },
    });

    /** Returns true if alpha blending is enabled */
    readonly getAlphaEnable = new Callable("getAlphaEnable", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.component.getCanvasAlpha());
        },
    });

    /** If enable is true, do alpha blending when this bitmap is the destination */
    readonly setAlphaEnable = new Callable("setAlphaEnable", {
        signature: {
            args: [new StdlibArgument("alphaEnable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, alphaEnable: BrsBoolean) => {
            this.component.setCanvasAlpha(alphaEnable.toBoolean());
            return BrsInvalid.Instance;
        },
    });

    /** Return the width of the screen/bitmap/region. */
    readonly getWidth = new Callable("getWidth", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.component.width);
        },
    });

    /** Return the height of the screen/bitmap/region. */
    readonly getHeight = new Callable("getHeight", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.component.height);
        },
    });

    /** Returns an roByteArray representing the RGBA pixel values for the rectangle described by the parameters. */
    readonly getByteArray = new Callable("getByteArray", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("width", ValueKind.Int32),
                new StdlibArgument("height", ValueKind.Int32),
            ],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, x: Int32, y: Int32, width: Int32, height: Int32) => {
            const baseX = this.component.x;
            const baseY = this.component.y;
            const ctx = this.component.getCanvas().getContext("2d") as BrsCanvasContext2D;
            const imgData = ctx.getImageData(
                baseX + x.getValue(),
                baseY + y.getValue(),
                width.getValue(),
                height.getValue()
            );
            const byteArray = new Uint8Array(imgData.data.buffer);
            return new RoByteArray(byteArray);
        },
    });

    /** Returns an roByteArray object containing PNG image data for the specified area of the bitmap. */
    readonly getPng = new Callable("getPng", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("width", ValueKind.Int32),
                new StdlibArgument("height", ValueKind.Int32),
            ],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter, x: Int32, y: Int32, width: Int32, height: Int32) => {
            const baseX = this.component.x;
            const baseY = this.component.y;
            const ctx = this.component.getCanvas().getContext("2d") as BrsCanvasContext2D;
            const imgData = ctx.getImageData(
                baseX + x.getValue(),
                baseY + y.getValue(),
                width.getValue(),
                height.getValue()
            );
            return new RoByteArray(
                new Uint8Array(UPNG.encode([imgData.data.buffer as ArrayBuffer], imgData.width, imgData.height, 0))
            );
        },
    });
}

export interface BrsDraw2D {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    scaleMode: number;

    clearCanvas(rgba: number): void;

    getContext(): BrsCanvasContext2D;

    getCanvas(): BrsCanvas;

    getRgbaCanvas(rgba: number): BrsCanvas;

    setCanvasAlpha(alphaEnable: boolean): void;

    getCanvasAlpha(): boolean;

    /**
     * `alpha` is the blit transparency when it must be carried SEPARATELY from `rgba` — an untinted draw
     * at a reduced opacity has no color to pack an alpha byte into.
     *
     * It is the FINAL blit alpha, not an extra factor: when given, it REPLACES the one `rgba`'s low byte
     * would imply rather than multiplying with it. Callers that have both must fold them together first
     * (that is what `resolveBlitStyle` does), or the color's transparency is silently dropped. Omit it to
     * derive the alpha from `rgba`.
     */
    drawImage(
        object: BrsComponent,
        x: number,
        y: number,
        scaleX?: number,
        scaleY?: number,
        rgba?: number,
        alpha?: number
    ): boolean;

    makeDirty(): void;

    finishDraw(): void;
}

// In Chrome, when this is enabled, it slows down non-alpha draws. However, when this is true, it behaves the same as Roku
// Also, in Firefox, draws slow down when this is false. So it's a trade-off
const USE_IMAGE_DATA_WHEN_ALPHA_DISABLED = true;

/**
 * The `globalAlpha` a blend color implies, as a 0..1 factor. `1` (fully opaque) when there is no color.
 *
 * The ONE place that answers "what transparency does this rgba mean", so nothing can disagree about it.
 * Two inputs made that a real bug rather than a tidiness concern: `0x00000000` is a legitimate color
 * whose entire packed value is falsy, so a truthiness guard here painted a fully transparent blend as
 * SOLID BLACK (`RoBitmap.getRgbaCanvas` applies the RGB tint at full strength regardless of alpha,
 * #935, so there is nothing to fall back on); and `NaN` used to mean "no tint" to `getCanvasFromDraw2d`
 * and "alpha 0" to the alpha path, which made a NaN blend color an invisible draw.
 */
function blitAlphaOf(rgba?: number): number {
    return rgba === undefined || Number.isNaN(rgba) ? 1 : (rgba & 0xff) / 255;
}

/** Writes `globalAlpha` when the blit is not fully opaque, and reports whether it wrote. */
function setContextGlobalAlpha(ctx: BrsCanvasContext2D, alpha: number): boolean {
    if (alpha < 1) {
        ctx.globalAlpha = Math.max(0, alpha);
        return true;
    }
    return false;
}

function getCanvasFromDraw2d(object: BrsDraw2D, rgba?: number): BrsCanvas {
    let cvs: BrsCanvas;
    if (rgba !== undefined && !Number.isNaN(rgba) && !(object instanceof RoScreen)) {
        cvs = object.getRgbaCanvas(rgba);
    } else {
        cvs = object.getCanvas();
    }
    return cvs;
}

function isCanvasValid(cvs?: BrsCanvas): boolean {
    if (!cvs) {
        return false;
    }
    const sizeOk = !!(cvs.height && cvs.height >= 1 && cvs.width && cvs.width >= 1);
    return sizeOk;
}

export class DrawOffset {
    x: number = 0;
    y: number = 0;
}

export function getDrawOffset(object: BrsDraw2D | RoCompositor): DrawOffset {
    let x = 0,
        y = 0;
    if (object instanceof RoRegion) {
        x = object.getPosX();
        y = object.getPosY();
    }
    return { x, y };
}

function getPreTranslation(object: BrsDraw2D): DrawOffset {
    let x = 0,
        y = 0;
    if (object instanceof RoRegion || object instanceof RoAnimatedImage) {
        x = object.getTransX();
        y = object.getTransY();
    }
    return { x, y };
}

export class Dimensions {
    constructor(public width: number, public height: number) {}
}

export function getDimensions(object: BrsDraw2D | RoCompositor | BrsCanvas): Dimensions {
    if (object instanceof RoRegion || object instanceof RoBitmap) {
        return new Dimensions(object.width, object.height);
    } else if (object instanceof RoScreen) {
        return new Dimensions(object.getCanvas().width, object.getCanvas().height);
    } else if (object instanceof RoCompositor) {
        return new Dimensions(object.getContext().canvas.width, object.getContext().canvas.height);
    }
    return new Dimensions(object.width, object.height);
}

interface DrawChunk {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    dx: number;
    dy: number;
    dw: number;
    dh: number;
}

/**
 *  Sometimes (eg. with roCompositor) a drawn region might wrap.
 *  This means there could be multiple canvas draws that are needed for a single object drawn to screen
 *  This function figures that out, and returns the correct pieces of the original to draw, and where they should go
 */
function getDrawChunks(
    destOffset: DrawOffset,
    allowWrap: boolean,
    object: BrsDraw2D,
    x: number,
    y: number,
    scaleX: number = 1,
    scaleY: number = 1
): DrawChunk[] {
    const chunks: DrawChunk[] = [];
    const offset = getDrawOffset(object);
    const preTrans = getPreTranslation(object);
    const tx = preTrans.x * scaleX;
    const ty = preTrans.y * scaleY;
    const sx = offset.x;
    const sy = offset.y;
    const sw = object.width;
    const sh = object.height;

    const dx = x + tx + destOffset.x;
    const dy = y + ty + destOffset.y;

    const dw = sw * scaleX;
    const dh = sh * scaleY;

    if (dw === 0 || dh === 0) {
        return [];
    }

    chunks.push({ sx, sy, sw, sh, dx, dy, dw, dh });

    if (
        !allowWrap ||
        object instanceof RoBitmap ||
        object instanceof RoScreen ||
        (object instanceof RoRegion && !object.getWrapValue())
    ) {
        // No wraps, so just one image chunk to draw
        return chunks;
    } else if (!(object instanceof RoRegion)) {
        return chunks;
    }

    const sourceDimensions = getDimensions(object.getSourceBitmap());
    const actualDrawWidth = Math.min(sourceDimensions.width - offset.x, sw);
    const actualDrawHeight = Math.min(sourceDimensions.height - offset.y, sh);

    const missingHorizontal = sw - actualDrawWidth;
    const missingVertical = sh - actualDrawHeight;

    if (missingHorizontal <= 0 && missingVertical <= 0) {
        // region fits over destination - no need to wrap
        return chunks;
    }

    if (missingHorizontal > 0) {
        // missing right chunk
        chunks.push({
            sx: 0,
            sy: offset.y,
            sw: missingHorizontal,
            sh: actualDrawHeight,
            dx: actualDrawWidth + dx,
            dy,
            dw: missingHorizontal,
            dh: actualDrawHeight,
        });
    }
    if (missingVertical > 0) {
        // missing bottom chunk
        chunks.push({
            sx: offset.x,
            sy: 0,
            sw: actualDrawWidth,
            sh: missingVertical,
            dx: dx,
            dy: actualDrawHeight + dy,
            dw: actualDrawWidth,
            dh: missingVertical,
        });
    }
    if (missingHorizontal > 0 && missingVertical > 0) {
        // missing bottom/right chunk
        chunks.push({
            sx: 0,
            sy: 0,
            sw: missingHorizontal,
            sh: missingVertical,
            dx: actualDrawWidth + dx,
            dy: actualDrawHeight + dy,
            dw: missingHorizontal,
            dh: missingVertical,
        });
    }
    return chunks;
}

export function drawObjectToComponent(
    component: BrsDraw2D | RoCompositor,
    object: BrsComponent,
    x: number,
    y: number,
    scaleX: number = 1,
    scaleY: number = 1,
    rgba?: number,
    alpha?: number,
    scaleMode?: number
): boolean {
    const ctx = component.getContext();
    if (
        !(
            object instanceof RoBitmap ||
            object instanceof RoRegion ||
            object instanceof RoScreen ||
            object instanceof RoAnimatedImage
        )
    ) {
        return false;
    }
    // Resolved and checked BEFORE the tint: a fully transparent blit contributes nothing, and
    // `getCanvasFromDraw2d` would otherwise build a whole tinted canvas — a fresh surface plus a
    // full-surface multiply — to draw with it. Measured at 0.71ms for a cold 300x300 tint, ~4x a real
    // blit, thrown away. The tint cache is a single slot on a `RoBitmap` shared across nodes, so a grid
    // with `focusFootprintBlendColor = 0x00000000` next to any other blend color rebuilds it every frame.
    // Validity is still reported off the untinted source, which a tint never changes the size of, so the
    // return value is what it would have been. It must also leave the destination ALONE: on a non-alpha
    // target the draw loop replaces the rect rather than compositing over it, so drawing a 0-alpha blit
    // would erase what was there (an `roScreen` defaults to alphaEnable false — a transparent hole in an
    // opaque screen). Only reachable since alpha 0 started being honored; before that it drew opaque.
    const blitAlpha = alpha ?? blitAlphaOf(rgba);
    if (blitAlpha === 0) {
        return isCanvasValid(object.getCanvas());
    }
    const image = getCanvasFromDraw2d(object, rgba);
    if (!isCanvasValid(image)) {
        return false;
    }
    const alphaEnable = component.getCanvasAlpha();
    // `globalAlpha` is PERSISTENT canvas state, and this function is reached from every
    // `RoBitmap`/`RoScreen`/`RoRegion`/`RoCompositor` drawImage — so the reset lives here, at the shared
    // choke point, rather than in each caller. A leak would be inherited by every later draw on the
    // canvas, and since a blend color of 0x00000000 legitimately sets the alpha to 0, it would blank the
    // canvas permanently rather than merely tint it. Reset only when the alpha was actually written
    // (the opaque draw, which is the overwhelmingly common one, then costs nothing) and in a `finally`,
    // so a throw mid-blit cannot strand it. Targeted rather than `ctx.save()`/`restore()`: that pair
    // copies the whole drawing state on every single blit, and shares its stack with `pushClip`.
    const alphaSet = setContextGlobalAlpha(ctx, blitAlpha);
    try {
        const smoothing = (scaleMode ?? object.scaleMode) === 1;
        ctx.imageSmoothingEnabled = smoothing;
        if (smoothing && "imageSmoothingQuality" in ctx) {
            ctx.imageSmoothingQuality = "high";
        }

        const destOffset = getDrawOffset(component);

        // Only Compositor and Region uses wraps
        const allowWrap = component instanceof RoCompositor || object instanceof RoRegion;

        const chunks = getDrawChunks(destOffset, allowWrap, object, x, y, scaleX, scaleY);
        for (const chunk of chunks) {
            const { sx, sy, sw, sh, dx, dy, dw, dh } = chunk;
            if (!alphaEnable) {
                ctx.clearRect(dx, dy, sw * scaleX, sh * scaleY);
            }
            drawChunk(ctx, image, chunk);
        }
        return true;
    } finally {
        if (alphaSet) {
            ctx.globalAlpha = 1;
        }
    }
}

export function drawBitmapOnBitmap(source: RoBitmap, destiny: RoBitmap, scaleMode?: number) {
    const canvas = source.getCanvas();
    const ctx = destiny.getContext();
    ctx.save();
    const smoothing = (scaleMode ?? destiny.scaleMode) === 1;
    ctx.imageSmoothingEnabled = smoothing;
    if (smoothing && "imageSmoothingQuality" in ctx) {
        ctx.imageSmoothingQuality = "high";
    }
    const chunk = {
        sx: 0,
        sy: 0,
        sw: source.width,
        sh: source.height,
        dx: 0,
        dy: 0,
        dw: destiny.width,
        dh: destiny.height,
    };
    drawChunk(ctx, canvas, chunk);
    ctx.restore();
}

export function drawImageToContext(
    ctx: BrsCanvasContext2D,
    image: BrsCanvas,
    alphaEnable: boolean,
    x: number,
    y: number
): boolean {
    if (!isCanvasValid(image)) {
        return false;
    }
    if (!USE_IMAGE_DATA_WHEN_ALPHA_DISABLED) {
        if (!alphaEnable) {
            ctx.clearRect(x, y, image.width, image.height);
        }
        drawImageAtPos(image, ctx, x, y);
    } else if (alphaEnable) {
        drawImageAtPos(image, ctx, x, y);
    } else {
        const ctc = image.getContext("2d") as BrsCanvasContext2D;
        let imageData = ctc.getImageData(0, 0, image.width, image.height);
        let pixels = imageData.data;
        for (let i = 3, n = image.width * image.height * 4; i < n; i += 4) {
            pixels[i] = 255;
        }
        putImageAtPos(imageData, ctx, x, y);
    }
    return true;
}

export function drawRotatedObject(
    component: BrsDraw2D,
    object: BrsComponent,
    x: number,
    y: number,
    angle: number,
    rgba?: number
): boolean {
    const ctx = component.getContext();
    const angleInRad = (-angle * Math.PI) / 180;
    ctx.save();
    ctx.translate(x, y);
    if (angleInRad !== 0) {
        ctx.rotate(angleInRad);
    }
    const didDraw = component.drawImage(object, 0, 0, 1, 1, rgba);
    ctx.restore();
    return didDraw;
}

export function createNewCanvas(width: number, height: number) {
    /// #if BROWSER
    return new OffscreenCanvas(width, height);
    /// #else
    return createCanvas(width, height);
    /// #endif
}

export function releaseCanvas(canvas: BrsCanvas) {
    canvas.width = 0;
    canvas.height = 0;
}

export function drawImageAtPos(image: BrsCanvas, ctx: BrsCanvasContext2D, x: number, y: number) {
    if (image.width === 0 || image.height === 0) {
        return;
    }
    /// #if BROWSER
    if (ctx instanceof OffscreenCanvasRenderingContext2D && image instanceof OffscreenCanvas) {
        ctx.drawImage(image, x, y);
    }
    /// #else
    if (ctx instanceof CanvasRenderingContext2D && image instanceof Canvas) {
        ctx.drawImage(image, x, y);
    }
    /// #endif
}

export function putImageAtPos(imageData: BrsImageData, ctx: BrsCanvasContext2D, x: number, y: number) {
    /// #if BROWSER
    if (ctx instanceof OffscreenCanvasRenderingContext2D && imageData instanceof ImageData) {
        ctx.putImageData(imageData, x, y);
    }
    /// #else
    if (ctx instanceof CanvasRenderingContext2D) {
        ctx.putImageData(imageData, x, y);
    }
    /// #endif
}

export function rgbaIntToHex(rgba: number, alpha: boolean = true): string {
    if (!alpha) {
        rgba = rgbaToOpaque(rgba);
    }
    return "#" + numberToHex(rgba, "0");
}

export function rgbaToTransparent(rgba: number): number {
    return rgba - (rgba & 0xff);
}

export function rgbaToOpaque(rgba: number): number {
    return rgba - (rgba & 0xff) + 0xff;
}

export function RectRect(rect1: Rect, rect2: Rect): boolean {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

// return true if the rectangle and circle are colliding
// from: https://stackoverflow.com/questions/21089959/detecting-collision-of-rectangle-with-circle
export function RectCircle(rect: Rect, circle: Circle): boolean {
    const distX = Math.abs(circle.x - rect.x - rect.width / 2);
    const distY = Math.abs(circle.y - rect.y - rect.height / 2);

    if (distX > rect.width / 2 + circle.r) {
        return false;
    }
    if (distY > rect.height / 2 + circle.r) {
        return false;
    }

    if (distX <= rect.width / 2) {
        return true;
    }
    if (distY <= rect.height / 2) {
        return true;
    }

    const dx = distX - rect.width / 2;
    const dy = distY - rect.height / 2;
    return dx * dx + dy * dy <= circle.r * circle.r;
}

// ported from: https://github.com/Romans-I-XVI/monoEngine/blob/master/MonoEngine/CollisionChecking.cs
export function CircleCircle(circle1: Circle, circle2: Circle): boolean {
    const distanceX = circle1.x - circle2.x;
    const distanceY = circle1.y - circle2.y;
    const dist = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    return dist <= circle1.r + circle2.r;
}

/**
 * Blits a scaled sub-region of a source canvas onto a destination context, handling the
 * OffscreenCanvas (browser) vs node `Canvas` type guards in one place so callers in other
 * bundles don't have to duplicate them.
 */
export function drawCanvasRegion(
    ctx: BrsCanvasContext2D,
    image: BrsCanvas,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number
) {
    drawChunk(ctx, image, { sx, sy, sw, sh, dx, dy, dw, dh });
}

function drawChunk(ctx: BrsCanvasContext2D, image: BrsCanvas, chunk: DrawChunk) {
    if (image.width === 0 || image.height === 0) {
        return;
    }
    const { sx, sy, sw, sh, dx, dy, dw, dh } = chunk;
    /// #if BROWSER
    if (ctx instanceof OffscreenCanvasRenderingContext2D && image instanceof OffscreenCanvas) {
        ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    /// #else
    if (ctx instanceof CanvasRenderingContext2D && image instanceof Canvas) {
        ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    /// #endif
}

/** The two independent things a blend color and a node opacity resolve to for one blit. */
type BlitStyle = {
    /** The color to MULTIPLY the source by, or `undefined` for no tint at all. */
    rgba?: number;
    /** The `globalAlpha` to blit at, 0..1. `1` means "leave globalAlpha alone". */
    alpha: number;
};

/**
 * Resolves a blend color and an opacity into the tint and the blit alpha.
 *
 * These are deliberately NOT folded back into one packed integer. Doing that forced a base color to
 * exist whenever an opacity was given, and the old `rgba ?? 0xffffffff` FABRICATED opaque white —
 * re-injecting the very "no blend color" value the caller had just resolved away. Every partially
 * transparent image drawn at opacity < 1 therefore took the tint path: measured RGB drift of
 * [+29,+77,+103] on a 50%-alpha pixel at opacity 0.5, i.e. every fade of an image with soft or
 * antialiased edges faded toward WHITE rather than merely fading. It also paid for a
 * `getRgbaCanvas` canvas allocation and a full-surface pass on every frame of every fade.
 *
 * A negative `opacity` means "not given", matching the pre-existing behavior that
 * `.claude/docs/scenegraph-invariants.md` records as an unmeasured divergence and leaves alone.
 */
function resolveBlitStyle(rgba?: number, opacity?: number): BlitStyle {
    const hasColor = rgba !== undefined && !Number.isNaN(rgba);
    const factor = opacity === undefined || opacity < 0 || opacity >= 1 ? 1 : opacity;
    return { rgba: hasColor ? rgba : undefined, alpha: Math.max(0, blitAlphaOf(rgba) * factor) };
}
