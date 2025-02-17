import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Double } from "..";
import { Callable } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { Float } from "../Float";
import { RoAssociativeArray } from "./RoAssociativeArray";
import {
    BrsCanvas,
    BrsCanvasContext2D,
    BrsDraw2D,
    createNewCanvas,
    drawImageAtPos,
    drawImageToContext,
    drawObjectToComponent,
    IfDraw2D,
    putImageAtPos,
    releaseCanvas,
    rgbaIntToHex,
} from "../interfaces/IfDraw2D";
import { parseGIF, decompressFrames } from "gifuct-js";
import fileType from "file-type";
import UPNG from "upng-js";
import * as JPEG from "jpeg-js";
import BMP from "decode-bmp";
import { WebPRiffParser, WebPDecoder } from "libwebpjs";
import { BrsDevice } from "../../device/BrsDevice";

export class RoBitmap extends BrsComponent implements BrsValue, BrsDraw2D {
    readonly kind = ValueKind.Object;
    readonly x: number = 0;
    readonly y: number = 0;
    readonly width: number;
    readonly height: number;
    private readonly canvas: BrsCanvas;
    private readonly context: BrsCanvasContext2D;
    private readonly name: string;
    private readonly disposeCanvas: boolean;
    private readonly valid: boolean;
    private alphaEnable: boolean;
    private rgbaCanvas?: BrsCanvas;
    private rgbaLast: number;
    rgbaRedraw: boolean;

    constructor(param: BrsType | ArrayBuffer | Buffer) {
        super("roBitmap");
        this.alphaEnable = false;
        this.rgbaLast = 0;
        this.rgbaRedraw = true;
        this.valid = true;
        const platform = BrsDevice.deviceInfo.get("platform");
        this.disposeCanvas = platform?.inIOS ?? false;
        this.width = 1;
        this.height = 1;
        this.name = "";
        let image;
        if (param instanceof ArrayBuffer || param instanceof Buffer) {
            image = param;
        } else if (param instanceof BrsString) {
            try {
                image = BrsDevice.fileSystem?.readFileSync(param.value);
                this.alphaEnable = false;
                this.name = param.value;
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(
                        `error,Error loading bitmap:${param.value} - ${err.message}`
                    );
                }
                this.valid = false;
            }
        } else if (param instanceof RoAssociativeArray) {
            let paramWidth = param.get(new BrsString("width"));
            if (
                paramWidth instanceof Int32 ||
                paramWidth instanceof Float ||
                paramWidth instanceof Double
            ) {
                this.width = Math.trunc(paramWidth.getValue());
            }
            let paramHeight = param.get(new BrsString("height"));
            if (
                paramHeight instanceof Int32 ||
                paramHeight instanceof Float ||
                paramHeight instanceof Double
            ) {
                this.height = Math.trunc(paramHeight.getValue());
            }
            let paramName = param.get(new BrsString("name"));
            if (paramName instanceof BrsString) {
                this.name = paramName.value;
            }
            let alphaEnable = param.get(new BrsString("alphaEnable"));
            if (alphaEnable instanceof BrsBoolean) {
                this.alphaEnable = alphaEnable.toBoolean();
            }
        } else {
            if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write(`warning,Invalid roBitmap param:${typeof param}`);
            }
            this.valid = false;
        }
        this.canvas = createNewCanvas(this.width, this.height);
        this.context = this.canvas.getContext("2d") as BrsCanvasContext2D;
        if (image) {
            try {
                let data;
                const type = fileType(image);
                if (type && type.mime === "image/png") {
                    const png = UPNG.decode(image);
                    const dataArray = UPNG.toRGBA8(png);
                    if (dataArray.length) {
                        data = dataArray[0];
                        this.width = png.width;
                        this.height = png.height;
                    }
                } else if (type && type.mime === "image/jpeg") {
                    let jpg = JPEG.decode(image);
                    data = jpg.data;
                    this.width = jpg.width;
                    this.height = jpg.height;
                } else if (type && type.mime === "image/webp") {
                    const webpDecoder = new WebPDecoder();
                    const imgBuffer = Buffer.from(image);
                    const imgArray = WebPRiffParser(imgBuffer, 0);
                    if (imgArray?.frames?.length) {
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
                            this.height = aHeight[0];
                            this.width = aWidth[0];
                        }
                    }
                } else if (type && type.mime === "image/gif") {
                    const gif = parseGIF(image);
                    const frames = decompressFrames(gif, true);
                    if (frames.length) {
                        data = frames[0].patch;
                        this.width = frames[0].dims.width;
                        this.height = frames[0].dims.height;
                    }
                } else if (type && type.mime === "image/bmp") {
                    let bmp = BMP(image);
                    data = bmp.data;
                    this.width = bmp.width;
                    this.height = bmp.height;
                }
                if (data) {
                    let imageData = this.context.createImageData(this.width, this.height);
                    this.canvas.width = this.width;
                    this.canvas.height = this.height;
                    imageData.data.set(new Uint8Array(data));
                    putImageAtPos(imageData, this.context, 0, 0);
                } else {
                    if (BrsDevice.isDevMode) {
                        BrsDevice.stderr.write(`warning,Invalid image format: ${type?.mime}`);
                    }
                    this.valid = false;
                }
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`error,Error drawing image on canvas: ${err.message}`);
                }
                this.valid = false;
            }
        }
        const ifDraw2D = new IfDraw2D(this);
        this.registerMethods({
            ifDraw2D: [
                ifDraw2D.clear,
                ifDraw2D.drawObject,
                ifDraw2D.drawRotatedObject,
                ifDraw2D.drawScaledObject,
                ifDraw2D.drawTransformedObject,
                ifDraw2D.drawLine,
                ifDraw2D.drawPoint,
                ifDraw2D.drawRect,
                ifDraw2D.drawText,
                ifDraw2D.finish,
                ifDraw2D.getAlphaEnable,
                ifDraw2D.setAlphaEnable,
                ifDraw2D.getByteArray,
                ifDraw2D.getPng,
                ifDraw2D.getWidth,
                ifDraw2D.getHeight,
            ],
            ifBitmap: [this.getName],
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
        x: number,
        y: number,
        scaleX: number = 1,
        scaleY: number = 1,
        rgba?: number
    ): boolean {
        this.rgbaRedraw = true;
        return drawObjectToComponent(this, object, x, y, scaleX, scaleY, rgba);
    }

    drawImageToContext(image: BrsCanvas, x: number, y: number): boolean {
        const ctx = this.context;
        return drawImageToContext(ctx, image, this.alphaEnable, x, y);
    }

    getImageName(): string {
        return this.name;
    }

    getCanvas(): BrsCanvas {
        return this.canvas;
    }

    getContext(): BrsCanvasContext2D {
        return this.context;
    }

    getRgbaCanvas(rgba: number): BrsCanvas {
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
        }) as BrsCanvasContext2D;
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
    }

    getCanvasAlpha(): boolean {
        return this.alphaEnable;
    }

    makeDirty() {
        this.rgbaRedraw = true;
    }

    finishDraw(): void {
        return;
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

    dispose() {
        if (this.disposeCanvas) {
            releaseCanvas(this.canvas);
            if (this.rgbaCanvas) {
                releaseCanvas(this.rgbaCanvas);
            }
        }
    }

    // ifBitmap  -----------------------------------------------------------------------------------

    /** Return the image name (file name or custom) of the bitmap (this method is not on RBI). */
    private readonly getName = new Callable("getName", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.name);
        },
    });
}

export function createBitmap(param: BrsType) {
    const bmp = new RoBitmap(param);
    return bmp.isValid() ? bmp : BrsInvalid.Instance;
}
