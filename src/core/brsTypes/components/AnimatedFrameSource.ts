import { WebPRiffParser, WebPDecoder } from "@lvcabral/libwebp";
import { parse as parseLottie, Animation as LottieAnimation, ImageSurface as LottieImageSurface } from "lottie.js";
import fileType from "file-type";
import { ZIP_MAGIC } from "../../packageEncryption";
import {
    BrsCanvas,
    BrsCanvasContext2D,
    createNewCanvas,
    drawCanvasRegion,
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

export interface PlaybackAdvance {
    readonly elapsedMs: number;
    /** True once a single-shot source has reached its duration and should hold on the last frame. */
    readonly completed: boolean;
}

/**
 * Advances `elapsedMs` by `deltaMs`, and settles single-shot completion: once `singleShot` playback
 * reaches `durationMs`, holds 1ms short of it (not `durationMs` itself, since `renderAt` wraps
 * elapsed time via `% durationMs`, so landing exactly on the boundary would read back as elapsed=0)
 * and reports completion. Shared by `RoAnimatedImage` and the SceneGraph `AnimatedImage` node —
 * their two independent playback state machines both need this same boundary handling.
 */
export function advanceElapsed(
    elapsedMs: number,
    deltaMs: number,
    durationMs: number,
    singleShot: boolean
): PlaybackAdvance {
    elapsedMs += deltaMs;
    if (singleShot && durationMs > 0 && elapsedMs >= durationMs) {
        return { elapsedMs: Math.max(0, durationMs - 1), completed: true };
    }
    return { elapsedMs, completed: false };
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
 * Wraps a decoded `AnimatedFrameSource` at a different pixel size, scaling each rendered frame to
 * fit — used for `ifAnimatedImage`'s `loadWidth`/`loadHeight` ("Scales to fit, preserving aspect
 * ratio"), which is a decode-size hint independent of `loadDisplayMode`'s node-level display fit.
 */
class ScaledFrameSource implements AnimatedFrameSource {
    readonly durationMs: number;
    readonly loopCount: number;
    private readonly canvas: BrsCanvas;
    private readonly context: BrsCanvasContext2D;
    private lastElapsedMs = -1;

    constructor(private readonly inner: AnimatedFrameSource, readonly width: number, readonly height: number) {
        this.durationMs = inner.durationMs;
        this.loopCount = inner.loopCount;
        this.canvas = createNewCanvas(width, height);
        this.context = this.canvas.getContext("2d") as BrsCanvasContext2D;
    }

    renderAt(elapsedMs: number): BrsCanvas {
        if (elapsedMs === this.lastElapsedMs) {
            return this.canvas;
        }
        const frame = this.inner.renderAt(elapsedMs);
        this.context.clearRect(0, 0, this.width, this.height);
        drawCanvasRegion(this.context, frame, 0, 0, frame.width, frame.height, 0, 0, this.width, this.height);
        this.lastElapsedMs = elapsedMs;
        return this.canvas;
    }

    dispose() {
        this.inner.dispose();
        releaseCanvas(this.canvas);
    }
}

/**
 * Applies `ifAnimatedImage`'s `loadWidth`/`loadHeight` decode-size hint to an already-decoded
 * source: scales to fit within the given bounds (0 in either dimension means "use the source's
 * own size for that axis"), preserving aspect ratio. A no-op when both are `<= 0`.
 */
export function applyLoadSize(source: AnimatedFrameSource, loadWidth: number, loadHeight: number): AnimatedFrameSource {
    if (loadWidth <= 0 && loadHeight <= 0) {
        return source;
    }
    const scaleX = loadWidth > 0 ? loadWidth / source.width : Infinity;
    const scaleY = loadHeight > 0 ? loadHeight / source.height : Infinity;
    const scale = Math.min(scaleX, scaleY);
    const targetWidth = Math.max(1, Math.round(source.width * scale));
    const targetHeight = Math.max(1, Math.round(source.height * scale));
    if (targetWidth === source.width && targetHeight === source.height) {
        return source;
    }
    return new ScaledFrameSource(source, targetWidth, targetHeight);
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

type AnimatedContentType = "webp" | "lottie" | "mp4";

/**
 * `ifAnimatedImage`'s three documented `mimeType` values, mapped to the content family each one
 * declares. Roku's own `"video/webp"` is non-standard — the WebP container format itself sniffs
 * (and is registered) as `image/webp`; Roku just repurposes the (usually static-image) `video/`
 * prefix to mean "this is meant to be played as a video-like animation."
 */
const declaredMimeTypes: Record<string, AnimatedContentType> = {
    "video/webp": "webp",
    "video/lottie+json": "lottie",
    "video/mp4": "mp4",
};

/**
 * Sniffs the actual content family from the raw bytes — a WebP RIFF container, a Lottie/Bodymovin
 * JSON document (or a compressed dotLottie, itself a ZIP archive), or an MP4/ISO-BMFF container.
 * Used both to auto-detect an omitted `mimeType` and to validate a declared one against reality.
 */
function sniffAnimatedContentType(data: Buffer): AnimatedContentType | undefined {
    const type = fileType(data);
    if (type?.mime === "image/webp") {
        return "webp";
    }
    if (type?.mime === "video/mp4") {
        return "mp4";
    }
    // ZIP local-file-header magic — a compressed dotLottie.
    if (ZIP_MAGIC.every((byte, index) => data[index] === byte)) {
        return "lottie";
    }
    // A JSON document (Lottie/Bodymovin) — not a magic-byte format `file-type` recognizes, so
    // fall back to "starts with '{' or '[' after leading whitespace".
    const text = data.subarray(0, 64).toString("utf8").trimStart();
    return text.startsWith("{") || text.startsWith("[") ? "lottie" : undefined;
}

/**
 * Decodes animated content per `ifAnimatedImage.SetContent`'s `mimeType` contract: "If omitted,
 * the file type is auto-detected." DEVICE-CONFIRMED (real WebP apps never set `mimeType` at all —
 * see `AnimatedImage.ts`'s class doc comment) that Roku's `mimeType` is a HINT, not an
 * authoritative format switch: its own `"video/webp"` value doesn't match the format's real,
 * sniffable MIME (`image/webp`). So:
 * - `mimeType` omitted: the format is auto-detected from the content (`sniffAnimatedContentType`).
 * - `mimeType` given: it is VALIDATED — an unrecognized value, or one that contradicts what the
 *   content actually sniffs as, means the content does not play (returns `undefined`) rather than
 *   guessing. A declared value that can't be checked against an inconclusive sniff (e.g. a
 *   dotLottie ZIP whose contents this decoder doesn't parse further) is trusted and attempted.
 */
export function decodeAnimatedContent(data: Buffer, mimeType: string): AnimatedFrameSource | undefined {
    const declared = mimeType.trim().toLowerCase();
    let contentType: AnimatedContentType | undefined;
    if (declared) {
        const expected = declaredMimeTypes[declared];
        if (!expected) {
            return undefined;
        }
        const sniffed = sniffAnimatedContentType(data);
        if (sniffed !== undefined && sniffed !== expected) {
            return undefined;
        }
        contentType = expected;
    } else {
        contentType = sniffAnimatedContentType(data);
    }
    switch (contentType) {
        case "webp":
            return decodeAnimatedWebP(data);
        case "lottie":
            return decodeLottie(data);
        default:
            // "mp4" is a recognized/sniffed mimeType, but this engine has no MP4 decoder; anything
            // else is genuinely unrecognized content.
            return undefined;
    }
}
