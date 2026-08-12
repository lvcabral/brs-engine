import { WebPRiffParser, WebPDecoder } from "@lvcabral/libwebp";
import { parse as parseLottie, Animation as LottieAnimation, ImageSurface as LottieImageSurface } from "lottie.js";
import {
    BrsCanvas,
    BrsCanvasContext2D,
    createNewCanvas,
    drawImageAtPos,
    putImageAtPos,
    releaseCanvas,
} from "../interfaces/IfDraw2D";

/**
 * A decoded, playable multi-frame image (animated WebP, Lottie, …). Time-based rather than
 * index-based: Lottie is continuous-time vector playback with no natural "frame N", so every
 * consumer (`RoAnimatedImage`, the SceneGraph `AnimatedImage` node) drives playback from an
 * elapsed-time value instead of a frame index.
 */
export interface AnimatedFrameSource {
    readonly width: number;
    readonly height: number;
    /** Duration of one full loop, in milliseconds. */
    readonly durationMs: number;
    /** WebP `ANIM` loop_count semantics: 0 = infinite. */
    readonly loopCount: number;
    /** Renders (and internally caches) the frame visible at `elapsedMs` since playback start,
     *  returning the canvas it was rendered onto. Re-rendering the same elapsed frame is a no-op. */
    renderAt(elapsedMs: number): BrsCanvas;
    dispose(): void;
}

// Exported (alongside `WebPFrameSource` below) so the frame-compositing algorithm — dispose/blend
// semantics — is directly unit-testable with synthetic frames, since Pillow (the fixture generator
// used by AnimatedFrameSource.test.js) doesn't expose control over the raw ANMF blend/dispose bits.
export interface DecodedWebPFrame {
    readonly data: Uint8Array;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly durationMs: number;
    /** WebP `dispose_method`: true = clear this frame's rect to transparent after it is shown. */
    readonly dispose: boolean;
    /** WebP `blend`: true = alpha-blend over the existing canvas; false = overwrite the rect. */
    readonly blend: boolean;
}

export class WebPFrameSource implements AnimatedFrameSource {
    private readonly canvas: BrsCanvas;
    private readonly context: BrsCanvasContext2D;
    private readonly frameStarts: number[];
    private lastIndex = -1;

    constructor(
        readonly width: number,
        readonly height: number,
        readonly loopCount: number,
        private readonly frames: DecodedWebPFrame[]
    ) {
        this.canvas = createNewCanvas(width, height);
        this.context = this.canvas.getContext("2d") as BrsCanvasContext2D;
        this.frameStarts = [];
        let elapsed = 0;
        for (const frame of frames) {
            this.frameStarts.push(elapsed);
            elapsed += frame.durationMs;
        }
        this.durationMs = elapsed;
    }

    readonly durationMs: number;

    renderAt(elapsedMs: number): BrsCanvas {
        const targetIndex = this.frameIndexAt(elapsedMs);
        if (targetIndex === this.lastIndex) {
            return this.canvas;
        }
        if (targetIndex === this.lastIndex + 1 || (targetIndex === 0 && this.lastIndex === this.frames.length - 1)) {
            this.compositeFrame(targetIndex);
        } else {
            this.context.clearRect(0, 0, this.width, this.height);
            for (let i = 0; i <= targetIndex; i++) {
                this.compositeFrame(i);
            }
        }
        this.lastIndex = targetIndex;
        return this.canvas;
    }

    private frameIndexAt(elapsedMs: number): number {
        if (this.frames.length <= 1 || this.durationMs <= 0) {
            return 0;
        }
        const completedLoops = Math.floor(elapsedMs / this.durationMs);
        const holdLastFrame = this.loopCount > 0 && completedLoops >= this.loopCount;
        const loopElapsed = holdLastFrame ? this.durationMs : elapsedMs % this.durationMs;
        let index = this.frames.length - 1;
        for (let i = this.frames.length - 1; i >= 0; i--) {
            if (loopElapsed >= this.frameStarts[i]) {
                index = i;
                break;
            }
        }
        return index;
    }

    /** Applies frame `index`'s predecessor's disposal, then blends/overwrites frame `index` itself. */
    private compositeFrame(index: number) {
        if (index > 0) {
            const previous = this.frames[index - 1];
            if (previous.dispose) {
                this.context.clearRect(previous.x, previous.y, previous.w, previous.h);
            }
        }
        const frame = this.frames[index];
        const patch = createNewCanvas(frame.w, frame.h);
        const patchCtx = patch.getContext("2d") as BrsCanvasContext2D;
        const imageData = patchCtx.createImageData(frame.w, frame.h);
        imageData.data.set(frame.data);
        putImageAtPos(imageData, patchCtx, 0, 0);
        if (!frame.blend) {
            this.context.clearRect(frame.x, frame.y, frame.w, frame.h);
        }
        drawImageAtPos(patch, this.context, frame.x, frame.y);
        releaseCanvas(patch);
    }

    dispose() {
        releaseCanvas(this.canvas);
    }
}

/**
 * Decodes a full animated WebP frame sequence (composited per-frame with `dispose`/`blend`
 * semantics from the `ANMF` chunks). Deliberately independent of `RoBitmap`'s WebP decode, which
 * only keeps the first frame — `RoBitmap`'s static-image behavior must not change.
 */
export function decodeAnimatedWebP(image: ArrayBuffer | Buffer | Uint8Array): AnimatedFrameSource | undefined {
    // Narrowed to a single member per branch: `Buffer.from()` can't resolve an overload against
    // the full `ArrayBuffer | Buffer | Uint8Array` union in one call.
    let imgBuffer: Buffer;
    if (Buffer.isBuffer(image)) {
        imgBuffer = image;
    } else if (image instanceof ArrayBuffer) {
        imgBuffer = Buffer.from(image);
    } else {
        imgBuffer = Buffer.from(image);
    }
    const imgArray = WebPRiffParser(imgBuffer, 0);
    if (!imgArray?.frames?.length) {
        return undefined;
    }
    const webpDecoder = new WebPDecoder();
    const loopCount = imgArray.header?.loop_count ?? 1;
    let width = imgArray.header?.canvas_width ?? 0;
    let height = imgArray.header?.canvas_height ?? 0;
    const decoded: DecodedWebPFrame[] = [];
    for (const frame of imgArray.frames) {
        const aWidth = [0];
        const aHeight = [0];
        const data = webpDecoder.WebPDecodeRGBA(imgBuffer, frame["src_off"], frame["src_size"], aWidth, aHeight);
        if (!data) {
            continue;
        }
        const w = frame["width"] ?? aWidth[0];
        const h = frame["height"] ?? aHeight[0];
        width ||= w;
        height ||= h;
        decoded.push({
            data: new Uint8Array(data),
            x: frame["offset_x"] ?? 0,
            y: frame["offset_y"] ?? 0,
            w,
            h,
            durationMs: frame["duration"] ?? 0,
            dispose: frame["dispose"] === 1,
            // Inverted from the raw ANMF flags bit: per the WebP container spec, the "blending
            // method" bit B=0 means "use alpha blending" and B=1 means "do not blend" (overwrite).
            // Storing the raw bit directly here previously overwrote (cleared to transparent)
            // exactly the frames the spec says to alpha-blend, and alpha-blended exactly the
            // frames the spec says to overwrite — small partial-rect update frames (the common
            // "blend over the previous frame" case, B=0) got their rect cleared to transparent
            // first, punching a transparent hole wherever the small frame itself had any
            // transparency, instead of showing the previous frame's content underneath.
            blend: frame["blend"] !== 1,
        });
    }
    if (!decoded.length || !width || !height) {
        return undefined;
    }
    return new WebPFrameSource(width, height, loopCount, decoded);
}

class LottieFrameSource implements AnimatedFrameSource {
    readonly loopCount = 0;
    readonly durationMs: number;
    private readonly canvas: BrsCanvas;
    private readonly context: BrsCanvasContext2D;
    private readonly imageSurface: LottieImageSurface;
    private lastFrame = -1;

    constructor(private readonly anim: LottieAnimation, readonly width: number, readonly height: number) {
        this.durationMs = anim.duration * 1000;
        this.canvas = createNewCanvas(width, height);
        this.context = this.canvas.getContext("2d") as BrsCanvasContext2D;
        this.imageSurface = new LottieImageSurface(width, height);
    }

    renderAt(elapsedMs: number): BrsCanvas {
        const loopElapsed = this.durationMs > 0 ? elapsedMs % this.durationMs : 0;
        const frame = Math.floor(this.anim.frameAtTime(loopElapsed / 1000));
        if (frame === this.lastFrame) {
            return this.canvas;
        }
        const rendered = this.imageSurface.render(this.anim, frame);
        const imageData = this.context.createImageData(rendered.width, rendered.height);
        imageData.data.set(rendered.data);
        putImageAtPos(imageData, this.context, 0, 0);
        this.lastFrame = frame;
        return this.canvas;
    }

    dispose() {
        this.imageSurface.dispose();
        releaseCanvas(this.canvas);
    }
}

/**
 * Decodes a Lottie/Bodymovin JSON document via `lottie.js`'s `ImageSurface` — its pure-pixel
 * rasterizer, not `CanvasSurface` (which calls the browser-only `Path2D` global internally and
 * has no Node `canvas`-package equivalent; see `test/simulator/probes/lottie-spike/README.md`).
 * `ImageSurface` returns raw RGBA bytes, matching the `putImageAtPos`/`createImageData` convention
 * every other decoder in this file (and `RoBitmap`) already uses.
 */
export function decodeLottie(source: Buffer | string): AnimatedFrameSource | undefined {
    let anim: LottieAnimation;
    try {
        anim = parseLottie(source);
    } catch {
        return undefined;
    }
    const width = Math.round(anim.width);
    const height = Math.round(anim.height);
    if (!width || !height) {
        return undefined;
    }
    return new LottieFrameSource(anim, width, height);
}
