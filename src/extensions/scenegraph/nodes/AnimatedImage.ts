import {
    AAMember,
    Interpreter,
    BrsString,
    BrsType,
    Float,
    IfDraw2D,
    Rect,
    RoAnimatedImage,
    AnimatedFrameSource,
    decodeAnimatedWebP,
    decodeLottie,
    BrsDevice,
    netlib,
} from "brs-engine";
import { sgClock } from "../SGClock";
import { sgRoot } from "../SGRoot";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";

/**
 * SceneGraph node for Roku OS 15.3's `AnimatedImage` (animated WebP / Lottie playback). Roku has
 * not published a written spec for this node — the field list and defaults below are taken from a
 * real Streaming Stick device's node dump for a working `<AnimatedImage>` instance, e.g.:
 * ```
 * <AnimatedImage translation="[100, 200]" mimeType="video/lottie+json" uri="pkg:/images/lottie.json" control="loop" />
 * ```
 * Device-confirmed fields/values: `width`, `height`, `loadWidth`, `loadHeight`, `loadDisplayMode`
 * ("noscale" default), `state` ("downloading" observed mid-load), `error`, `mediaWidth`,
 * `mediaHeight`, `uri`, `mimeType`, `control` (confirmed value `"loop"`, matching the standalone
 * `roAnimatedImage` component's `SetTargetState("loop")` — see `RoAnimatedImage.ts` — strongly
 * suggesting this node is a thin SceneGraph wrapper around one), `loadingBitmapUri`,
 * `loadingBitmapOpacity`, `failedBitmapUri`, `failedBitmapOpacity`, `audioGuideText` (all named and
 * shaped exactly like `Poster`'s equivalents). DEVICE-CONFIRMED (live app testing): `mimeType` is
 * only ever set by Lottie content (`"video/lottie+json"`) — WebP apps never set it at all, so a
 * `uri` load must not wait on `mimeType` being present (see `maybeLoad`).
 * STILL INFERRED (not observed on device): `state`'s full vocabulary beyond "downloading" (assumed
 * "none" before load, "ready" on success, "failed" on error, paired with `error`'s message);
 * `control`'s full vocabulary beyond "loop" (assumed "play"/"pause"/"stop" by analogy — "play" taken
 * as the non-looping single-shot counterpart to "loop"); whether `loadWidth`/`loadHeight` resize the
 * decoded content (NOT implemented — the fields are stored but inert) and whether
 * `loadingBitmapUri`/`failedBitmapUri` render a placeholder (NOT implemented — stored but inert,
 * unlike `Poster`'s real placeholder-swap behavior). Revisit once Roku publishes an official spec
 * (re-sync `external/dev-doc`, `brs-reference` skill) — see
 * `.claude/plans/the-roku-os-15-3-cryptic-curry.md`.
 */
export class AnimatedImage extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "uri", type: "uri" },
        { name: "mimeType", type: "string" },
        { name: "control", type: "string", value: "none" },
        { name: "state", type: "string", value: "none" },
        { name: "error", type: "string" },
        { name: "width", type: "float", value: "0.0" },
        { name: "height", type: "float", value: "0.0" },
        { name: "loadWidth", type: "float", value: "0.0" },
        { name: "loadHeight", type: "float", value: "0.0" },
        { name: "loadDisplayMode", type: "string", value: "noscale" },
        { name: "mediaWidth", type: "float", value: "0.0" },
        { name: "mediaHeight", type: "float", value: "0.0" },
        { name: "loadingBitmapUri", type: "uri" },
        { name: "loadingBitmapOpacity", type: "float", value: "1.0" },
        { name: "failedBitmapUri", type: "uri" },
        { name: "failedBitmapOpacity", type: "float", value: "1.0" },
        { name: "audioGuideText", type: "string" },
    ];
    /** `RoAnimatedImage` is reused purely as the `BrsDraw2D`-compatible current-frame canvas
     *  holder that `doDrawScaledObject`/`doDrawRotatedBitmap`/`doDrawCroppedBitmap` already accept
     *  — see the "Used only by the SceneGraph AnimatedImage node" doc comments on its
     *  `setFrameSource`/`renderAtElapsed`. */
    private readonly drawable = new RoAnimatedImage();
    private frameSource?: AnimatedFrameSource;
    private playing: boolean = false;
    /** True for control="play" (single-shot, stops once the source's duration elapses); false for
     *  control="loop". Vocabulary/behavior inferred — see the class doc comment. */
    private singleShot: boolean = false;
    private elapsedMs: number = 0;
    private lastTickTime?: number;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.AnimatedImage) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);
        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const mapKey = index.toLowerCase();
        if (mapKey === "uri" || mapKey === "mimetype") {
            super.setValue(index, value, alwaysNotify, kind);
            this.maybeLoad();
            return;
        } else if (mapKey === "control") {
            this.handleControl(value.toString().toLowerCase());
        }
        super.setValue(index, value, alwaysNotify, kind);
    }

    /**
     * Attempts a (re)load whenever `uri` or `mimeType` changes, as soon as `uri` is non-empty —
     * `mimeType` is NOT required. DEVICE-CONFIRMED: real WebP apps never set `mimeType` at all
     * (only Lottie apps set it, to `"video/lottie+json"`), so gating the load on both fields being
     * present left every WebP `AnimatedImage` stuck at `state="none"` forever. Whatever `mimeType`
     * currently holds (possibly still empty) is passed to `loadContent`, which defaults to the
     * WebP decoder when it isn't the Lottie string — matching `RoAnimatedImage.loadContent`'s
     * dispatch. Safe regardless of field write order (XML attributes apply in document order via
     * `setValue`, see `NodeFactory.addChildren`; either field may commit first) — a `uri` write
     * before `mimeType` decodes once as WebP (the common case, and correct for actual WebP
     * content), then re-decodes correctly when `mimeType` commits moments later if it turns out to
     * be Lottie.
     */
    private maybeLoad() {
        const uri = (this.getValueJS("uri") as string) ?? "";
        if (!uri.trim()) {
            this.clearContent();
            super.setValue("state", new BrsString("none"));
            return;
        }
        const mimeType = (this.getValueJS("mimeType") as string) ?? "";
        this.loadContent(uri, mimeType);
    }

    private clearContent() {
        this.frameSource?.dispose();
        this.frameSource = undefined;
        this.drawable.setFrameSource(undefined);
        this.playing = false;
        this.elapsedMs = 0;
        this.lastTickTime = undefined;
        super.setValue("mediaWidth", new Float(0));
        super.setValue("mediaHeight", new Float(0));
    }

    /** Loads and decodes synchronously (mirrors `Poster.loadUri`'s local/remote pattern), then
     *  commits `mediaWidth`/`mediaHeight`/`state`/`error` — this engine has no async load path, so
     *  the "downloading" state (device-confirmed) is only ever observable as a transient value a
     *  same-tick observer on `state` would see fire before "ready"/"failed". */
    private loadContent(uri: string, mimeType: string) {
        super.setValue("state", new BrsString("downloading"));
        let data: Buffer | undefined;
        try {
            data = uri.startsWith("http")
                ? netlib.download(BrsDevice.getCORSProxy(uri), "arraybuffer")
                : BrsDevice.fileSystem?.readFileSync(uri);
        } catch (err: any) {
            if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write(`warning,[AnimatedImage] Error loading uri:${uri} - ${err.message}`);
            }
        }
        const source = data
            ? mimeType.toLowerCase() === "video/lottie+json"
                ? decodeLottie(data)
                : decodeAnimatedWebP(data)
            : undefined;
        this.frameSource?.dispose();
        this.frameSource = source;
        this.drawable.setFrameSource(source);
        this.elapsedMs = 0;
        this.lastTickTime = this.playing ? sgClock.now() : undefined;
        if (source) {
            super.setValue("mediaWidth", new Float(source.width));
            super.setValue("mediaHeight", new Float(source.height));
            super.setValue("error", new BrsString(""));
            super.setValue("state", new BrsString("ready"));
        } else {
            super.setValue("mediaWidth", new Float(0));
            super.setValue("mediaHeight", new Float(0));
            super.setValue("error", new BrsString(`Unable to load/decode ${uri}`));
            super.setValue("state", new BrsString("failed"));
        }
        if (this.playing) {
            this.drawable.renderAtElapsed(this.elapsedMs);
        }
    }

    private handleControl(control: string) {
        switch (control) {
            case "loop":
                this.singleShot = false;
                this.playing = true;
                this.lastTickTime = sgClock.now();
                break;
            case "play":
                this.singleShot = true;
                this.playing = true;
                this.lastTickTime = sgClock.now();
                break;
            case "pause":
                this.playing = false;
                this.lastTickTime = undefined;
                break;
            case "stop":
                this.playing = false;
                this.elapsedMs = 0;
                this.lastTickTime = undefined;
                // Not gated by isPaintPass: "stop" is a discrete control write (not a per-frame
                // clock advance), so it's exempt from the layout-purity rule — same category as
                // BusySpinner's control="stop" flipping `active` directly in setValue.
                this.drawable.renderAtElapsed(0);
                break;
            default:
                break;
        }
    }

    private contentRect(drawTrans: number[]): Rect {
        const fieldWidth = this.getValueJS("width") as number;
        const fieldHeight = this.getValueJS("height") as number;
        const width = fieldWidth > 0 ? fieldWidth : this.drawable.width;
        const height = fieldHeight > 0 ? fieldHeight : this.drawable.height;
        return { x: drawTrans[0], y: drawTrans[1], width, height };
    }

    /** Aspect-preserving letterbox/pillarbox fit within `rect`, mirroring `Poster.scaleToFit`. */
    private scaleToFit(rect: Rect): Rect {
        const aspectRatio = this.drawable.width / this.drawable.height;
        const targetAspectRatio = rect.width / rect.height;
        const drawRect: Rect = { ...rect };
        if (aspectRatio < targetAspectRatio) {
            drawRect.width = rect.height * aspectRatio;
            drawRect.x += (rect.width - drawRect.width) / 2;
        } else {
            drawRect.height = rect.width / aspectRatio;
            drawRect.y += (rect.height - drawRect.height) / 2;
        }
        return drawRect;
    }

    /** Aspect-preserving crop-to-fill source rect within `rect`, mirroring `Poster.scaleToZoom`. */
    private scaleToZoom(rect: Rect): Rect {
        const scaleX = rect.width / this.drawable.width;
        const scaleY = rect.height / this.drawable.height;
        const scale = Math.max(scaleX, scaleY);
        const sourceWidth = rect.width / scale;
        const sourceHeight = rect.height / scale;
        const sourceX = (this.drawable.width - sourceWidth) / 2;
        const sourceY = (this.drawable.height - sourceHeight) / 2;
        return { x: sourceX, y: sourceY, width: sourceWidth, height: sourceHeight };
    }

    protected renderNodeContent(
        interpreter: Interpreter,
        origin: number[],
        angle: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            return;
        }
        const drawTrans = this.getDrawTranslation(origin, angle);
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();
        // Advance playback only on a paint pass: a layout pass (a bounding-rect refresh) must be
        // pure and clock-free — it draws the already-rendered frame, never advances it. See the
        // isPaintPass invariant in .claude/docs/scenegraph-invariants.md (same rule as BusySpinner).
        if (this.playing && this.frameSource && this.isPaintPass(draw2D)) {
            const now = sgClock.now();
            if (this.lastTickTime !== undefined) {
                this.elapsedMs += now - this.lastTickTime;
            }
            this.lastTickTime = now;
            if (this.singleShot && this.frameSource.durationMs > 0 && this.elapsedMs >= this.frameSource.durationMs) {
                // 1ms short of durationMs, not durationMs itself: AnimatedFrameSource.renderAt
                // wraps elapsed time via `elapsedMs % durationMs`, so landing exactly on the
                // boundary reads back as elapsed=0 (the start of the next loop) instead of
                // holding the last frame.
                this.elapsedMs = Math.max(0, this.frameSource.durationMs - 1);
                this.playing = false;
                this.lastTickTime = undefined;
            }
            this.drawable.renderAtElapsed(this.elapsedMs);
            sgRoot.makeDirty();
        }
        const rect = this.contentRect(drawTrans);
        if (this.frameSource) {
            const mode = (this.getValueJS("loadDisplayMode") as string).trim().toLowerCase();
            if (mode === "scaletofit") {
                this.drawImage(this.drawable, this.scaleToFit(rect), rotation, opacity, draw2D);
            } else if (mode === "scaletozoom") {
                draw2D?.doDrawCroppedBitmap(this.drawable, this.scaleToZoom(rect), rect, undefined, opacity);
            } else {
                this.drawImage(this.drawable, rect, rotation, opacity, draw2D);
            }
        }
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }
}
