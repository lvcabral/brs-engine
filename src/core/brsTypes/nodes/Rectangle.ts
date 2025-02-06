import { FieldModel } from "../components/RoSGNode";
import { AAMember, Float, Int32 } from "..";
import { Group } from "./Group";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { rotatedRect } from "../../scenegraph/SGUtil";

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
        const color = this.getColorFieldValue("color");
        this.rectLocal = { x: 0, y: 0, width: size.width, height: size.height };
        if (rotation !== 0) {
            const rotateCenter = this.getScaleRotateCenter();
            draw2D?.doDrawRotatedRect(
                transScene[0],
                transScene[1],
                size.width,
                size.height,
                color,
                rotation,
                rotateCenter[0],
                rotateCenter[1]
            );
            this.rectToScene = rotatedRect(
                transScene[0],
                transScene[1],
                size.width,
                size.height,
                rotation,
                rotateCenter[0],
                rotateCenter[1]
            );
            this.rectToParent = {
                x: this.rectToScene.x - origin[0],
                y: this.rectToScene.y - origin[1],
                width: this.rectToScene.width,
                height: this.rectToScene.height,
            };
        } else {
            draw2D?.doDrawRect(transScene[0], transScene[1], size.width, size.height, color);
            this.rectToScene = {
                x: transScene[0],
                y: transScene[1],
                width: size.width,
                height: size.height,
            };
            this.rectToParent = {
                x: translation[0],
                y: translation[1],
                width: size.width,
                height: size.height,
            };
        }
        this.renderChildren(interpreter, transScene, rotation, draw2D);
        this.updateParentRects();
    }
}
