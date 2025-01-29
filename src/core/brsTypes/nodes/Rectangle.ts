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

    renderNode(_: Interpreter, draw2D: IfDraw2D, _fontRegistry: RoFontRegistry): void {
        const rect = this.getBoundingRect();
        const color = this.getColorFieldValue("color");
        draw2D.doDrawRect(rect.x, rect.y, rect.width, rect.height, color);
    }
}
