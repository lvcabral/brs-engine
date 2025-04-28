import { FieldModel } from "./Field";
import { AAMember } from "..";
import { Group } from "./Group";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { rotateTranslation } from "../../scenegraph/SGUtil";

export class Rectangle extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "width", type: "float", value: "0.0" },
        { name: "height", type: "float", value: "0.0" },
        { name: "color", type: "color", value: "0xFFFFFFFF" },
        { name: "blendingEnabled", type: "boolean", value: "true" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Rectangle") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = angle !== 0 ? rotateTranslation(nodeTrans, angle) : nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rotation = angle + this.getRotation();
        const color = this.getFieldValueJS("color") as number;
        opacity = opacity * this.getOpacity();
        const center = this.getScaleRotateCenter();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        draw2D?.doDrawRotatedRect(rect, color, rotation, center, opacity);
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateParentRects(origin, angle);
    }
}
