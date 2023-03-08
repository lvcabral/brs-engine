import { BrsInvalid, RoBitmap, RoRegion } from ".";
import { BrsComponent } from "./components/BrsComponent";
import { Int32 } from "./Int32";

export function setContextAlpha(ctx: OffscreenCanvasRenderingContext2D, rgba: Int32 | BrsInvalid) {
    if (rgba instanceof Int32) {
        const alpha = rgba.getValue() & 255;
        if (alpha < 255) {
            ctx.globalAlpha = alpha / 255;
        }
    }
}


export function getCanvasFromDraw2d(object: RoBitmap | RoRegion, rgba: Int32 | BrsInvalid): OffscreenCanvas {
    let cvs: OffscreenCanvas;
    if (rgba instanceof Int32) {
        cvs = object.getRgbaCanvas(rgba.getValue());
    } else {
        cvs = object.getCanvas();
    }
    return cvs
}


export function isCanvasValid(cvs?: OffscreenCanvas): boolean {
    if (!cvs) {
        return false;
    }
    const sizeOk = !!(cvs.height && cvs.height >= 1 && cvs.width && cvs.width >= 1);
    return sizeOk;
}

export function getSourceOffset(object: RoBitmap | RoRegion): { x: number, y: number } {
    let x = 0, y = 0;
    if (object instanceof RoRegion) {
        x = object.getPosX();
        y = object.getPosY();
    }
    return { x, y }
}

export function getPreTranslation(object: RoBitmap | RoRegion): { x: number, y: number } {
    let x = 0, y = 0;
    if (object instanceof RoRegion) {
        x = object.getTransX();
        y = object.getTransY();
    }
    return { x, y }
}


export function drawObjectToContext(ctx: OffscreenCanvasRenderingContext2D, alphaEnable: boolean, object: BrsComponent, rgba: Int32 | BrsInvalid, x: number, y: number, scaleX: number = 1, scaleY: number = 1): boolean {
    let image: OffscreenCanvas;
    if (object instanceof RoBitmap || object instanceof RoRegion) {
        image = getCanvasFromDraw2d(object, rgba)
    } else {
        return false;
    }
    if (!isCanvasValid(image)) {
        return false
    }
    const offset = getSourceOffset(object);
    const preTrans = getPreTranslation(object);
    const tx = preTrans.x * scaleX;
    const ty = preTrans.y * scaleY;
    const sx = offset.x + tx;
    const sy = offset.y + ty;
    const sw = object.getImageWidth();
    const sh = object.getImageHeight();

    if (object instanceof RoRegion) {
        ctx.imageSmoothingEnabled = object.getRegionScaleMode() === 1;
    }
    if (alphaEnable) {
        ctx.drawImage(
            image,
            sx,
            sy,
            sw,
            sh,
            x + preTrans.x,
            y + preTrans.y,
            sw * scaleX,
            sh * scaleY
        );
    } else {
        const ctc = image.getContext("2d", {
            alpha: true,
        }) as OffscreenCanvasRenderingContext2D;
        let imageData = ctc.getImageData(sx, sy, sw, sh);
        let pixels = imageData.data;
        for (let i = 3, n = image.width * image.height * 4; i < n; i += 4) {
            pixels[i] = 255;
        }
        ctx.scale(scaleX, scaleY);
        ctx.putImageData(imageData, x, y,);
        ctx.scale(1, 1);
    }
    return true;
}


export function drawImageToContext(ctx: OffscreenCanvasRenderingContext2D, image: OffscreenCanvas, x: number, y: number): boolean {
    if (!isCanvasValid(image)) {
        return false
    }
    ctx.drawImage(image, x, y);

    return true;
}