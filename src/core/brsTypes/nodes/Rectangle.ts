import { FieldModel } from "../components/RoSGNode";
import { AAMember } from "..";
import { Group } from "./Group";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { rotateTranslation } from "../../scenegraph/SGUtil";

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
        const nodeTrans = this.getTranslation().slice();
        const drawTrans = angle !== 0 ? rotateTranslation(nodeTrans, angle) : nodeTrans;
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rotation = angle + this.getRotation();
        const color = this.getColorFieldValue("color");
        if (rotation !== 0) {
            const center = this.getScaleRotateCenter();
            draw2D?.doDrawRotatedRect(
                drawTrans[0],
                drawTrans[1],
                size.width,
                size.height,
                color,
                rotation,
                center[0],
                center[1]
            );
        } else {
            draw2D?.doDrawRect(drawTrans[0], drawTrans[1], size.width, size.height, color);
        }
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, draw2D);
        this.updateParentRects(angle);
    }
}
