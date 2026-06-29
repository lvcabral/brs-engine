import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Double, isStringComp } from "..";
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
import UPNG from "@lvcabral/upng";
import * as JPEG from "jpeg-js";
import BMP from "decode-bmp";
import { WebPRiffParser, WebPDecoder } from "@lvcabral/libwebp";
import { BrsDevice } from "../../device/BrsDevice";
import { nextAddress, registerTexture, unregisterTexture } from "../../device/Graphics";

/** Parsed 9-patch (`.9.png`) layout, in source-pixel units (excluding the 1px marker border). */
export interface NinePatch {
    /** Fixed corner insets, derived from the TOP row + LEFT column stretch markers. */
    left: number;
    right: number;
    top: number;
    bottom: number;
    /** Content padding, derived from the RIGHT column + BOTTOM row markers. */
    margins: { left: number; right: number; top: number; bottom: number };
}

export class RoBitmap extends BrsComponent implements BrsValue, BrsDraw2D {
    readonly kind = ValueKind.Object;
    readonly x: number = 0;
    readonly y: number = 0;
    readonly width: number;
    readonly height: number;
    readonly ninePatch: boolean = false;
    private readonly canvas: BrsCanvas;
    private readonly context: BrsCanvasContext2D;
    private readonly name: string;
    private readonly valid: boolean;
    private readonly patchSizes?: NinePatch;
    private alphaEnable: boolean;
    private rgbaCanvas?: BrsCanvas;
    private rgbaLast: number;
    rgbaRedraw: boolean;
    scaleMode: number;
    readonly address: string = nextAddress();

    constructor(param: BrsType | ArrayBuffer | Buffer, name?: string) {
        super("roBitmap");
        this.alphaEnable = false;
        this.rgbaLast = 0;
        this.rgbaRedraw = true;
        this.valid = true;
        this.width = 1;
        this.height = 1;
        this.name = name ?? "";
        this.scaleMode = 0; // Valid: 0=fast 1=smooth (maybe slow)
        let image;
        if (param instanceof ArrayBuffer || param instanceof Buffer || param instanceof Uint8Array) {
            image = param;
        } else if (isStringComp(param)) {
            try {
                image = BrsDevice.fileSystem?.readFileSync(param.getValue());
                this.alphaEnable = false;
                this.name = param.getValue();
            } catch (err: any) {
                if (BrsDevice.isDevMode) {
                    BrsDevice.stderr.write(`error,Error loading bitmap:${param.getValue()} - ${err.message}`);
                }
                this.valid = false;
            }
        } else if (param instanceof RoAssociativeArray) {
            let paramWidth = param.get(new BrsString("width"));
            if (paramWidth instanceof Int32 || paramWidth instanceof Float || paramWidth instanceof Double) {
                this.width = Math.trunc(paramWidth.getValue());
            }
            let paramHeight = param.get(new BrsString("height"));
            if (paramHeight instanceof Int32 || paramHeight instanceof Float || paramHeight instanceof Double) {
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
        if (this.valid && this.name.toLowerCase().endsWith(".9.png")) {
            const sizes = this.parsePatchSizes();
            if (sizes) {
                this.ninePatch = true;
                this.patchSizes = sizes;
            }
        }
        if (this.valid && BrsDevice.tracking) {
            // Track this bitmap in the global texture-memory registry (r2d2-bitmaps).
            registerTexture(this);
        }
    }

    /** Returns whether this bitmap is stored with an alpha channel. */
    hasAlpha(): boolean {
        return this.alphaEnable;
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
        // Apply the RGB tint at full strength: blendColor's alpha controls the resulting
        // transparency (handled separately via globalAlpha when blitting), not the tint
        // strength. Using the color's alpha here would weaken the multiply and lighten the
        // result, diverging from Roku (e.g. 0x0B001980 must render dark, not near-white).
        ctx.fillStyle = rgbaIntToHex(rgba, false);
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
        if (BrsDevice.tracking) {
            unregisterTexture(this);
        }
        releaseCanvas(this.canvas);
        if (this.rgbaCanvas) {
            releaseCanvas(this.rgbaCanvas);
        }
    }

    /** Returns the parsed 9-patch layout, or `undefined` for non 9-patch bitmaps. */
    getPatchSizes(): NinePatch | undefined {
        return this.patchSizes ?? this.parsePatchSizes();
    }

    /**
     * Parses the 1px marker border of a `.9.png` image into fixed corner insets and content
     * margins. The TOP row and LEFT column markers define the stretchable region (and thus the
     * fixed corner insets); the RIGHT column and BOTTOM row markers define the content padding.
     * Returns `undefined` when the image is not a valid 9-patch (no top/left stretch markers).
     */
    private parsePatchSizes(): NinePatch | undefined {
        const image = this.getCanvas();
        const ctx = this.getContext();
        const width = image.width;
        const height = image.height;
        const data = ctx.getImageData(0, 0, width, height).data;

        const isBlack = (x: number, y: number) => {
            const i = (x + y * width) * 4;
            // Marker pixels are opaque black (0, 0, 0, 255)
            return data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 255;
        };

        // Scans an edge line and returns the [first, last] indices of its contiguous marker, or
        // undefined when no marker pixel is found.
        const scanMarker = (length: number, sample: (i: number) => boolean) => {
            let first = -1;
            let last = -1;
            for (let i = 0; i < length; i++) {
                if (sample(i)) {
                    if (first < 0) {
                        first = i;
                    }
                    last = i;
                }
            }
            return first < 0 ? undefined : { first, last };
        };

        // Content spans indices 1..length-2 (the marker border is excluded).
        const inset = (marker: { first: number; last: number }, length: number) => ({
            before: marker.first - 1,
            after: length - 2 - marker.last,
        });

        const topMarker = scanMarker(width, (x) => isBlack(x, 0));
        const leftMarker = scanMarker(height, (y) => isBlack(0, y));
        if (!topMarker || !leftMarker) {
            return undefined;
        }
        const horiz = inset(topMarker, width);
        const vert = inset(leftMarker, height);

        const bottomMarker = scanMarker(width, (x) => isBlack(x, height - 1));
        const rightMarker = scanMarker(height, (y) => isBlack(width - 1, y));
        let margins = { left: 0, right: 0, top: 0, bottom: 0 };
        if (bottomMarker && rightMarker) {
            const horizMargin = inset(bottomMarker, width);
            const vertMargin = inset(rightMarker, height);
            margins = {
                left: horizMargin.before,
                right: horizMargin.after,
                top: vertMargin.before,
                bottom: vertMargin.after,
            };
        }

        return {
            left: horiz.before,
            right: horiz.after,
            top: vert.before,
            bottom: vert.after,
            margins,
        };
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
