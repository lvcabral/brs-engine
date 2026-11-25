import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, isBrsNumber, isStringComp } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoAssociativeArray } from "./RoAssociativeArray";
import { RoMessagePort } from "./RoMessagePort";
import { BrsCanvas, BrsCanvasContext2D, BrsDraw2D, createNewCanvas } from "../interfaces/IfDraw2D";
import { IfGetMessagePort, IfSetMessagePort } from "../interfaces/IfMessagePort";
import { advanceElapsed, AnimatedFrameSource, applyLoadSize, tryDecodeAnimatedContent } from "./AnimatedFrameSource";
import { RoAnimatedImageEvent } from "../events/RoAnimatedImageEvent";
import { TintCache } from "./TintCache";
import { BrsDevice } from "../../device/BrsDevice";
import { validUri } from "../../device/FileSystem";
import { download } from "../../interpreter/Network";

/** `ifAnimatedImage.GetState()`'s documented vocabulary, plus "invalid" (no content: none set, or it failed). */
export type AnimatedImageState = "invalid" | "init" | "first" | "decode" | "stop" | "error";

const validTargetStates = new Set(["play", "pause", "loop", "rewind"]);

/** What an image without a frame draws: nothing. Made on first use, not at module load. */
let noFrame: BrsCanvas | undefined;

function emptyCanvas(): BrsCanvas {
    noFrame ??= createNewCanvas(0, 0);
    return noFrame;
}

let nextIdentity = 1;

export class RoAnimatedImage extends BrsComponent implements BrsValue, BrsDraw2D {
    readonly kind = ValueKind.Object;
    readonly x: number = 0;
    readonly y: number = 0;
    readonly identity: number;
    scaleMode: number = 0;
    private frameSource?: AnimatedFrameSource;
    /** The canvas the frame source last rendered onto; draws read it directly. */
    private frameCanvas?: BrsCanvas;
    /** Tinted copies of the frame, made on the first tinted draw. */
    private tints?: TintCache;
    /** The frame source's `version` the tinted copies were made from. */
    private tintedVersion = -1;
    /** True once `setFrameSource`/`renderAtElapsed` (the SceneGraph `AnimatedImage` node's entry
     *  points) has been called — see `refreshFrame`'s doc comment. */
    private sgDriven = false;
    private animationStrategy: string = "automatic";
    private valid: boolean = false;
    private state: AnimatedImageState = "invalid";
    private playing: boolean = false;
    /** True for `SetTargetState("play")` (single-shot, stops once the source's duration elapses);
     *  false for `SetTargetState("loop")`. */
    private singleShot: boolean = false;
    private elapsedMs: number = 0;
    private lastTickTime?: number;
    private translationX: number = 0;
    private translationY: number = 0;
    private port?: RoMessagePort;

    constructor() {
        super("roAnimatedImage");
        this.identity = nextIdentity++;
        // The device exposes only ifAnimatedImage, which holds the size and message port methods too: no ifDraw2D,
        // no ifSetMessagePort/ifGetMessagePort, no SetPort/GetPort (test/simulator/probes/animated-image-surface-probe).
        const setPortIface = new IfSetMessagePort(this);
        const getPortIface = new IfGetMessagePort(this);
        this.registerMethods({
            ifAnimatedImage: [
                this.setContent,
                this.getId,
                this.isValid,
                this.getWidth,
                this.getHeight,
                this.getState,
                this.setTargetState,
                setPortIface.setMessagePort,
                getPortIface.getMessagePort,
                this.update,
                this.setPretranslation,
                this.getPretranslationX,
                this.getPretranslationY,
            ],
        });
    }

    /** The frame size; 0x0 without a frame source. */
    get width(): number {
        return this.frameSource?.width ?? 0;
    }

    get height(): number {
        return this.frameSource?.height ?? 0;
    }

    /** The frame source, which this image owns (see `setFrameSource`). */
    get source(): AnimatedFrameSource | undefined {
        return this.frameSource;
    }

    /** Whether content loaded (`IsValid()`): a draw of it reports success even with no frame to draw. */
    get loaded(): boolean {
        return this.valid;
    }

    // BrsDraw2D: only as a source. Nothing draws into an roAnimatedImage.  -----------------------

    getCanvas(): BrsCanvas {
        this.refreshFrame();
        return this.frameCanvas ?? emptyCanvas();
    }

    getContext(): BrsCanvasContext2D {
        return this.getCanvas().getContext("2d") as BrsCanvasContext2D;
    }

    getRgbaCanvas(rgba: number): BrsCanvas {
        const canvas = this.getCanvas();
        if (canvas === noFrame) {
            return canvas;
        }
        // A frame source renders every frame onto the same canvas, so the cache lives until the source changes.
        this.tints ??= new TintCache(canvas, canvas.getContext("2d") as BrsCanvasContext2D);
        return this.tints.get(rgba);
    }

    clearCanvas(_rgba: number) {
        return BrsInvalid.Instance;
    }

    drawImage(_object: BrsComponent, _x: number, _y: number): boolean {
        return false;
    }

    setCanvasAlpha(_enable: boolean) {
        return;
    }

    getCanvasAlpha(): boolean {
        return false;
    }

    isDrawable(): boolean {
        return false;
    }

    makeDirty() {
        return;
    }

    finishDraw(): void {
        return;
    }

    /** Used by `IfDraw2D.ts`'s `getPreTranslation` (mirrors `RoRegion.getTransX/Y`). */
    getTransX(): number {
        return this.translationX;
    }

    getTransY(): number {
        return this.translationY;
    }

    toString(parent?: BrsType): string {
        return "<Component: roAnimatedImage>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    dispose() {
        this.replaceSource(undefined);
        this.port?.removeReference();
    }

    /** Disposes the current frame source and its tinted copies, and takes `source` in its place. */
    private replaceSource(source: AnimatedFrameSource | undefined) {
        this.frameSource?.dispose();
        this.frameSource = source;
        this.frameCanvas = undefined;
        this.tints?.release();
        this.tints = undefined;
        this.tintedVersion = -1;
    }

    /** Renders the current playback frame, if content is loaded and playing.
     *  Skipped once `sgDriven` (the SceneGraph `AnimatedImage` node's entry points own this
     *  instance's elapsed time via `renderAtElapsed`; this wall-clock path would otherwise clobber
     *  it) or while `animationStrategy` is "manual" (playback is driven exclusively by `Update()`
     *  in that mode, per `ifAnimatedImage`). */
    private refreshFrame() {
        if (!this.frameSource || this.sgDriven) {
            return;
        }
        if (this.animationStrategy !== "manual") {
            const now = performance.now();
            const deltaMs = this.playing && this.lastTickTime !== undefined ? now - this.lastTickTime : 0;
            if (this.playing) {
                this.lastTickTime = now;
            }
            this.advancePlayback(deltaMs);
        }
        this.renderFrame(this.frameSource, this.elapsedMs);
    }

    /** Advances `elapsedMs` by `deltaMs` while playing, and settles the single-shot completion
     *  (holding the last frame, `state` -> "stop") and `state` -> "decode" transitions. Shared by
     *  the automatic wall-clock path (`refreshFrame`) and manual mode's `Update()`. */
    private advancePlayback(deltaMs: number) {
        if (!this.frameSource || !this.playing) {
            return;
        }
        const advance = advanceElapsed(this.elapsedMs, deltaMs, this.frameSource.durationMs, this.singleShot);
        this.elapsedMs = advance.elapsedMs;
        if (advance.completed) {
            this.playing = false;
            this.lastTickTime = undefined;
            this.state = "stop";
        } else {
            this.state = "decode";
        }
    }

    /**
     * Renders the frame visible at `elapsedMs`. `renderAt` returns the same canvas for every frame, so its
     * `version` tells when the tinted copies are stale.
     */
    private renderFrame(source: AnimatedFrameSource, elapsedMs: number) {
        this.frameCanvas = source.renderAt(elapsedMs);
        if (source.version !== this.tintedVersion) {
            this.tints?.markStale();
            this.tintedVersion = source.version;
        }
    }

    /**
     * Used only by the SceneGraph `AnimatedImage` node: pushes a frame source decoded by the
     * node's own `uri` loading (mirroring `Poster`'s pattern), bypassing `SetContent`'s
     * BrightScript AA/mimeType parsing. `RoAnimatedImage` is reused here purely as the
     * `BrsDraw2D`-compatible canvas holder that `doDrawScaledObject`/`doDrawRotatedBitmap` already
     * accept, so the node doesn't need a second implementation of that surface. Takes ownership of
     * `source`: the previous source is disposed here.
     */
    setFrameSource(source: AnimatedFrameSource | undefined) {
        this.sgDriven = true;
        this.replaceSource(source);
    }

    /**
     * Used only by the SceneGraph `AnimatedImage` node, which drives elapsed time itself via
     * `sgClock` — SceneGraph render passes must never read `performance.now()`/`Date.now()`
     * directly (`.claude/docs/scenegraph-invariants.md`), unlike `refreshFrame`'s wall-clock path
     * used by direct BrightScript callers (`GetCanvas`/`DrawObject`/…).
     */
    renderAtElapsed(elapsedMs: number) {
        this.sgDriven = true;
        if (this.frameSource) {
            this.renderFrame(this.frameSource, elapsedMs);
        }
    }

    private pushEvent(message: "ready" | "failed", error?: string) {
        this.port?.pushMessage(new RoAnimatedImageEvent(this.identity, message, error));
    }

    /**
     * Loads and decodes `uri`/`mimeType`/`loadWidth`/`loadHeight`/`animationStrategy` off the content AA,
     * replacing any earlier content. As on the device, the image is "invalid" at 0x0 until content loads:
     * - no `uri`: no event;
     * - a file that can't be read, isn't a recognized format, or has an unsupported `mimeType`: "failed";
     * - a file that doesn't decode as its format (e.g. a `mimeType` it contradicts): "ready", but the
     *   state is "error" and nothing is drawn.
     */
    private loadContent(content: BrsType) {
        this.replaceSource(undefined);
        this.playing = false;
        this.singleShot = false;
        this.elapsedMs = 0;
        this.lastTickTime = undefined;
        this.valid = false;
        this.state = "invalid";
        if (!(content instanceof RoAssociativeArray)) {
            return;
        }
        const uriField = content.get(new BrsString("uri"));
        const mimeField = content.get(new BrsString("mimeType"));
        const loadWidthField = content.get(new BrsString("loadWidth"));
        const loadHeightField = content.get(new BrsString("loadHeight"));
        const strategyField = content.get(new BrsString("animationStrategy"));
        const uri = isStringComp(uriField) ? uriField.getValue() : "";
        const mimeType = isStringComp(mimeField) ? mimeField.getValue() : "";
        const loadWidth = isBrsNumber(loadWidthField) ? Number(loadWidthField.getValue()) : 0;
        const loadHeight = isBrsNumber(loadHeightField) ? Number(loadHeightField.getValue()) : 0;
        this.animationStrategy =
            isStringComp(strategyField) && strategyField.getValue().toLowerCase() === "manual" ? "manual" : "automatic";
        if (uri === "") {
            return;
        }
        let data: Buffer | undefined;
        try {
            if (validUri(uri)) {
                data = uri.startsWith("http")
                    ? download(BrsDevice.getCORSProxy(uri), "arraybuffer")
                    : BrsDevice.fileSystem?.readFileSync(uri);
            }
        } catch (err: any) {
            if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write(`warning,[roAnimatedImage] Error loading content:${uri} - ${err.message}`);
            }
        }
        if (!data) {
            this.pushEvent("failed", `Unable to open animated image: ${uri}`);
            return;
        }
        const decoded = tryDecodeAnimatedContent(data, mimeType);
        switch (decoded.error) {
            case "unsupported":
                this.pushEvent("failed", `Unsupported decoder type '${decoded.mimeType}' for file: ${uri}`);
                return;
            case "undetected":
                this.pushEvent("failed", `Unable to detect decoder type from file header: ${uri}`);
                return;
            case "undecodable":
                this.valid = true;
                this.state = "error";
                this.pushEvent("ready");
                return;
        }
        this.frameSource = applyLoadSize(decoded.source, loadWidth, loadHeight);
        this.valid = true;
        this.state = "first";
        this.pushEvent("ready");
    }

    // ifAnimatedImage  ------------------------------------------------------------------------

    private readonly setContent = new Callable("setContent", {
        signature: {
            args: [new StdlibArgument("content", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, content: BrsType) => {
            this.loadContent(content);
            return BrsInvalid.Instance;
        },
    });

    private readonly getId = new Callable("getId", {
        signature: { args: [], returns: ValueKind.String },
        impl: (_: Interpreter) => {
            return new BrsString(String(this.identity));
        },
    });

    private readonly isValid = new Callable("isValid", {
        signature: { args: [], returns: ValueKind.Boolean },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.valid);
        },
    });

    private readonly getWidth = new Callable("getWidth", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(this.width);
        },
    });

    private readonly getHeight = new Callable("getHeight", {
        signature: { args: [], returns: ValueKind.Int32 },
        impl: (_: Interpreter) => {
            return new Int32(this.height);
        },
    });

    /** Sets the desired playback state: "play" (start or resume), "pause", "loop" (play
     *  continuously), or "rewind". Returns whether the requested state was accepted: never without content. */
    private readonly setTargetState = new Callable("setTargetState", {
        signature: {
            args: [new StdlibArgument("state", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, state: BrsString) => {
            const target = state.value.toLowerCase();
            if (!validTargetStates.has(target) || this.state === "invalid") {
                return BrsBoolean.False;
            }
            switch (target) {
                case "loop":
                case "play":
                    this.singleShot = target === "play";
                    this.playing = true;
                    this.lastTickTime = performance.now();
                    break;
                case "pause":
                    this.playing = false;
                    this.lastTickTime = undefined;
                    break;
                case "rewind":
                    this.elapsedMs = 0;
                    this.lastTickTime = this.playing ? performance.now() : undefined;
                    break;
            }
            if (this.frameSource) {
                this.state = this.playing ? "decode" : "stop";
            }
            return BrsBoolean.True;
        },
    });

    private readonly getState = new Callable("getState", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.state);
        },
    });

    /** Advances the animation by the elapsed time; applies only when `animationStrategy` is
     *  "manual" (per `ifAnimatedImage`, `Update()` is a no-op in automatic mode). */
    private readonly update = new Callable("update", {
        signature: {
            args: [new StdlibArgument("elapsedMicroseconds", ValueKind.Int32)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, elapsedMicroseconds: Int32) => {
            if (this.animationStrategy === "manual" && this.frameSource && !this.sgDriven) {
                this.advancePlayback(elapsedMicroseconds.getValue() / 1000);
                this.renderFrame(this.frameSource, this.elapsedMs);
            }
            return BrsInvalid.Instance;
        },
    });

    /** Sets the pretranslation for DrawObject, DrawRotatedObject and DrawScaledObject. */
    private readonly setPretranslation = new Callable("setPretranslation", {
        signature: {
            args: [
                new StdlibArgument("translationX", ValueKind.Int32),
                new StdlibArgument("translationY", ValueKind.Int32),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, translationX: Int32, translationY: Int32) => {
            this.translationX = translationX.getValue();
            this.translationY = translationY.getValue();
            return BrsInvalid.Instance;
        },
    });

    private readonly getPretranslationX = new Callable("getPretranslationX", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.translationX);
        },
    });

    private readonly getPretranslationY = new Callable("getPretranslationY", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.translationY);
        },
    });
}
