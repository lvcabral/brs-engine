import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, isStringComp } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoAssociativeArray } from "./RoAssociativeArray";
import { RoMessagePort } from "./RoMessagePort";
import {
    BrsCanvas,
    BrsCanvasContext2D,
    BrsDraw2D,
    createNewCanvas,
    drawImageAtPos,
    drawObjectToComponent,
    IfDraw2D,
    putImageAtPos,
    releaseCanvas,
    rgbaIntToHex,
} from "../interfaces/IfDraw2D";
import { IfGetMessagePort, IfSetMessagePort } from "../interfaces/IfMessagePort";
import { AnimatedFrameSource, decodeAnimatedWebP, decodeLottie } from "./AnimatedFrameSource";
import { RoAnimatedImageEvent } from "../events/RoAnimatedImageEvent";
import { BrsDevice } from "../../device/BrsDevice";
import { validUri } from "../../device/FileSystem";
import { download } from "../../interpreter/Network";

/**
 * PROVISIONAL: the exact state vocabulary and readback method for `roAnimatedImage` aren't
 * published yet (Roku's OS 15.3 release notes only show a "ready event", no state getter).
 * Modeled on `RoTextureRequest`'s `RequestState` until the official spec confirms the real one.
 */
export enum AnimatedImageState {
    None = 0,
    Loading = 1,
    Ready = 2,
    Failed = 3,
}

/**
 * Per-channel `value * multiplier / 255` lookup table for the blend-color multiply in
 * `getRgbaCanvas`, duplicated from `RoBitmap`'s identical table (see `RoBitmap.getRgbaCanvas` for
 * the full rationale/regression history) rather than shared, so `RoBitmap` stays untouched.
 */
const channelScales = new Map<number, Uint8ClampedArray>();

function channelScale(multiplier: number): Uint8ClampedArray {
    let table = channelScales.get(multiplier);
    if (!table) {
        table = new Uint8ClampedArray(256);
        for (let value = 0; value < 256; value++) {
            table[value] = (value * multiplier) / 255;
        }
        channelScales.set(multiplier, table);
    }
    return table;
}

export class RoAnimatedImage extends BrsComponent implements BrsValue, BrsDraw2D {
    readonly kind = ValueKind.Object;
    readonly x: number = 0;
    readonly y: number = 0;
    width: number = 1;
    height: number = 1;
    scaleMode: number = 0;
    rgbaRedraw: boolean = true;
    private alphaEnable: boolean = false;
    private canvas: BrsCanvas;
    private context: BrsCanvasContext2D;
    private rgbaCanvas?: BrsCanvas;
    private rgbaLast: number = 0;
    private frameSource?: AnimatedFrameSource;
    /** True once `setFrameSource`/`renderAtElapsed` (the SceneGraph `AnimatedImage` node's entry
     *  points) has been called — see `refreshFrame`'s doc comment. */
    private sgDriven = false;
    private uri: string = "";
    private mimeType: string = "";
    private targetState: string = "none";
    private playStartTime?: number;
    private state: AnimatedImageState = AnimatedImageState.None;
    private translationX: number = 0;
    private translationY: number = 0;
    private port?: RoMessagePort;

    constructor() {
        super("roAnimatedImage");
        this.canvas = createNewCanvas(this.width, this.height);
        this.context = this.canvas.getContext("2d") as BrsCanvasContext2D;
        const ifDraw2D = new IfDraw2D(this);
        const setPortIface = new IfSetMessagePort(this);
        const getPortIface = new IfGetMessagePort(this);
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
            ifAnimatedImage: [
                this.setContent,
                this.setTargetState,
                this.getState,
                this.setPretranslation,
                this.getPretranslationX,
                this.getPretranslationY,
            ],
            ifSetMessagePort: [setPortIface.setMessagePort, setPortIface.setPort],
            ifGetMessagePort: [getPortIface.getMessagePort, getPortIface.getPort],
        });
    }

    // BrsDraw2D  ------------------------------------------------------------------------------

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
        this.rgbaRedraw = true;
        return drawObjectToComponent(this, object, x, y, scaleX, scaleY, rgba, alpha);
    }

    getCanvas(): BrsCanvas {
        this.refreshFrame();
        return this.canvas;
    }

    getContext(): BrsCanvasContext2D {
        this.refreshFrame();
        return this.context;
    }

    getRgbaCanvas(rgba: number): BrsCanvas {
        this.refreshFrame();
        if (!this.rgbaCanvas) {
            this.rgbaCanvas = createNewCanvas(this.canvas.width, this.canvas.height);
        } else if (!this.rgbaRedraw && rgba === this.rgbaLast) {
            return this.rgbaCanvas;
        } else {
            this.rgbaCanvas.width = this.canvas.width;
            this.rgbaCanvas.height = this.canvas.height;
        }
        const ctx = this.rgbaCanvas.getContext("2d", { alpha: true }) as BrsCanvasContext2D;
        const red = (rgba >> 24) & 0xff;
        const green = (rgba >> 16) & 0xff;
        const blue = (rgba >> 8) & 0xff;
        if (this.canvas.width === 0 || this.canvas.height === 0) {
            drawImageAtPos(this.canvas, ctx, 0, 0);
        } else if (red === 255 && green === 255 && blue === 255) {
            drawImageAtPos(this.canvas, ctx, 0, 0);
        } else {
            const source = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const pixels = source.data;
            const scaleRed = red === 255 ? undefined : channelScale(red);
            const scaleGreen = green === 255 ? undefined : channelScale(green);
            const scaleBlue = blue === 255 ? undefined : channelScale(blue);
            for (let i = 0; i < pixels.length; i += 4) {
                if (scaleRed) {
                    pixels[i] = scaleRed[pixels[i]];
                }
                if (scaleGreen) {
                    pixels[i + 1] = scaleGreen[pixels[i + 1]];
                }
                if (scaleBlue) {
                    pixels[i + 2] = scaleBlue[pixels[i + 2]];
                }
            }
            putImageAtPos(source, ctx, 0, 0);
        }
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
        this.frameSource?.dispose();
        releaseCanvas(this.canvas);
        if (this.rgbaCanvas) {
            releaseCanvas(this.rgbaCanvas);
        }
        this.port?.removeReference();
    }

    /** Renders the current playback frame onto `this.canvas`, if content is loaded and playing.
     *  Skipped once `sgDriven` (the SceneGraph `AnimatedImage` node owns this instance's elapsed
     *  time via `renderAtElapsed`; this wall-clock path would otherwise clobber it back to
     *  elapsed=0 on every `getCanvas()`/`getContext()`/`getRgbaCanvas()` call, since `playStartTime`
     *  is never set on the SG-owned path). */
    private refreshFrame() {
        if (!this.frameSource || this.sgDriven) {
            return;
        }
        const elapsedMs = this.playStartTime === undefined ? 0 : performance.now() - this.playStartTime;
        this.applyFrame(this.frameSource.renderAt(elapsedMs));
    }

    /**
     * Always re-blits — `AnimatedFrameSource.renderAt()` mutates and returns the SAME canvas
     * object across distinct frames (it only promises to skip its OWN recompute cost when the
     * target frame is unchanged), so a `===` identity check here can never detect a real frame
     * change and would silently freeze on the first frame drawn.
     */
    private applyFrame(frameCanvas: BrsCanvas) {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        drawImageAtPos(frameCanvas, this.context, 0, 0);
        this.rgbaRedraw = true;
    }

    /**
     * Used only by the SceneGraph `AnimatedImage` node: pushes a frame source decoded by the
     * node's own `uri` loading (mirroring `Poster`'s pattern), bypassing `SetContent`'s
     * BrightScript AA/mimeType parsing. `RoAnimatedImage` is reused here purely as the
     * `BrsDraw2D`-compatible canvas holder that `doDrawScaledObject`/`doDrawRotatedBitmap` already
     * accept, so the node doesn't need a second implementation of that surface.
     */
    setFrameSource(source: AnimatedFrameSource | undefined) {
        this.sgDriven = true;
        this.frameSource?.dispose();
        this.frameSource = source;
        this.width = source?.width ?? 1;
        this.height = source?.height ?? 1;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    /**
     * Used only by the SceneGraph `AnimatedImage` node, which drives elapsed time itself via
     * `sgClock` — SceneGraph render passes must never read `performance.now()`/`Date.now()`
     * directly (`.claude/docs/scenegraph-invariants.md`), unlike `refreshFrame`'s wall-clock path
     * used by direct BrightScript callers (`GetCanvas`/`DrawObject`/…).
     */
    renderAtElapsed(elapsedMs: number) {
        this.sgDriven = true;
        if (!this.frameSource) {
            return;
        }
        this.applyFrame(this.frameSource.renderAt(elapsedMs));
    }

    private pushReadyEvent() {
        this.port?.pushMessage(new RoAnimatedImageEvent(this.state, this.uri));
    }

    /** Loads and decodes `uri`/`mimeType` off the content AA. Returns whether it became ready. */
    private loadContent(content: BrsType): boolean {
        this.frameSource?.dispose();
        this.frameSource = undefined;
        this.state = AnimatedImageState.Loading;
        if (!(content instanceof RoAssociativeArray)) {
            this.state = AnimatedImageState.Failed;
            this.pushReadyEvent();
            return false;
        }
        const uriField = content.get(new BrsString("uri"));
        const mimeField = content.get(new BrsString("mimeType"));
        this.uri = isStringComp(uriField) ? uriField.getValue() : "";
        this.mimeType = isStringComp(mimeField) ? mimeField.getValue() : "";
        if (!validUri(this.uri)) {
            this.state = AnimatedImageState.Failed;
            this.pushReadyEvent();
            return false;
        }
        let data: Buffer | undefined;
        try {
            data = this.uri.startsWith("http")
                ? download(BrsDevice.getCORSProxy(this.uri), "arraybuffer")
                : BrsDevice.fileSystem?.readFileSync(this.uri);
        } catch (err: any) {
            if (BrsDevice.isDevMode) {
                BrsDevice.stderr.write(`warning,[roAnimatedImage] Error loading content:${this.uri} - ${err.message}`);
            }
        }
        // "video/lottie+json" is confirmed by the OS 15.3 release notes; the animated-WebP
        // mimeType string is not (see AnimatedImageState's doc comment) — anything else falls
        // through to the WebP decoder, which itself returns undefined for non-WebP bytes.
        let frameSource: AnimatedFrameSource | undefined;
        if (data) {
            frameSource = this.mimeType === "video/lottie+json" ? decodeLottie(data) : decodeAnimatedWebP(data);
        }
        if (frameSource) {
            this.frameSource = frameSource;
            this.width = frameSource.width;
            this.height = frameSource.height;
            this.canvas.width = this.width;
            this.canvas.height = this.height;
            this.state = AnimatedImageState.Ready;
        } else {
            this.state = AnimatedImageState.Failed;
        }
        this.pushReadyEvent();
        return this.state === AnimatedImageState.Ready;
    }

    // ifAnimatedImage  ------------------------------------------------------------------------

    private readonly setContent = new Callable("setContent", {
        signature: {
            args: [new StdlibArgument("content", ValueKind.Object)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, content: BrsType) => {
            return BrsBoolean.from(this.loadContent(content));
        },
    });

    /** PROVISIONAL: only `"loop"` is confirmed by the OS 15.3 example; other values (`"play"`,
     *  `"stop"`, `"pause"`) are inferred, not confirmed. */
    private readonly setTargetState = new Callable("setTargetState", {
        signature: {
            args: [new StdlibArgument("state", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, state: BrsString) => {
            this.targetState = state.value.toLowerCase();
            // Self-driven wall-clock playback: the OS 15.3 example never calls a per-frame tick
            // between SetTargetState and drawing, unlike roCompositor.AnimationTick() — inferred,
            // not confirmed.
            if (this.targetState === "loop" || this.targetState === "play") {
                this.playStartTime = performance.now();
            } else if (this.targetState === "stop") {
                this.playStartTime = undefined;
            }
            return BrsInvalid.Instance;
        },
    });

    private readonly getState = new Callable("getState", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.state);
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
            this.rgbaRedraw = true;
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
