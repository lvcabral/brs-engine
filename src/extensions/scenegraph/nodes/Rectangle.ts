import { AAMember, Interpreter, IfDraw2D } from "brs-engine";
import { FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import { applyNodeEffect } from "./Effect";

export class Rectangle extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "width", type: "float", value: "0.0" },
        { name: "height", type: "float", value: "0.0" },
        { name: "color", type: "color", value: "0xFFFFFFFF" },
        { name: "blendingEnabled", type: "boolean", value: "true" },
        { name: "effect", type: "node" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.Rectangle) {
        super([], name);
        this.setExtendsType(SGNodeType.Rectangle, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    protected renderNodeContent(
        interpreter: Interpreter,
        origin: number[],
        angle: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            return;
        }
        const ownScale = this.getOwnScale();
        const drawTrans = this.getDrawTranslation(origin, angle, ownScale);
        const scale = this.getEffectiveScale(ownScale);
        const size = this.getDimensions();
        const rotation = angle + this.getRotation();
        const color = this.getValueJS("color") as number;
        opacity = opacity * this.getOpacity();
        const center = angle !== 0 && this.getRotation() === 0 ? [0, 0] : this.getScaleRotateCenter();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        applyNodeEffect(
            this,
            rect,
            draw2D,
            opacity,
            (rect, rotation, scale) => {
                draw2D?.doDrawRotatedRect(rect, color, rotation, center, opacity, scale[0], scale[1]);
            },
            rotation,
            center,
            scale
        );
        this.updateBoundingRects(this.applyScale(rect, scale), origin, rotation, ownScale);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }
}
