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
    drawImageToContext,
    drawObjectToComponent,
    IfDraw2D,
    putImageAtPos,
    releaseCanvas,
    rgbaIntToHex,
} from "../interfaces/IfDraw2D";
import { TintCache } from "./TintCache";
import { BrsDevice } from "../../device/BrsDevice";
import { DecodedImage, decodeImage, imageMimeType } from "../../device/ImageDecoder";
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
    /** Tinted copies of this bitmap, made on its first tinted draw. */
    private tints?: TintCache;
    /** Set when this bitmap is drawn into, so its tinted copies are stale. */
    rgbaRedraw: boolean;
    scaleMode: number;
    readonly address: string = nextAddress();
    /** Whether Clear()/the draw functions may modify this bitmap (see `roTextureRequest.SetDrawable`). */
    drawable: boolean = true;

    /**
     * @param param a file path, an `{width, height, alphaEnable, name}` AA, the encoded image bytes, or
     * already decoded RGBA pixels (from the off-thread decoder)
     */
    constructor(param: BrsType | ArrayBuffer | Buffer | DecodedImage, name?: string) {
        super("roBitmap");
        this.rgbaRedraw = true;
        this.scaleMode = 0; // Valid: 0=fast 1=smooth (maybe slow)
        const source = bitmapSource(param, name ?? "");
        this.width = source.width;
        this.height = source.height;
        this.name = source.name;
        this.alphaEnable = source.alphaEnable;
        this.canvas = createNewCanvas(this.width, this.height);
        this.context = this.canvas.getContext("2d") as BrsCanvasContext2D;
        this.valid = source.valid && (!source.pixels || drawPixels(this.context, source.pixels));
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

    /**
     * Built on the first method/interface lookup rather than in the constructor. All but one of a
     * bitmap's methods come from `IfDraw2D` (16 `Callable`s), and the bitmaps the engine mints for
     * SceneGraph textures, 9-patches and `MaskGroup` offscreens are drawn through TypeScript, so most
     * never need the BrightScript surface at all. `MaskGroup.renderNodeContent` is the clearest case: it
     * allocates a scene-sized bitmap every frame and then builds its OWN `IfDraw2D` over it, so the
     * eagerly-registered one was constructed and thrown away.
     */
    protected buildMethods() {
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
        rgba?: number,
        alpha?: number
    ): boolean {
        // Marked after the draw: drawing a region of this bitmap tints this bitmap's pixels first.
        const drawn = drawObjectToComponent(this, object, x, y, scaleX, scaleY, rgba, alpha);
        this.rgbaRedraw = true;
        return drawn;
    }

    drawImageToContext(image: BrsCanvas, x: number, y: number): boolean {
        // roCompositor draws its sprites into its destination bitmap through here.
        this.rgbaRedraw = true;
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
        this.tints ??= new TintCache(this.canvas, this.context);
        if (this.rgbaRedraw) {
            this.tints.invalidate();
            this.rgbaRedraw = false;
        }
        return this.tints.get(rgba);
    }

    setCanvasAlpha(enable: boolean) {
        this.alphaEnable = enable;
        this.rgbaRedraw = true;
    }

    getCanvasAlpha(): boolean {
        return this.alphaEnable;
    }

    isDrawable(): boolean {
        return this.drawable;
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
        this.tints?.release();
    }

    /** Returns the parsed 9-patch layout, or `undefined` for non 9-patch bitmaps. */
    getPatchSizes(): NinePatch | undefined {
        return this.patchSizes ?? this.parsePatchSizes();
    }

    /**
     * Parses the 1px marker border of a `.9.png` image into fixed corner insets and content
     * margins. The TOP row and LEFT column markers define the stretchable region (and thus the
     * fixed corner insets); the RIGHT column and BOTTOM row markers define the content padding.
     *
     * A valid 9-patch needs a stretch marker on at least ONE axis. Some authored `.9.png`s only
     * mark the axis they intend to stretch (e.g. a horizontal pill marks only the top row and
     * leaves the left column blank because its height is fixed). A missing stretch marker means
     * that whole axis is a single stretchable span — fixed insets of 0 on that axis — so the
     * dimension scales uniformly. Requiring both markers rejected such images, and they then
     * rendered as a plain stretched bitmap that scaled the marker border into view (visible black
     * edge lines). Returns `undefined` only when NEITHER axis has a stretch marker.
     */
    private parsePatchSizes(): NinePatch | undefined {
        const image = this.getCanvas();
        const ctx = this.getContext();
        const width = image.width;
        const height = image.height;
        const data = ctx.getImageData(0, 0, width, height).data;

        const isBlack = (x: number, y: number) => {
            const i = (x + y * width) * 4;
            // Marker pixels are black and NOT transparent. The alpha test is `> 0`, not `=== 255`:
            // real-world `.9.png`s ship semi-transparent markers (a palette entry of
            // rgba(0,0,0,128) is common — some authoring/optimization tools quantize the 1px border
            // that way), and requiring full opacity mis-parsed them. Because the scan then found the
            // marker on only part of an edge — or missed an edge entirely — the insets came out wrong
            // or negative, and `drawNinePatch` stretched the center band over the fixed corners: the
            // asset rendered pinched at the ends and bulging in the middle instead of as a uniform bar.
            // Only the fully transparent border pixels of an unmarked edge must read false.
            return data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] > 0;
        };

        // Scans an edge line and returns the [first, last] indices of its contiguous marker, or
        // undefined when no marker pixel is found.
        //
        // The four CORNER pixels are skipped (the scan runs 1..length-2). A marker only ever spans
        // the content range, so a black corner belongs to no edge — but counting one dragged the
        // marker's first/last index onto the border and produced a NEGATIVE inset (`before = -1` or
        // `after = -1`), which `drawNinePatch` turned into an oversized center band overlapping the
        // fixed corners. Assets that mark two adjacent edges commonly share the corner pixel between
        // them, so this is not a malformed-asset case.
        const scanMarker = (length: number, sample: (i: number) => boolean) => {
            let first = -1;
            let last = -1;
            for (let i = 1; i < length - 1; i++) {
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
        if (!topMarker && !leftMarker) {
            return undefined;
        }
        // A missing stretch marker on an axis => that axis is fully stretchable (0 fixed insets).
        const horiz = topMarker ? inset(topMarker, width) : { before: 0, after: 0 };
        const vert = leftMarker ? inset(leftMarker, height) : { before: 0, after: 0 };

        const bottomMarker = scanMarker(width, (x) => isBlack(x, height - 1));
        const rightMarker = scanMarker(height, (y) => isBlack(width - 1, y));
        // Content-padding markers are independent per edge: honor whichever are present.
        const horizMargin = bottomMarker ? inset(bottomMarker, width) : { before: 0, after: 0 };
        const vertMargin = rightMarker ? inset(rightMarker, height) : { before: 0, after: 0 };
        const margins = {
            left: horizMargin.before,
            right: horizMargin.after,
            top: vertMargin.before,
            bottom: vertMargin.after,
        };

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

function isDecodedImage(value: any): value is DecodedImage {
    return (
        value !== null &&
        typeof value === "object" &&
        typeof value.width === "number" &&
        typeof value.height === "number" &&
        value.data instanceof Uint8Array
    );
}

/** What a bitmap's constructor parameter describes: its size and options, and pixels to draw. */
interface BitmapSource {
    width: number;
    height: number;
    name: string;
    alphaEnable: boolean;
    valid: boolean;
    pixels?: DecodedImage;
}

/** Resolves an roBitmap constructor parameter (see the constructor) to the bitmap it describes. */
function bitmapSource(param: BrsType | ArrayBuffer | Buffer | DecodedImage, name: string): BitmapSource {
    const source: BitmapSource = { width: 1, height: 1, name, alphaEnable: false, valid: true };
    if (isDecodedImage(param)) {
        return withPixels(source, param);
    } else if (param instanceof ArrayBuffer || param instanceof Uint8Array) {
        return withPixels(source, decodeBitmapBytes(param));
    } else if (isStringComp(param)) {
        source.name = param.getValue();
        try {
            return withPixels(source, decodeBitmapBytes(BrsDevice.fileSystem.readFileSync(source.name)));
        } catch (err: any) {
            if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write(`error,Error loading bitmap:${source.name} - ${err.message}`);
            }
            return { ...source, valid: false };
        }
    } else if (param instanceof RoAssociativeArray) {
        const width = param.get(new BrsString("width"));
        if (width instanceof Int32 || width instanceof Float || width instanceof Double) {
            source.width = Math.trunc(width.getValue());
        }
        const height = param.get(new BrsString("height"));
        if (height instanceof Int32 || height instanceof Float || height instanceof Double) {
            source.height = Math.trunc(height.getValue());
        }
        const paramName = param.get(new BrsString("name"));
        if (paramName instanceof BrsString) {
            source.name = paramName.value;
        }
        const alphaEnable = param.get(new BrsString("alphaEnable"));
        if (alphaEnable instanceof BrsBoolean) {
            source.alphaEnable = alphaEnable.toBoolean();
        }
        return source;
    }
    if (BrsDevice.isDevMode) {
        BrsDevice.stderr.write(`warning,Invalid roBitmap param:${typeof param}`);
    }
    return { ...source, valid: false };
}

/** A source sized to its pixels, or an invalid one if there are none (they didn't decode). */
function withPixels(source: BitmapSource, pixels: DecodedImage | undefined): BitmapSource {
    return pixels ? { ...source, width: pixels.width, height: pixels.height, pixels } : { ...source, valid: false };
}

/** Decodes encoded image bytes, logging why in developer mode if they don't decode. */
function decodeBitmapBytes(image: ArrayBuffer | Uint8Array): DecodedImage | undefined {
    const bytes = image instanceof Uint8Array ? image : new Uint8Array(image);
    try {
        const decoded = decodeImage(bytes);
        if (!decoded && BrsDevice.isDevMode) {
            BrsDevice.stderr.write(`warning,Invalid image format: ${imageMimeType(bytes)}`);
        }
        return decoded;
    } catch (err: any) {
        if (BrsDevice.isDevMode) {
            BrsDevice.stderr.write(`error,Error drawing image on canvas: ${err.message}`);
        }
        return undefined;
    }
}

/** Draws decoded pixels on a bitmap's canvas (created at their size); returns `false` if that failed. */
function drawPixels(context: BrsCanvasContext2D, pixels: DecodedImage): boolean {
    // Never ask node-canvas for empty image data: on Linux it aborts the whole process
    if (!(pixels.width > 0 && pixels.height > 0)) {
        return false;
    }
    try {
        const imageData = context.createImageData(pixels.width, pixels.height);
        imageData.data.set(pixels.data);
        putImageAtPos(imageData, context, 0, 0);
        return true;
    } catch (err: any) {
        if (BrsDevice.isDevMode) {
            BrsDevice.stderr.write(`error,Error drawing image on canvas: ${err.message}`);
        }
        return false;
    }
}
