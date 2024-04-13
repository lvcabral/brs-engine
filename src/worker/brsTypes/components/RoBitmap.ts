import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Double } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { Float } from "../Float";
import { RoFont } from "./RoFont";
import { RoAssociativeArray } from "./RoAssociativeArray";
import {
    WorkerCanvas,
    WorkerCanvasRenderingContext2D,
    createNewCanvas,
    drawImageAtPos,
    drawImageToContext,
    drawObjectToComponent,
    drawRotatedObject,
    putImageAtPos,
} from "../draw2d";
import { RoByteArray } from "./RoByteArray";
import { GifReader } from "omggif";
import fileType from "file-type";
import UPNG from "upng-js";
import * as JPEG from "jpeg-js";
import BMP from "decode-bmp";
import { WebPRiffParser, WebPDecoder } from "libwebpjs";

export class RoBitmap extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private alphaEnable: boolean;
    private canvas: WorkerCanvas;
    private context: WorkerCanvasRenderingContext2D;
    private rgbaCanvas?: WorkerCanvas;
    private rgbaLast: number;
    private rgbaRedraw: boolean;
    private valid: boolean;

    constructor(interpreter: Interpreter, param: BrsComponent) {
        super("roBitmap");
        let width = 300;
        let height = 150;
        let image;
        this.alphaEnable = false;
        this.rgbaLast = 0;
        this.rgbaRedraw = true;
        this.valid = true;
        if (param instanceof BrsString) {
            let url = new URL(param.value);
            const volume = interpreter.fileSystem.get(url.protocol);
            if (volume) {
                try {
                    image = volume.readFileSync(url.pathname);
                    this.alphaEnable = false;
                } catch (err: any) {
                    postMessage(`error,Error loading bitmap:${url.pathname} - ${err.message}`);
                    this.valid = false;
                }
            } else {
                postMessage(`error,Invalid volume:${url.pathname}`);
                this.valid = false;
            }
        } else if (param instanceof RoAssociativeArray) {
            let paramWidth = param.get(new BrsString("width"));
            if (
                paramWidth instanceof Int32 ||
                paramWidth instanceof Float ||
                paramWidth instanceof Double
            ) {
                width = Math.trunc(paramWidth.getValue());
            }
            let paramHeight = param.get(new BrsString("height"));
            if (
                paramHeight instanceof Int32 ||
                paramHeight instanceof Float ||
                paramHeight instanceof Double
            ) {
                height = Math.trunc(paramHeight.getValue());
            }
            let alphaEnable = param.get(new BrsString("alphaEnable"));
            if (alphaEnable instanceof BrsBoolean) {
                this.alphaEnable = alphaEnable.toBoolean();
            }
        } else {
            postMessage(`warning,Invalid roBitmap param:${param}`);
            this.valid = false;
        }
        this.canvas = createNewCanvas(width, height);
        //TODO: Review alpha enable, it should only affect bitmap as destination.
        this.context = this.canvas.getContext("2d", {
            alpha: true,
        }) as WorkerCanvasRenderingContext2D;
        if (image) {
            try {
                if (image instanceof Uint8Array || image instanceof ArrayBuffer) {
                    let data, width, height;
                    const type = fileType(image);
                    if (type && type.mime === "image/png") {
                        let png = UPNG.decode(image);
                        data = UPNG.toRGBA8(png)[0];
                        width = png.width;
                        height = png.height;
                    } else if (type && type.mime === "image/jpeg") {
                        let jpg = JPEG.decode(image);
                        data = jpg.data;
                        width = jpg.width;
                        height = jpg.height;
                    } else if (type && type.mime === "image/webp") {
                        const webpDecoder = new WebPDecoder();
                        const imgBuffer = Buffer.from(image);
                        const imgArray = WebPRiffParser(imgBuffer, 0);
                        if (imgArray?.frames && imgArray.frames.length) {
                            let aHeight = [0];
                            let aWidth = [0];
                            // Get only the first frame (animations not supported)
                            let frame = imgArray.frames[0];
                            data = webpDecoder.WebPDecodeRGBA(
                                imgBuffer,
                                frame["src_off"],
                                frame["src_size"],
                                aWidth,
                                aHeight
                            );
                            if (data) {
                                height = aHeight[0];
                                width = aWidth[0];
                            }
                        }
                    } else if (type && type.mime === "image/gif") {
                        let gif = new GifReader(Buffer.from(image));
                        data = new Uint8Array(gif.width * gif.height * 4);
                        gif.decodeAndBlitFrameRGBA(0, data);
                        width = gif.width;
                        height = gif.height;
                    } else if (type && type.mime === "image/bmp") {
                        let bmp = BMP(image);
                        data = bmp.data;
                        width = bmp.width;
                        height = bmp.height;
                    }
                    if (data && width && height) {
                        let imageData = this.context.createImageData(width, height);
                        this.canvas.width = width;
                        this.canvas.height = height;
                        imageData.data.set(new Uint8Array(data));
                        putImageAtPos(imageData, this.context, 0, 0);
                    } else {
                        postMessage(`warning,Invalid image format: ${type?.mime}`);
                        this.valid = false;
                    }
                } else {
                    postMessage(`warning,Invalid bitmap file format: ${image}`);
                    this.valid = false;
                }
            } catch (err: any) {
                postMessage(`error,Error drawing image on canvas: ${err.message}`);
                this.valid = false;
            }
        }

        this.registerMethods({
            ifDraw2D: [
                this.clear,
                this.drawObject,
                this.drawRotatedObject,
                this.drawScaledObject,
                this.drawTransformedObject,
                this.drawLine,
                this.drawPoint,
                this.drawRect,
                this.drawText,
                this.finish,
                this.getAlphaEnable,
                this.setAlphaEnable,
                this.getByteArray,
                this.getPng,
                this.getWidth,
                this.getHeight,
            ],
        });
    }

    clearCanvas(rgba: number) {
        const ctx = this.context;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if ((rgba & 255) > 0) {
            ctx.fillStyle = rgbaIntToHex(rgba);
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        this.rgbaRedraw = true;
        return BrsInvalid.Instance;
    }

    drawImage(
        object: BrsComponent,
        rgba: Int32 | BrsInvalid,
        x: number,
        y: number,
        scaleX: number = 1,
        scaleY: number = 1
    ): boolean {
        this.rgbaRedraw = true;
        return drawObjectToComponent(this, object, rgba, x, y, scaleX, scaleY);
    }

    drawImageToContext(image: WorkerCanvas, x: number, y: number): boolean {
        const ctx = this.context;
        return drawImageToContext(ctx, image, this.alphaEnable, x, y);
    }

    getImageWidth(): number {
        return this.canvas.width;
    }

    getImageHeight(): number {
        return this.canvas.height;
    }

    getCanvas(): WorkerCanvas {
        return this.canvas;
    }

    getContext(): WorkerCanvasRenderingContext2D {
        return this.context;
    }

    getAlphaEnableValue(): boolean {
        return this.alphaEnable;
    }

    getRgbaCanvas(rgba: number): WorkerCanvas {
        if (!this.rgbaCanvas) {
            this.rgbaCanvas = createNewCanvas(this.canvas.width, this.canvas.height);
        } else if (!this.rgbaRedraw && rgba === this.rgbaLast) {
            return this.rgbaCanvas;
        } else {
            this.rgbaCanvas.width = this.canvas.width;
            this.rgbaCanvas.height = this.canvas.height;
        }
        const ctx = this.rgbaCanvas.getContext("2d", {
            alpha: true,
        }) as WorkerCanvasRenderingContext2D;
        drawImageAtPos(this.canvas, ctx, 0, 0);
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = rgbaIntToHex(rgba);
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.globalCompositeOperation = "destination-in";
        drawImageAtPos(this.canvas, ctx, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        this.rgbaLast = rgba;
        this.rgbaRedraw = false;
        return this.rgbaCanvas;
    }

    setCanvasAlpha(enable: boolean) {
        this.alphaEnable = enable;
        this.rgbaRedraw = true;
        return BrsInvalid.Instance;
    }

    makeDirty() {
        this.rgbaRedraw = true;
    }

    toString(parent?: BrsType): string {
        return "<Component: roBitmap>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    isValid() {
        return this.valid;
    }

    // ifDraw2D  -----------------------------------------------------------------------------------

    /** Clear the bitmap, and fill with the specified RGBA color */
    private clear = new Callable("clear", {
        signature: {
            args: [new StdlibArgument("rgba", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, rgba: Int32) => {
            return this.clearCanvas(rgba.getValue());
        },
    });

    /** Draw the source object, where src is an roBitmap or an roRegion object, at position x,y */
    private drawObject = new Callable("drawObject", {
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
            const ctx = this.context;
            const didDraw = this.drawImage(object, rgba, x.getValue(), y.getValue());
            ctx.globalAlpha = 1.0;
            this.rgbaRedraw = true;
            return BrsBoolean.from(didDraw);
        },
    });

    /** Draw the source object at position x,y rotated by angle theta degrees. */
    private drawRotatedObject = new Callable("drawRotatedObject", {
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
            let ctx = this.context;
            const didDraw = drawRotatedObject(
                this,
                ctx,
                object,
                rgba,
                x.getValue(),
                y.getValue(),
                theta.getValue()
            );
            this.rgbaRedraw = true;
            return BrsBoolean.from(didDraw);
        },
    });

    /** Draw the source object, at position x,y, scaled horizontally by scaleX and vertically by scaleY. */
    private drawScaledObject = new Callable("drawScaledObject", {
        signature: {
            args: [
                new StdlibArgument("x", ValueKind.Int32),
                new StdlibArgument("y", ValueKind.Int32),
                new StdlibArgument("scaleX", ValueKind.Float),
                new StdlibArgument("scaleY", ValueKind.Float),
                new StdlibArgument("object", ValueKind.Object),
                new StdlibArgument("rgba", ValueKind.Int32, BrsInvalid.Instance), // TODO: add support to rgba
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
            const ctx = this.context;
            const didDraw = this.drawImage(
                object,
                rgba,
                x.getValue(),
                y.getValue(),
                scaleX.getValue(),
                scaleY.getValue()
            );
            ctx.globalAlpha = 1.0;
            this.rgbaRedraw = true;
            return BrsBoolean.from(didDraw);
        },
    });

    /** Draw the source object, at position x,y, rotated by theta and scaled horizontally by scaleX and vertically by scaleY. */
    private drawTransformedObject = new Callable("drawTransformedObject", {
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
            const ctx = this.context;
            const positionX = x.getValue();
            const positionY = y.getValue();
            const angleInRad = (-theta.getValue() * Math.PI) / 180;
            ctx.save();
            ctx.translate(positionX, positionY);
            ctx.rotate(angleInRad);
            const didDraw = this.drawImage(
                object,
                rgba,
                0,
                0,
                scaleX.getValue(),
                scaleY.getValue()
            );
            ctx.globalAlpha = 1.0;
            ctx.restore();
            this.rgbaRedraw = true;
            return BrsBoolean.from(didDraw);
        },
    });

    /** Draw a line from (xStart, yStart) to (xEnd, yEnd) with RGBA color */
    private drawLine = new Callable("drawLine", {
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
            let ctx = this.context;
            ctx.beginPath();
            ctx.strokeStyle = rgbaIntToHex(rgba.getValue(), this.alphaEnable);
            ctx.moveTo(xStart.getValue(), yStart.getValue());
            ctx.lineTo(xEnd.getValue(), yEnd.getValue());
            ctx.stroke();
            this.rgbaRedraw = true;
            return BrsBoolean.True;
        },
    });

    /** Draws a point at (x,y) with the given size and RGBA color */
    private drawPoint = new Callable("drawPoint", {
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
            let ctx = this.context;
            ctx.fillStyle = rgbaIntToHex(rgba.getValue(), this.alphaEnable);
            ctx.fillRect(x.getValue(), y.getValue(), size.getValue(), size.getValue());
            this.rgbaRedraw = true;
            return BrsBoolean.True;
        },
    });

    /** Fill the specified rectangle from left (x), top (y) to right (x + width), bottom (y + height) with the RGBA color */
    private drawRect = new Callable("drawRect", {
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
            let ctx = this.context;
            ctx.fillStyle = rgbaIntToHex(rgba.getValue(), this.alphaEnable);
            ctx.fillRect(x.getValue(), y.getValue(), width.getValue(), height.getValue());
            this.rgbaRedraw = true;
            return BrsBoolean.True;
        },
    });

    /** Draws the text at position (x,y) using the specified RGBA color and roFont font object. */
    private drawText = new Callable("drawText", {
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
            const ctx = this.context;
            ctx.fillStyle = rgbaIntToHex(rgba.getValue(), this.alphaEnable);
            ctx.font = font.toFontString();
            ctx.textBaseline = "top";
            ctx.fillText(text.value, x.getValue(), y.getValue() + font.getTopAdjust());
            this.rgbaRedraw = true;
            return BrsBoolean.True;
        },
    });

    /** Realize the bitmap by finishing all queued draw calls. */
    private finish = new Callable("finish", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            return BrsInvalid.Instance;
        },
    });

    /** Returns true if alpha blending is enabled */
    private getAlphaEnable = new Callable("getAlphaEnable", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.alphaEnable);
        },
    });

    /** If enable is true, do alpha blending when this bitmap is the destination */
    private setAlphaEnable = new Callable("setAlphaEnable", {
        signature: {
            args: [new StdlibArgument("alphaEnable", ValueKind.Boolean)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, alphaEnable: BrsBoolean) => {
            return this.setCanvasAlpha(alphaEnable.toBoolean());
        },
    });

    /** Return the width of the screen/bitmap/region. */
    private getWidth = new Callable("getWidth", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.canvas.width);
        },
    });

    /** Return the height of the screen/bitmap/region. */
    private getHeight = new Callable("getHeight", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.canvas.height);
        },
    });

    /** Returns an roByteArray representing the RGBA pixel values for the rectangle described by the parameters. */
    private getByteArray = new Callable("getByteArray", {
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
            let imgData = this.context.getImageData(
                x.getValue(),
                y.getValue(),
                width.getValue(),
                height.getValue()
            );
            let byteArray = new Uint8Array(imgData.data.buffer);
            return new RoByteArray(byteArray);
        },
    });

    /** Returns an roByteArray object containing PNG image data for the specified area of the bitmap. */
    private getPng = new Callable("getPng", {
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
            let imgData = this.context.getImageData(
                x.getValue(),
                y.getValue(),
                width.getValue(),
                height.getValue()
            );
            return new RoByteArray(
                new Uint8Array(UPNG.encode([imgData.data.buffer], imgData.width, imgData.height, 0))
            );
        },
    });
}

export function createBitmap(interpreter: Interpreter, param: BrsComponent) {
    const bmp = new RoBitmap(interpreter, param);
    return bmp.isValid() ? bmp : BrsInvalid.Instance;
}

export function rgbaIntToHex(rgba: number, alpha: boolean = true): string {
    if (!alpha) {
        rgba = rgbaToOpaque(rgba);
    }
    let hex = (rgba >>> 0).toString(16);
    while (hex.length < 8) {
        hex = "0" + hex;
    }
    return "#" + hex;
}

export function rgbaToTransparent(rgba: number): number {
    return rgba - (rgba & 0xff);
}

export function rgbaToOpaque(rgba: number): number {
    return rgba - (rgba & 0xff) + 0xff;
}
