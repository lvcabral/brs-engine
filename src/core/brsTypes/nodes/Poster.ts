import { FieldModel } from "../components/RoSGNode";
import { AAMember, BrsString, Float, getTextureManager, Int32, RoBitmap } from "..";
import { Group } from "./Group";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { rotatedRect } from "../../scenegraph/SGUtil";

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
        const translation = this.getTranslation();
        const transScene = translation.slice();
        transScene[0] += origin[0];
        transScene[1] += origin[1];
        const size = this.getDimensions();
        const rotation = angle + this.getRotation();

        const uri = this.fields.get("uri")?.getValue();
        if (uri instanceof BrsString && uri.value.trim() !== "") {
            const textureManager = getTextureManager(interpreter);
            const bitmap = textureManager.loadTexture(uri.value);
            if (bitmap instanceof RoBitmap && bitmap.isValid()) {
                const scaleX = size.width !== 0 ? size.width / bitmap.width : 1;
                const scaleY = size.height !== 0 ? size.height / bitmap.height : 1;
                const width = scaleX * bitmap.width;
                const height = scaleY * bitmap.height;
                this.rectLocal = { x: 0, y: 0, width: width, height: height };
                if (rotation !== 0) {
                    draw2D?.doDrawRotatedBitmap(
                        transScene[0],
                        transScene[1],
                        scaleX,
                        scaleY,
                        rotation,
                        bitmap
                    );
                    this.rectToScene = rotatedRect(
                        transScene[0],
                        transScene[1],
                        width,
                        height,
                        rotation
                    );
                    this.rectToParent = {
                        x: this.rectToScene.x - origin[0],
                        y: this.rectToScene.y - origin[1],
                        width: this.rectToScene.width,
                        height: this.rectToScene.height,
                    };
                } else {
                    draw2D?.doDrawScaledObject(
                        transScene[0],
                        transScene[1],
                        scaleX,
                        scaleY,
                        bitmap
                    );
                    this.rectToScene = {
                        x: transScene[0],
                        y: transScene[1],
                        width: width,
                        height: height,
                    };
                    this.rectToParent = {
                        x: translation[0],
                        y: translation[1],
                        width: width,
                        height: height,
                    };
                }
            } else {
                interpreter.stderr.write(`error,Invalid bitmap:${uri.value}`);
            }
        }
        this.renderChildren(interpreter, transScene, rotation, draw2D);
    }
}
