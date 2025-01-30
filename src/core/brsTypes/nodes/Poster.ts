import { FieldModel } from "../components/RoSGNode";
import { AAMember, BrsString, Float, Int32, RoBitmap, RoFontRegistry } from "..";
import { Group } from "./Group";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { download } from "../../interpreter/Network";

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
    getBoundingRect() {
        const translation = this.getTranslation();
        const dimensions = this.getDimensions();
        this.rect.x = translation[0];
        this.rect.y = translation[1];
        this.rect.width = dimensions.width;
        this.rect.height = dimensions.height;
        return this.rect;
    }

    getDimensions() {
        const width = this.fields.get("width")?.getValue();
        const height = this.fields.get("height")?.getValue();
        return {
            width: width instanceof Int32 || width instanceof Float ? width.getValue() : 0,
            height: height instanceof Int32 || height instanceof Float ? height.getValue() : 0,
        };
    }

    renderNode(
        interpreter: Interpreter,
        draw2D: IfDraw2D,
        fontRegistry: RoFontRegistry,
        origin: number[],
        angle: number
    ) {
        if (!this.isVisible()) {
            return;
        }
        const trans = this.getTranslation();
        trans[0] += origin[0];
        trans[1] += origin[1];
        const size = this.getDimensions();
        const rotation = angle + this.getRotation();

        const uri = this.fields.get("uri")?.getValue();
        if (uri instanceof BrsString && uri.value.trim() !== "") {
            let imageFile: BrsString | ArrayBuffer = uri;
            if (uri.value.startsWith("http")) {
                imageFile = download(uri.value, "arraybuffer") ?? uri;
            }
            try {
                const bitmap = new RoBitmap(interpreter, imageFile);
                if (bitmap.isValid()) {
                    const scaleX = size.width !== 0 ? size.width / bitmap.width : 1;
                    const scaleY = size.height !== 0 ? size.height / bitmap.height : 1;
                    if (rotation !== 0) {
                        draw2D.doDrawRotatedObject(
                            trans[0],
                            trans[1],
                            scaleX,
                            scaleY,
                            rotation,
                            bitmap
                        );
                    } else {
                        draw2D.doDrawScaledObject(trans[0], trans[1], scaleX, scaleY, bitmap);
                    }
                } else {
                    interpreter.stderr.write(`error,Invalid bitmap:${uri.value}`);
                }
            } catch (err: any) {
                interpreter.stderr.write(
                    `error,Error loading bitmap:${uri.value} - ${err.message}`
                );
            }
        }
        this.children.forEach((node) => {
            node.renderNode(interpreter, draw2D, fontRegistry, trans, rotation);
        });
    }
}
