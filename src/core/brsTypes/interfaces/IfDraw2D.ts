import {
    BrsBoolean,
    BrsInvalid,
    BrsString,
    Callable,
    Float,
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
        object: RoBitmap,
        rgba?: number,
        opacity?: number
    ): boolean {
        const ctx = this.component.getContext();
        rgba = combineRgbaOpacity(rgba, opacity);
        const didDraw = this.component.drawImage(object, x, y, scaleX, scaleY, rgba);
        ctx.globalAlpha = 1.0;
        return didDraw;
    }

    doDrawCroppedBitmap(
        object: RoBitmap,
        sourceRect: Rect,
        destRect: Rect,
        rgba?: number,
        opacity?: number
    ): boolean {
        const ctx = this.component.getContext();
        rgba = combineRgbaOpacity(rgba, opacity);
        const image = getCanvasFromDraw2d(object, rgba);
        ctx.save();
        // Set context properties (alpha blending, smoothing)
        setContextAlpha(ctx, rgba);
        ctx.imageSmoothingEnabled = object.scaleMode === 1;

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
        object: RoBitmap,
        centerX?: number,
        centerY?: number,
        rgba?: number,
        opacity?: number
    ) {
        const baseX = this.component.x;
        const baseY = this.component.y;
        const ctx = this.component.getContext();
        rgba = combineRgbaOpacity(rgba, opacity);
        ctx.save();
        const rotationCenterX = centerX !== undefined ? centerX : 0;
        const rotationCenterY = centerY !== undefined ? centerY : 0;
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
        this.component.drawImage(object, 0, 0, 1, 1, rgba);
        ctx.restore();
        this.component.makeDirty();
    }

    doDrawRotatedRect(
        rect: Rect,
        rgba: number,
        rotation: number,
        center?: number[],
        opacity: number = 1.0
    ) {
        const baseX = this.component.x;
        const baseY = this.component.y;
        const ctx = this.component.getContext();
        ctx.save();
        // Default to top-left corner if centerX and centerY are not provided
        const rotationCenterX = center !== undefined ? center[0] : 0;
        const rotationCenterY = center !== undefined ? center[1] : 0;
        if (rotation !== 0) {
            ctx.translate(baseX + rect.x + rotationCenterX, baseY + rect.y + rotationCenterY);
            ctx.rotate(-rotation); // Apply the rotation
            ctx.translate(-rotationCenterX, -rotationCenterY); // Translate back
        } else {
            ctx.translate(baseX + rect.x, baseY + rect.y);
        }
        ctx.globalAlpha = opacity; // Set the opacity
        ctx.fillStyle = rgbaIntToHex(rgba, this.component.getCanvasAlpha());
        ctx.fillRect(0, 0, rect.width, rect.height); // Draw the rectangle at the origin
        ctx.restore();
        this.component.makeDirty();
    }

    doDrawText(text: string, x: number, y: number, rgba: number, opacity: number, font: RoFont) {
        const baseX = this.component.x;
        const baseY = this.component.y;
        const ctx = this.component.getContext();
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = rgbaIntToHex(rgba, this.component.getCanvasAlpha());
        ctx.font = font.toFontString();
        ctx.textBaseline = "top";
        ctx.fillText(text, baseX + x, baseY + y + font.getTopAdjust());
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
        ctx.textBaseline = "top";
        ctx.fillText(text, 0, font.getTopAdjust());
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
    }

    /**
     * Restores the drawing context state that was saved by the corresponding pushClip() call,
     * effectively removing the last applied clipping region.
     */
    popClip() {
        const ctx = this.component.getContext();
        ctx.restore();
    }

    drawNinePatch(bitmap: RoBitmap, rect: Rect, rgba?: number, opacity?: number) {
        const ctx = this.component.getContext();
        rgba = combineRgbaOpacity(rgba, opacity);
        const image = getCanvasFromDraw2d(bitmap, rgba);
        const patchSizes = bitmap.getPatchSizes();
        const x = rect.x;
        const y = rect.y;
        const width = rect.width;
        const height = rect.height;
        const sw = image.width;
        const sh = image.height;

        const lw = patchSizes.horizontal; // Left Width
        const rw = patchSizes.horizontal; // Right Width
        const th = patchSizes.vertical; // Top Height
        const bh = patchSizes.vertical; // Bottom Height

        const cw = sw - lw - rw; // Center Width
        const ch = sh - th - bh; // Center Height

        const targetCW = width - lw - rw;
        const targetCH = height - th - bh;

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
            drawChunk(ctx, image, { sx, sy, sw, sh, dx, dy, dw, dh });
        };

        ctx.save();
        // Set context properties (alpha blending, smoothing)
        setContextAlpha(ctx, rgba);
        ctx.imageSmoothingEnabled = bitmap.scaleMode === 1;

        // Top-left corner
        drawPart(1, 1, lw - 1, th + 1, x, y, lw - 1, th + 1);

        // Top edge
        drawPart(lw + 1, 1, cw - 2, th + 1, x + lw - 1, y, targetCW, th + 1);

        // Top-right corner
        drawPart(sw - rw, 1, rw - 1, th + 1, x + width - rw - 1, y, rw, th + 1);

        // Left edge
        drawPart(1, th + 1, lw - 1, ch - 2, x, y + th + 1, lw - 1, targetCH + 1);

        // Center
        drawPart(lw + 1, th + 1, cw - 2, ch - 2, x + lw - 1, y + th + 1, targetCW, targetCH + 1);

        // Right edge
        drawPart(sw - rw, th + 1, rw - 1, ch - 2, x + width - rw - 1, y + th + 1, rw, targetCH + 1);

        // Bottom-left corner
        drawPart(1, sh - bh, lw - 1, bh - 1, x, y + height - bh + 1, lw - 1, bh);

        // Bottom edge
        drawPart(lw + 1, sh - bh, cw - 2, bh - 1, x + lw - 1, y + height - bh + 1, targetCW, bh);

        // Bottom-right corner
        drawPart(sw - rw, sh - bh, rw - 1, bh - 1, x + width - rw - 1, y + height - bh + 1, rw, bh);

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
        impl: (
            _: Interpreter,
            x: Int32,
            y: Int32,
            object: BrsComponent,
            rgba: Int32 | BrsInvalid
        ) => {
            const ctx = this.component.getContext();
            const didDraw = this.component.drawImage(
                object,
                x.getValue(),
                y.getValue(),
                1,
                1,
                rgba instanceof Int32 ? rgba.getValue() : undefined
            );
            ctx.globalAlpha = 1.0;
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
        impl: (
            _: Interpreter,
            x: Int32,
            y: Int32,
            theta: Float,
            object: BrsComponent,
            rgba: Int32 | BrsInvalid
        ) => {
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
            const ctx = this.component.getContext();
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
            ctx.globalAlpha = 1.0;
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
        impl: (
            _: Interpreter,
            xStart: Int32,
            yStart: Int32,
            xEnd: Int32,
            yEnd: Int32,
            rgba: Int32
        ) => {
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
            ctx.fillRect(
                baseX + x.getValue(),
                baseY + y.getValue(),
                size.getValue(),
                size.getValue()
            );
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
                new Uint8Array(
                    UPNG.encode(
                        [imgData.data.buffer as ArrayBuffer],
                        imgData.width,
                        imgData.height,
                        0
                    )
                )
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

    drawImage(
        object: BrsComponent,
        x: number,
        y: number,
        scaleX?: number,
        scaleY?: number,
        rgba?: number
    ): boolean;

    makeDirty(): void;

    finishDraw(): void;
}

// In Chrome, when this is enabled, it slows down non-alpha draws. However, when this is true, it behaves the same as Roku
// Also, in Firefox, draws slow down when this is false. So it's a trade-off
const USE_IMAGE_DATA_WHEN_ALPHA_DISABLED = true;

function setContextAlpha(ctx: BrsCanvasContext2D, rgba?: number) {
    if (rgba) {
        const alpha = rgba & 255;
        if (alpha < 255) {
            ctx.globalAlpha = alpha / 255;
        }
    }
}

function getCanvasFromDraw2d(object: BrsDraw2D, rgba?: number): BrsCanvas {
    let cvs: BrsCanvas;
    if (rgba !== undefined && !isNaN(rgba) && !(object instanceof RoScreen)) {
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
    if (object instanceof RoRegion) {
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
    scaleMode?: number
): boolean {
    const ctx = component.getContext();
    const alphaEnable = component.getCanvasAlpha();
    let image: BrsCanvas;
    if (object instanceof RoBitmap || object instanceof RoRegion || object instanceof RoScreen) {
        image = getCanvasFromDraw2d(object, rgba);
        setContextAlpha(ctx, rgba);
    } else {
        return false;
    }
    if (!isCanvasValid(image)) {
        return false;
    }

    scaleMode = scaleMode ?? object.scaleMode;

    ctx.imageSmoothingEnabled = scaleMode === 1;

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

export function putImageAtPos(
    imageData: BrsImageData,
    ctx: BrsCanvasContext2D,
    x: number,
    y: number
) {
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

function drawChunk(ctx: BrsCanvasContext2D, image: BrsCanvas, chunk: DrawChunk) {
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

/**
 * Helper function to combine RGBA color integer with an opacity value.
 * @param rgba The base RGBA color integer (e.g., 0xFF0000FF for opaque red).
 * @param opacity The opacity factor (0.0 to 1.0).
 * @returns The combined RGBA color integer, or undefined if both inputs are undefined.
 */
function combineRgbaOpacity(rgba?: number, opacity?: number): number | undefined {
    if (rgba === undefined && opacity === undefined) {
        return undefined;
    } else if (opacity === undefined || opacity < 0 || opacity >= 1) {
        return rgba;
    }
    // Default to opaque white if only opacity is given and rgba is undefined
    const baseRgba = rgba ?? 0xffffffff;
    let alpha = baseRgba & 0xff;
    // Apply opacity
    alpha = Math.round(alpha * opacity);
    // Ensure alpha is within the valid 0-255 range
    alpha = Math.max(0, Math.min(255, alpha));
    // Reconstruct the RGBA integer with the new alpha
    return (baseRgba & 0xffffff00) | alpha;
}
