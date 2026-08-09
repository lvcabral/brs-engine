import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import {
    AAMember,
    Interpreter,
    BrsString,
    BrsType,
    Float,
    RoBitmap,
    getTextureManager,
    IfDraw2D,
    Rect,
    BrsDevice,
} from "brs-engine";
import { Group } from "./Group";
import { sgRoot } from "../SGRoot";
import { brsValueOf, jsValueOf } from "../factory/Serializer";
import { normalizeBlendColor } from "../SGUtil";

export class Poster extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "uri", type: "uri" },
        { name: "width", type: "float", value: "0.0" },
        { name: "height", type: "float", value: "0.0" },
        { name: "loadSync", type: "boolean", value: "false" },
        { name: "loadWidth", type: "float", value: "0.0" },
        { name: "loadHeight", type: "float", value: "0.0" },
        { name: "loadDisplayMode", type: "string", value: "noScale" },
        { name: "loadStatus", type: "string", value: "none" },
        { name: "bitmapWidth", type: "float", value: "0.0" },
        { name: "bitmapHeight", type: "float", value: "0.0" },
        { name: "bitmapMargins", type: "assocarray" },
        { name: "blendColor", type: "color", value: "0xFFFFFFFF" },
        { name: "loadingBitmapUri", type: "uri" },
        { name: "loadingBitmapOpacity", type: "float", value: "1.0" },
        { name: "failedBitmapUri", type: "uri" },
        { name: "failedBitmapOpacity", type: "float", value: "1.0" },
        { name: "audioGuideText", type: "string" },
    ];
    protected uri: string = "";
    protected bitmap?: RoBitmap;
    noScaling: boolean = false;
    /**
     * Set by `forceNoScaling()` for built-in Posters whose asset was already picked for the
     * correct resolution (e.g. Overhang's default logo, TrickPlayBar's ticker). Unlike
     * `noScaling` itself — which `loadUri()` recomputes from the `uri_resolution_autosub` match
     * on every load, clobbering any value set beforehand or in between loads — this flag persists
     * and keeps `noScaling` pinned `true` across every subsequent `uri` change.
     */
    private forcedNoScaling: boolean = false;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.Poster) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    forceNoScaling() {
        this.forcedNoScaling = true;
        this.noScaling = true;
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "uri") {
            const uri = jsValueOf(value);
            if (typeof uri === "string" && uri.trim() !== "" && this.uri !== uri) {
                super.setValue("loadStatus", new BrsString("loading"));
                // On a real device bitmapWidth/bitmapHeight read 0 until the image finishes loading.
                // Reset them here (silently) so the post-load values are always seen as a change and
                // notify observers on every load — even when the new image has the same dimensions as
                // the previous one (e.g. fixed loadWidth/loadHeight). Without this, an observer on
                // bitmapWidth (a common cross-fade trigger) never fires for same-size images.
                this.setValueSilent("bitmapWidth", new Float(0));
                this.setValueSilent("bitmapHeight", new Float(0));
                this.uri = uri;
                // Commit the uri field BEFORE the (synchronous) load and the loadStatus
                // notification below, so that when the resulting loadStatus="ready"/"failed"
                // change is observed, .uri already holds the new value — matching Roku, where the
                // uri field is set before the asynchronous image load completes. Apps commonly
                // preload an image on an off-screen Poster and, in its loadStatus observer, copy
                // .uri onto a visible Poster and then clear the preloader's uri; if the uri were
                // committed only afterwards (the trailing super.setValue), that clear would be
                // clobbered by the deferred write and the real image would revert to a placeholder.
                // Returning here avoids that trailing re-commit.
                super.setValue(index, value, alwaysNotify, kind);
                const loadStatus = this.loadUri(uri);
                if (loadStatus !== "ready") {
                    const failedUri = this.getValueJS("failedBitmapUri") as string;
                    this.loadUri(failedUri);
                }
                super.setValue("loadStatus", new BrsString(loadStatus));
                return;
            } else if (typeof uri !== "string" || uri.trim() === "") {
                this.uri = "";
                this.bitmap = undefined;
                super.setValue("loadStatus", new BrsString("none"));
                super.setValue("bitmapWidth", new Float(0));
                super.setValue("bitmapHeight", new Float(0));
                const margins = { left: 0, right: 0, top: 0, bottom: 0 };
                super.setValue("bitmapMargins", brsValueOf(margins));
            }
        }
        super.setValue(index, value, alwaysNotify, kind);
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
        const size = this.getDimensions();
        const loadStatus = this.getValueJS("loadStatus") as string;
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        if (loadStatus === "ready" && !this.noScaling && (rect.width <= 0 || rect.height <= 0)) {
            this.scaleToResolution(rect);
        }
        const rotation = angle + this.getRotation();
        const displayMode = this.getValueJS("loadDisplayMode") as string;
        opacity = opacity * this.getOpacity();
        if (this.bitmap instanceof RoBitmap && this.bitmap.isValid()) {
            // Normalize HERE, not only inside `drawImage`: the `scaletozoom` branch below goes straight
            // to `doDrawCroppedBitmap`, so an un-normalized default (stored as -1) reached the draw and
            // tinted the poster — washing out every partially transparent pixel.
            let rgba = normalizeBlendColor(this.getValueJS("blendColor"));
            let alpha = opacity;
            if (loadStatus === "failed") {
                // The placeholder draw is deliberately untinted; `0xffffffff` said that in the spelling
                // that leaked through the unscrubbed path above.
                rgba = undefined;
                alpha = opacity * this.getValueJS("loadingBitmapOpacity");
            }
            this.bitmap.scaleMode = 1;
            // The aspect-preserving display modes do not apply to a 9-patch: its marker border is
            // what declares which regions stretch (fixed corners are blitted 1:1), so the target
            // rect is authoritative and the source aspect ratio is meaningless. Letterboxing it to
            // the source ratio collapses a wide pill drawn from a square asset to a square the
            // height of the rect — the app-assigned width is simply lost — and cropping it
            // (scaleToZoom) slices through the markers. Same rationale as loadUri skipping
            // loadWidth/loadHeight for 9-patches: the bitmap must reach drawNinePatch intact.
            const mode = this.bitmap.ninePatch ? "noscale" : displayMode.trim().toLowerCase();
            if (mode === "scaletofit") {
                this.drawImage(this.bitmap, this.scaleToFit(rect), rotation, alpha, draw2D, rgba);
            } else if (mode === "scaletozoom") {
                draw2D?.doDrawCroppedBitmap(this.bitmap, this.scaleToZoom(rect), rect, rgba, alpha);
            } else {
                this.drawImage(this.bitmap, rect, rotation, alpha, draw2D, rgba);
            }
        }
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }

    private scaleToResolution(rect: Rect) {
        const bitmapHeight = this.bitmap?.height ?? 0;
        const bitmapWidth = this.bitmap?.width ?? 0;
        // Roku scales the Poster bitmap based on the current display mode
        if (this.resolution === BrsDevice.getDisplayMode()) {
            rect.height = rect.height <= 0 ? bitmapHeight : rect.height;
            rect.width = rect.width <= 0 ? bitmapWidth : rect.width;
        } else if (this.resolution === "FHD") {
            rect.height = rect.height <= 0 ? bitmapHeight * 1.5 : rect.height;
            rect.width = rect.width <= 0 ? bitmapWidth * 1.5 : rect.width;
        } else {
            rect.height = rect.height <= 0 ? bitmapHeight / 1.5 : rect.height;
            rect.width = rect.width <= 0 ? bitmapWidth / 1.5 : rect.width;
        }
    }

    private loadUri(uri: string): string {
        let loadStatus = "failed";
        this.bitmap = this.loadBitmap(uri);
        if (this.bitmap?.isValid()) {
            const margins = { left: 0, right: 0, top: 0, bottom: 0 };
            const sizes = this.bitmap.ninePatch ? this.bitmap.getPatchSizes() : undefined;
            if (sizes) {
                margins.left = sizes.margins.left;
                margins.right = sizes.margins.right;
                margins.top = sizes.margins.top;
                margins.bottom = sizes.margins.bottom;
            } else {
                const loadWidth = this.getValueJS("loadWidth") as number;
                const loadHeight = this.getValueJS("loadHeight") as number;
                if (loadWidth > 0 && loadHeight > 0) {
                    this.bitmap = getTextureManager().resizeTexture(this.bitmap, loadWidth, loadHeight);
                }
            }
            const subSearch = sgRoot.autoSub.search.toLowerCase();
            this.noScaling = this.forcedNoScaling || (subSearch !== "" && uri.toLowerCase().includes(subSearch));
            if (this.noScaling) {
                super.setValue("bitmapWidth", new Float(this.bitmap.width));
                super.setValue("bitmapHeight", new Float(this.bitmap.height));
            } else {
                const rect = { x: 0, y: 0, width: 0, height: 0 };
                this.scaleToResolution(rect);
                super.setValue("bitmapWidth", new Float(rect.width));
                super.setValue("bitmapHeight", new Float(rect.height));
            }
            super.setValue("bitmapMargins", brsValueOf(margins));
            loadStatus = "ready";
        }
        return loadStatus;
    }

    private scaleToFit(rect: Rect): Rect {
        const aspectRatio = this.bitmap!.width / this.bitmap!.height;
        const targetAspectRatio = rect.width / rect.height;

        const drawRect: Rect = { ...rect };
        if (aspectRatio < targetAspectRatio) {
            // pillarbox
            drawRect.width = rect.height * aspectRatio;
            drawRect.x += (rect.width - drawRect.width) / 2;
        } else {
            // letterbox
            drawRect.height = rect.width / aspectRatio;
            drawRect.y += (rect.height - drawRect.height) / 2;
        }
        return drawRect;
    }

    private scaleToZoom(rect: Rect): Rect {
        // Calculate scaling factors to fill the target area while preserving aspect ratio
        const scaleX: number = rect.width / this.bitmap!.width;
        const scaleY: number = rect.height / this.bitmap!.height;
        const scale: number = Math.max(scaleX, scaleY); // Choose the larger scale factor to fill

        // Calculate the source rectangle for cropping
        const sourceWidth: number = rect.width / scale;
        const sourceHeight: number = rect.height / scale;
        const sourceX: number = (this.bitmap!.width - sourceWidth) / 2;
        const sourceY: number = (this.bitmap!.height - sourceHeight) / 2;

        return { x: sourceX, y: sourceY, width: sourceWidth, height: sourceHeight };
    }
}
