import { RoSGNode, FieldModel, FieldKind } from "../components/RoSGNode";
import {
    Int32,
    Float,
    RoArray,
    AAMember,
    BrsBoolean,
    BrsType,
    ValueKind,
    BrsString,
    Font,
    BrsInvalid,
} from "..";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { BoundingRect, rotateRect, unionRect } from "../../scenegraph/SGUtil";

export class Group extends RoSGNode {
    readonly defaultFields: FieldModel[] = [
        { name: "visible", type: "boolean", value: "true" },
        { name: "opacity", type: "float", value: "1.0" },
        { name: "translation", type: "array", value: "[0.0,0.0]" },
        { name: "rotation", type: "float", value: "0.0" },
        { name: "scale", type: "array", value: "[1.0,1.0]" },
        { name: "scaleRotateCenter", type: "array", value: "[0.0,0.0]" },
        { name: "childRenderOrder", type: "string", value: "renderLast" },
        { name: "inheritParentTransform", type: "boolean", value: "true" },
        { name: "inheritParentOpacity", type: "boolean", value: "true" },
        { name: "clippingRect", type: "array", value: "[0.0,0.0,0.0,0.0]" },
        { name: "renderPass", type: "integer", value: "0" },
        { name: "muteAudioGuide", type: "boolean", value: "false" },
        { name: "enableRenderTracking", type: "boolean", value: "false" },
        { name: "renderTracking", type: "string", value: "disabled" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Group") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (index.kind !== ValueKind.String) {
            throw new Error("RoSGNode indexes must be strings");
        }

        const mapKey = index.value.toLowerCase();
        const field = this.fields.get(mapKey);

        if (field && field.getType() === FieldKind.Font && value instanceof BrsString) {
            const strFont = value.value;
            const font = new Font();
            if (strFont.startsWith("font:") && font.setSystemFont(strFont.slice(5).toLowerCase())) {
                field.setValue(font);
            } else {
                field.setValue(BrsInvalid.Instance);
            }
            this.fields.set(mapKey, field);
            return BrsInvalid.Instance;
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    protected isVisible() {
        const visible = this.fields.get("visible")?.getValue();
        return visible instanceof BrsBoolean ? visible.toBoolean() : true;
    }

    protected getTranslation() {
        const transField = this.fields.get("translation")?.getValue();
        const translation = [0, 0];
        if (transField instanceof RoArray && transField.elements.length === 2) {
            transField.elements.map((element, index) => {
                if (element instanceof Int32 || element instanceof Float) {
                    translation[index] = element.getValue();
                }
            });
        }
        return translation;
    }

    protected getDimensions() {
        const width = this.fields.get("width")?.getValue();
        const height = this.fields.get("height")?.getValue();
        return {
            width: width instanceof Int32 || width instanceof Float ? width.getValue() : 0,
            height: height instanceof Int32 || height instanceof Float ? height.getValue() : 0,
        };
    }

    protected getRotation() {
        const rotation = this.fields.get("rotation")?.getValue();
        return rotation instanceof Float ? rotation.getValue() : 0;
    }

    protected getScaleRotateCenter() {
        const scaleRotateCenter = this.fields.get("scalerotatecenter")?.getValue();
        const center = [0, 0];
        if (scaleRotateCenter instanceof RoArray && scaleRotateCenter.elements.length === 2) {
            scaleRotateCenter.elements.map((element, index) => {
                if (element instanceof Int32 || element instanceof Float) {
                    center[index] = element.getValue();
                }
            });
        }
        return center;
    }

    protected updateBoundingRects(drawRect: BoundingRect, origin: number[], rotation: number) {
        const nodeTrans = this.getTranslation();
        this.rectLocal = { x: 0, y: 0, width: drawRect.width, height: drawRect.height };
        if (rotation !== 0) {
            const rotateCenter = this.getScaleRotateCenter();
            this.rectToScene = rotateRect(
                nodeTrans[0] + origin[0],
                nodeTrans[1] + origin[1],
                drawRect.width,
                drawRect.height,
                rotation,
                rotateCenter[0],
                rotateCenter[1]
            );
            if (this.getRotation() !== 0) {
                this.rectToParent = {
                    x: this.rectToScene.x - origin[0],
                    y: this.rectToScene.y - origin[1],
                    width: this.rectToScene.width,
                    height: this.rectToScene.height,
                };
            } else {
                this.rectToParent = {
                    x: nodeTrans[0],
                    y: nodeTrans[1],
                    width: drawRect.width,
                    height: drawRect.height,
                };
            }
        } else {
            this.rectToScene = drawRect;
            this.rectToParent = {
                x: nodeTrans[0],
                y: nodeTrans[1],
                width: drawRect.width,
                height: drawRect.height,
            };
        }
    }

    protected updateParentRects(origin: number[], angle: number) {
        if (this.parent instanceof Group) {
            this.parent.rectLocal = unionRect(this.parent.rectLocal, this.rectToParent);
            const parentTrans = this.parent.getTranslation();
            let x = parentTrans[0] + this.parent.rectLocal.x;
            let y = parentTrans[1] + this.parent.rectLocal.y;
            let width = this.parent.rectLocal.width;
            let height = this.parent.rectLocal.height;
            if (angle !== 0) {
                const center = this.parent.getScaleRotateCenter();
                const rotatedRect = rotateRect(0, 0, width, height, angle, center[0], center[1]);
                x += rotatedRect.x;
                y += rotatedRect.y;
                width = rotatedRect.width;
                height = rotatedRect.height;
            }
            this.parent.rectToParent = unionRect(this.parent.rectToParent, { x, y, width, height });
            x += origin[0] - parentTrans[0];
            y += origin[1] - parentTrans[1];
            this.parent.rectToScene = unionRect(this.parent.rectToScene, { x, y, width, height });
        }
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const rotation = angle + this.getRotation();
        this.rectToScene = {
            x: drawTrans[0],
            y: drawTrans[1],
            width: 0,
            height: 0,
        };
        this.rectToParent = {
            x: nodeTrans[0],
            y: nodeTrans[1],
            width: 0,
            height: 0,
        };
        this.renderChildren(interpreter, drawTrans, rotation, draw2D);
        this.updateParentRects(origin, angle);
    }
}
