import { BrsInvalid, RoBitmap, RoRegion, RoScreen } from ".";
import { BrsComponent } from "./components/BrsComponent";
import { RoCompositor } from "./components/RoCompositor";
import { Int32 } from "./Int32";
import { Canvas, CanvasRenderingContext2D, createCanvas, ImageData as NodeImageData } from "canvas";

export type BrsDraw2D = RoBitmap | RoRegion | RoScreen;
export type BrsCanvas = OffscreenCanvas | Canvas;
export type BrsCanvasContext2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
export type BrsImageData = ImageData | NodeImageData;

// In Chrome, when this is enabled, it slows down non-alpha draws. However, when this is true, it behaves the same as Roku
// Also, in Firefox, draws slow down when this is false. So it's a trade-off
const USE_IMAGE_DATA_WHEN_ALPHA_DISABLED = true;

function setContextAlpha(ctx: BrsCanvasContext2D, rgba: Int32 | BrsInvalid) {
    if (rgba instanceof Int32) {
        const alpha = rgba.getValue() & 255;
        if (alpha < 255) {
            ctx.globalAlpha = alpha / 255;
        }
    }
}

function getCanvasFromDraw2d(object: BrsDraw2D, rgba: Int32 | BrsInvalid): BrsCanvas {
    let cvs: BrsCanvas;
    if (rgba instanceof Int32 && !(object instanceof RoScreen)) {
        cvs = object.getRgbaCanvas(rgba.getValue());
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
        return new Dimensions(object.getImageWidth(), object.getImageHeight());
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
    const sw = object.getImageWidth();
    const sh = object.getImageHeight();

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
        !object.getWrapValue()
    ) {
        // No wraps, so just one image chunk to draw
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
    rgba: Int32 | BrsInvalid,
    x: number,
    y: number,
    scaleX: number = 1,
    scaleY: number = 1
): boolean {
    const ctx = component.getContext();
    const alphaEnable = component.getAlphaEnableValue();
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

    if (object instanceof RoRegion) {
        ctx.imageSmoothingEnabled = object.getRegionScaleMode() === 1;
    } else {
        ctx.imageSmoothingEnabled = false;
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
    rgba: Int32 | BrsInvalid,
    x: number,
    y: number,
    angle: number
): boolean {
    const ctx = component.getContext();
    const angleInRad = (-angle * Math.PI) / 180;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angleInRad);
    const didDraw = component.drawImage(object, rgba, 0, 0);
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
