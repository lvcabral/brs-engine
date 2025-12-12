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
} from "brs-engine";
import { Group } from "./Group";
import { rotateTranslation } from "../SGUtil";
import { brsValueOf, jsValueOf } from "../factory/serialization";

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

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.Poster) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if (fieldName === "uri") {
            const uri = jsValueOf(value);
            if (typeof uri === "string" && uri.trim() !== "" && this.uri !== uri) {
                this.uri = uri;
                const loadStatus = this.loadUri(uri);
                if (loadStatus !== "ready") {
                    this.loadUri("failedBitmapUri");
                }
                super.setValue("loadStatus", new BrsString(loadStatus));
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

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = angle === 0 ? nodeTrans.slice() : rotateTranslation(nodeTrans, angle);
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        const rotation = angle + this.getRotation();
        const displayMode = this.getValueJS("loadDisplayMode") as string;
        opacity = opacity * this.getOpacity();
        if (this.bitmap instanceof RoBitmap && this.bitmap.isValid()) {
            const loadStatus = this.getValueJS("loadStatus") as string;
            let rgba = this.getValueJS("blendColor");
            let alpha = opacity;
            if (loadStatus === "failed") {
                rgba = 0xffffffff;
                alpha = opacity * this.getValueJS("loadingBitmapOpacity");
            }
            if (displayMode.trim().toLowerCase() === "scaletofit") {
                this.drawImage(this.bitmap, this.scaleToFit(rect), rotation, alpha, draw2D, rgba);
            } else if (displayMode.trim().toLowerCase() === "scaletozoom") {
                this.bitmap.scaleMode = 1;
                draw2D?.doDrawCroppedBitmap(this.bitmap, this.scaleToZoom(rect), rect, rgba, alpha);
            } else {
                this.drawImage(this.bitmap, rect, rotation, alpha, draw2D, rgba);
            }
        }
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateParentRects(origin, angle);
    }

    private loadUri(uri: string): string {
        let loadStatus = "failed";
        this.bitmap = this.loadBitmap(uri);
        if (this.bitmap?.isValid()) {
            const margins = { left: 0, right: 0, top: 0, bottom: 0 };
            if (this.bitmap.ninePatch) {
                const sizes = this.bitmap.getPatchSizes();
                margins.left = sizes.horizontal;
                margins.right = sizes.horizontal;
                margins.top = sizes.vertical;
                margins.bottom = sizes.vertical;
            } else {
                const loadWidth = this.getValueJS("loadWidth") as number;
                const loadHeight = this.getValueJS("loadHeight") as number;
                if (loadWidth > 0 && loadHeight > 0) {
                    this.bitmap = getTextureManager().resizeTexture(this.bitmap, loadWidth, loadHeight);
                }
            }
            super.setValue("bitmapWidth", new Float(this.bitmap.width));
            super.setValue("bitmapHeight", new Float(this.bitmap.height));
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
