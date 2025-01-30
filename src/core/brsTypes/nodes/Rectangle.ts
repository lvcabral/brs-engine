import { FieldModel } from "../components/RoSGNode";
import { AAMember, Float, Int32, RoFontRegistry } from "..";
import { Group } from "./Group";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";

export class Rectangle extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "width", type: "float", value: "0.0" },
        { name: "height", type: "float", value: "0.0" },
        { name: "color", type: "string", value: "0xFFFFFFFF" },
        { name: "blendingEnabled", type: "boolean", value: "true" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Rectangle") {
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
        const color = this.getColorFieldValue("color");
        if (rotation !== 0) {
            draw2D.doDrawRotatedRect(trans[0], trans[1], size.width, size.height, color, rotation);
        } else {
            draw2D.doDrawRect(trans[0], trans[1], size.width, size.height, color);
        }
        this.children.forEach((node) => {
            node.renderNode(interpreter, draw2D, fontRegistry, trans, rotation);
        });
    }
}
