import { FieldModel } from "./Field";
import { AAMember, BrsString, getTextureManager, RoBitmap } from "..";
import { Group } from "./Group";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
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

    renderNode(interpreter: Interpreter, origin: number[], angle: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = angle !== 0 ? rotateTranslation(nodeTrans, angle) : nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rotation = angle + this.getRotation();
        const uri = this.getFieldValue("uri") as BrsString;
        if (uri.value.trim() !== "" && this.uri !== uri.value) {
            this.uri = uri.value;
            const textureManager = getTextureManager();
            this.bitmap = textureManager.loadTexture(uri.value);
        } else if (uri.value.trim() === "") {
            this.uri = "";
            this.bitmap = undefined;
        }
        if (this.bitmap instanceof RoBitmap && this.bitmap.isValid()) {
            const scaleX = size.width !== 0 ? size.width / this.bitmap.width : 1;
            const scaleY = size.height !== 0 ? size.height / this.bitmap.height : 1;
            size.width = scaleX * this.bitmap.width;
            size.height = scaleY * this.bitmap.height;
            if (rotation !== 0) {
                const center = this.getScaleRotateCenter();
                draw2D?.doDrawRotatedBitmap(
                    drawTrans[0],
                    drawTrans[1],
                    scaleX,
                    scaleY,
                    rotation,
                    this.bitmap,
                    center[0],
                    center[1]
                );
            } else {
                draw2D?.doDrawScaledObject(drawTrans[0], drawTrans[1], scaleX, scaleY, this.bitmap);
            }
        }
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, draw2D);
        this.updateParentRects(origin, angle);
    }
}
