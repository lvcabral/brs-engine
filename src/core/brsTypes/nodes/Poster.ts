import { FieldKind, FieldModel } from "./Field";
import { AAMember, BrsType, getTextureManager, isBrsString, jsValueOf, RoBitmap } from "..";
import { Group } from "./Group";
import { Interpreter } from "../../interpreter";
import { IfDraw2D, Rect } from "../interfaces/IfDraw2D";
import { rotateTranslation } from "../../scenegraph/SGUtil";

export class Poster extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "uri", type: "uri" },
        { name: "width", type: "float", value: "0.0" },
        { name: "height", type: "float", value: "0.0" },
        { name: "loadSync", type: "boolean", value: "false" },
        { name: "loadWidth", type: "float", value: "0.0" },
        { name: "loadHeight", type: "float", value: "0.0" },
        { name: "loadDisplayMode", type: "string", value: "noScale" },
        { name: "loadStatus", type: "string", value: "noScale" },
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

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Poster") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.getValue().toLowerCase();
        if (fieldName === "uri") {
            const uri = jsValueOf(value);
            if (typeof uri === "string" && uri.trim() !== "" && this.uri !== uri) {
                this.uri = uri;
                this.bitmap = getTextureManager().loadTexture(uri);
            } else if (typeof uri !== "string" || uri.trim() === "") {
                this.uri = "";
                this.bitmap = undefined;
            }
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = angle !== 0 ? rotateTranslation(nodeTrans, angle) : nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        const rotation = angle + this.getRotation();
        const displayMode = this.getFieldValueJS("loadDisplayMode") as string;
        if (this.bitmap instanceof RoBitmap) {
            const rgba = this.getFieldValueJS("blendColor");
            if (displayMode === "scaleToFit") {
                this.drawImage(this.bitmap, this.scaleToFit(rect), rotation, draw2D, rgba);
            } else if (displayMode === "scaleToZoom") {
                this.bitmap.scaleMode = 1;
                draw2D?.doDrawCroppedBitmap(this.bitmap, this.scaleToZoom(rect), rect, rgba);
            } else {
                this.drawImage(this.bitmap, rect, rotation, draw2D, rgba);
            }
        }
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, draw2D);
        this.updateParentRects(origin, angle);
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
