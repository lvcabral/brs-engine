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
    advanceElapsed,
    applyLoadSize,
    decodeAnimatedContent,
    BrsDevice,
    netlib,
} from "brs-engine";
import { sgClock } from "../SGClock";
import { sgRoot } from "../SGRoot";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { DeferredFieldWrites } from "./Field";
import { Group } from "./Group";

/**
 * SceneGraph node for Roku's `AnimatedImage` (animated WebP / Lottie playback). Field
 * names/types/defaults for `width`, `height`, `loadWidth`, `loadHeight`, `loadDisplayMode`, `uri`,
 * `mimeType`, `control`, `state`, `error`, `mediaWidth`, `mediaHeight` match the published spec.
 * `loadingBitmapUri`, `loadingBitmapOpacity`, `failedBitmapUri`, `failedBitmapOpacity`,
 * `audioGuideText` aren't part of that spec but are kept (shaped like `Poster`'s equivalents);
 * their placeholder-swap behavior isn't implemented.
 *
 * `mimeType` is a hint, not an authoritative format switch (Roku's own `"video/webp"` value is
 * non-standard). `decodeAnimatedContent` auto-detects the format when it's omitted and validates
 * it against the real content when given — a mismatch or unrecognized value fails to play rather
 * than guessing.
 *
 * `state` vocabulary: no `uri` -> `"stop"`; loading -> `"downloading"`; load complete -> `"init"`;
 * loaded, not playing -> `"first"`; playing -> `"decode"`; halted after having played -> `"stop"`;
 * load failure -> `"error"`. `control` vocabulary: `"loop"|"pause"|"play"|"rewind"` — `"play"` is
 * the single-shot counterpart to `"loop"`.
 *
 * This engine's load is fully synchronous, so `uri`/`control` set as XML attributes finish loading
 * before the owning component's `init()` gets a chance to `observeField("state", ...)` — on a real
 * (asynchronous) device the observer is already registered by then. `stateWrites` compensates: while
 * construction is in progress and `state` has no observer yet, transitions are queued instead of
 * dispatched, then replayed as separate writes once construction unwinds, reproducing the sequence
 * of observer callbacks a device would deliver.
 */
export class AnimatedImage extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "uri", type: "uri" },
        { name: "mimeType", type: "string" },
        { name: "control", type: "string" },
        { name: "state", type: "string", value: "stop" },
        { name: "error", type: "string" },
        { name: "width", type: "float", value: "0.0" },
        { name: "height", type: "float", value: "0.0" },
        { name: "loadWidth", type: "float", value: "0.0" },
        { name: "loadHeight", type: "float", value: "0.0" },
        { name: "loadDisplayMode", type: "string", value: "scaleToFit" },
        { name: "mediaWidth", type: "float", value: "0.0" },
        { name: "mediaHeight", type: "float", value: "0.0" },
        { name: "loadingBitmapUri", type: "uri" },
        { name: "loadingBitmapOpacity", type: "float", value: "1.0" },
        { name: "failedBitmapUri", type: "uri" },
        { name: "failedBitmapOpacity", type: "float", value: "1.0" },
        { name: "audioGuideText", type: "string" },
    ];
    /** Reused purely as the `BrsDraw2D`-compatible current-frame canvas holder that
     *  `doDrawScaledObject`/`doDrawRotatedBitmap`/`doDrawCroppedBitmap` already accept. */
    private readonly drawable = new RoAnimatedImage();
    private frameSource?: AnimatedFrameSource;
    private playing: boolean = false;
    /** True for control="play" (single-shot, stops once the duration elapses); false for
     *  control="loop". */
    private singleShot: boolean = false;
    private elapsedMs: number = 0;
    private lastTickTime?: number;
    private readonly stateWrites = new DeferredFieldWrites(
        () => this.resolveField("state"),
        (value) => super.setValue("state", new BrsString(value))
    );

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.AnimatedImage) {
        super([], name);
        this.setExtendsType(SGNodeType.AnimatedImage, SGNodeType.Group);
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
     * `mimeType` is not required (real WebP content never sets it). Safe regardless of field write
     * order: a `uri` write before `mimeType` decodes once, then re-decodes if `mimeType` commits
     * moments later and changes the outcome.
     */
    private maybeLoad() {
        const uri = (this.getValueJS("uri") as string) ?? "";
        if (!uri.trim()) {
            this.clearContent();
            this.stateWrites.set("stop");
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
     *  commits `mediaWidth`/`mediaHeight`/`state`/`error`. `"downloading"` is written directly
     *  (unbuffered — it happens in the same instant as the `uri` write, so no observer could exist
     *  for it either way); every later transition goes through `stateWrites`. */
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
        // mimeType is a hint (see decodeAnimatedContent): auto-detected if omitted, validated
        // against the real content if given.
        let source: AnimatedFrameSource | undefined;
        if (data) {
            source = decodeAnimatedContent(data, mimeType);
        }
        if (source) {
            const loadWidth = this.getValueJS("loadWidth") as number;
            const loadHeight = this.getValueJS("loadHeight") as number;
            source = applyLoadSize(source, loadWidth, loadHeight);
        }
        this.stateWrites.set("init");
        this.frameSource?.dispose();
        this.frameSource = source;
        this.drawable.setFrameSource(source);
        this.elapsedMs = 0;
        this.lastTickTime = this.playing ? sgClock.now() : undefined;
        if (source) {
            super.setValue("mediaWidth", new Float(source.width));
            super.setValue("mediaHeight", new Float(source.height));
            super.setValue("error", new BrsString(""));
            this.stateWrites.set(this.playing ? "decode" : "first");
        } else {
            super.setValue("mediaWidth", new Float(0));
            super.setValue("mediaHeight", new Float(0));
            super.setValue("error", new BrsString(`Unable to load/decode ${uri}`));
            this.stateWrites.set("error");
        }
        if (this.playing) {
            this.drawable.renderAtElapsed(this.elapsedMs);
        }
    }

    private handleControl(control: string) {
        switch (control) {
            case "loop":
            case "play":
                this.singleShot = control === "play";
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
                // A discrete control write, not a per-frame clock advance, so it's exempt from the
                // isPaintPass layout-purity rule.
                this.drawable.renderAtElapsed(0);
                break;
            default:
                return;
        }
        // Only once content is loaded — an early control write (uri not yet set) must not override
        // the "stop" default; loadContent's own state write accounts for `playing` once it loads.
        if (this.frameSource) {
            this.stateWrites.set(this.playing ? "decode" : "stop");
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

    /** Aspect-preserving fit within `rect` that never upscales, mirroring `Poster`'s `limitsize`
     *  (`clampLoadSize`) behavior: "Only scale down, if needed. Does not scale up." */
    private limitSize(rect: Rect): Rect {
        const scale = Math.min(rect.width / this.drawable.width, rect.height / this.drawable.height, 1);
        const width = this.drawable.width * scale;
        const height = this.drawable.height * scale;
        return { x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / 2, width, height };
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
        // Advance playback only on a paint pass; a layout pass draws the already-rendered frame
        // without advancing it (isPaintPass invariant, .claude/docs/scenegraph-invariants.md).
        if (this.playing && this.frameSource && this.isPaintPass(draw2D)) {
            const now = sgClock.now();
            const deltaMs = this.lastTickTime === undefined ? 0 : now - this.lastTickTime;
            this.lastTickTime = now;
            const advance = advanceElapsed(this.elapsedMs, deltaMs, this.frameSource.durationMs, this.singleShot);
            this.elapsedMs = advance.elapsedMs;
            if (advance.completed) {
                this.playing = false;
                this.lastTickTime = undefined;
                this.stateWrites.set("stop");
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
            } else if (mode === "noscale") {
                const naturalRect: Rect = {
                    x: rect.x,
                    y: rect.y,
                    width: this.drawable.width,
                    height: this.drawable.height,
                };
                this.drawImage(this.drawable, naturalRect, rotation, opacity, draw2D);
            } else if (mode === "limitsize") {
                this.drawImage(this.drawable, this.limitSize(rect), rotation, opacity, draw2D);
            } else {
                this.drawImage(this.drawable, rect, rotation, opacity, draw2D);
            }
        }
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }
}
