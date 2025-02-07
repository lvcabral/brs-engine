import { FieldModel } from "../components/RoSGNode";
import { AAMember, BrsString, getTextureManager, RoBitmap } from "..";
import { Group } from "./Group";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { rotateTranslation } from "../../scenegraph/SGUtil";

export class Poster extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "uri", type: "string" },
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
        { name: "blendColor", type: "string", value: "0xFFFFFFFF" },
        { name: "loadingBitmapUri", type: "string" },
        { name: "loadingBitmapOpacity", type: "float", value: "1.0" },
        { name: "failedBitmapUri", type: "string" },
        { name: "failedBitmapOpacity", type: "float", value: "1.0" },
        { name: "audioGuideText", type: "string" },
    ];

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
        const uri = this.fields.get("uri")?.getValue();
        if (uri instanceof BrsString && uri.value.trim() !== "") {
            const textureManager = getTextureManager(interpreter);
            const bitmap = textureManager.loadTexture(uri.value);
            if (bitmap instanceof RoBitmap && bitmap.isValid()) {
                const scaleX = size.width !== 0 ? size.width / bitmap.width : 1;
                const scaleY = size.height !== 0 ? size.height / bitmap.height : 1;
                size.width = scaleX * bitmap.width;
                size.height = scaleY * bitmap.height;
                if (rotation !== 0) {
                    draw2D?.doDrawRotatedBitmap(
                        drawTrans[0],
                        drawTrans[1],
                        scaleX,
                        scaleY,
                        rotation,
                        bitmap
                    );
                    // TODO: Add support for center of rotation
                } else {
                    draw2D?.doDrawScaledObject(drawTrans[0], drawTrans[1], scaleX, scaleY, bitmap);
                }
            } else {
                interpreter.stderr.write(`error,Invalid bitmap:${uri.value}`);
            }
        }
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, draw2D);
        this.updateParentRects(origin, angle);
    }
}
