import { RoSGNode } from "../components/RoSGNode";
import { FieldKind, FieldModel } from "./Field";
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
    RoBitmap,
    jsValueOf,
    getTextureManager,
} from "..";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { BoundingRect, convertHexColor, rotateRect, unionRect } from "../../scenegraph/SGUtil";

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

    protected readonly scale: number[];
    protected isDirty: boolean;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Group") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.scale = [1.0, 1.0];
        this.isDirty = true;
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
                value = font;
            } else {
                value = BrsInvalid.Instance;
            }
        } else if (field && field.getType() === FieldKind.Color && value instanceof BrsString) {
            let strColor = value.value;
            if (strColor.length) {
                value = new Int32(convertHexColor(strColor));
            } else {
                return BrsInvalid.Instance;
            }
        }
        this.isDirty = true;
        return super.set(index, value, alwaysNotify, kind);
    }

    setFieldValue(fieldName: string, value: BrsType, alwaysNotify?: boolean): void {
        this.isDirty = true;
        super.setFieldValue(fieldName, value, alwaysNotify);
    }

    protected isVisible() {
        const visible = this.fields.get("visible")?.getValue();
        return visible instanceof BrsBoolean ? visible.toBoolean() : true;
    }

    protected getTranslation() {
        const transField = this.fields.get("translation")?.getValue();
        const translation = [0, 0];
        if (transField instanceof RoArray && transField.elements.length === 2) {
            transField.elements.forEach((element, index) => {
                if (element instanceof Int32 || element instanceof Float) {
                    translation[index] = element.getValue() / this.scale[index];
                }
            });
        }
        return translation;
    }

    protected getDimensions() {
        const width = this.fields.get("width")?.getValue();
        const height = this.fields.get("height")?.getValue();
        return {
            width:
                width instanceof Int32 || width instanceof Float
                    ? width.getValue() / this.scale[0]
                    : 0,
            height:
                height instanceof Int32 || height instanceof Float
                    ? height.getValue() / this.scale[1]
                    : 0,
        };
    }

    protected getRotation() {
        const rotation = this.fields.get("rotation")?.getValue();
        return rotation instanceof Float ? rotation.getValue() : 0;
    }

    setScale(scale: number[]) {
        this.scale[0] = scale[0];
        this.scale[1] = scale[1];
    }

    protected getScaleRotateCenter() {
        const scaleRotateCenter = this.fields.get("scalerotatecenter")?.getValue();
        const center = [0, 0];
        if (scaleRotateCenter instanceof RoArray && scaleRotateCenter.elements.length === 2) {
            scaleRotateCenter.elements.forEach((element, index) => {
                if (element instanceof Int32 || element instanceof Float) {
                    center[index] = element.getValue() / this.scale[index];
                }
            });
        }
        return center;
    }

    protected drawText(
        fullText: string,
        font: Font,
        color: number,
        rect: Rect,
        horizAlign: string,
        vertAlign: string,
        rotation: number,
        draw2D?: IfDraw2D,
        ellipsis = "..."
    ) {
        const drawFont = font.createDrawFont();
        const measured = drawFont.measureText(fullText, rect.width, ellipsis);
        const text = measured.text;
        const textWidth = measured.width;
        const textHeight = measured.height;
        let textX = rect.x;
        let textY = rect.y;

        if (rect.width > textWidth) {
            if (horizAlign === "center") {
                textX += (rect.width - textWidth) / 2;
            } else if (horizAlign === "right") {
                textX += rect.width - textWidth;
            }
        }
        if (rect.height > textHeight) {
            if (vertAlign === "center") {
                textY += (rect.height - textHeight) / 2;
            } else if (vertAlign === "bottom") {
                textY += rect.height - textHeight;
            }
        }
        draw2D?.doDrawRotatedText(text, textX, textY, color, drawFont, rotation);
        return measured;
    }

    protected drawImage(
        bitmap: RoBitmap,
        rect: Rect,
        rotation: number,
        draw2D?: IfDraw2D,
        rgba?: number
    ) {
        if (bitmap.isValid()) {
            if (bitmap.ninePatch) {
                draw2D?.drawNinePatch(bitmap, rect);
                // TODO: Handle 9-patch rotation and rgba
                return rect;
            }
            const scaleX = rect.width !== 0 ? rect.width / bitmap.width : 1;
            const scaleY = rect.height !== 0 ? rect.height / bitmap.height : 1;
            rect.width = scaleX * bitmap.width;
            rect.height = scaleY * bitmap.height;
            if (rotation !== 0) {
                const center = this.getScaleRotateCenter();
                draw2D?.doDrawRotatedBitmap(
                    rect.x,
                    rect.y,
                    scaleX,
                    scaleY,
                    rotation,
                    bitmap,
                    center[0],
                    center[1],
                    rgba
                );
            } else {
                draw2D?.doDrawScaledObject(rect.x, rect.y, scaleX, scaleY, bitmap, rgba);
            }
        }
        return rect;
    }

    protected updateBoundingRects(drawRect: Rect, origin: number[], rotation: number) {
        const nodeTrans = this.getTranslation();
        this.rectLocal = { x: 0, y: 0, width: drawRect.width, height: drawRect.height };
        if (rotation !== 0) {
            const center = this.getScaleRotateCenter();
            this.rectToScene = rotateRect(drawRect, rotation, center);
            const nodeRotation = this.getRotation();
            if (nodeRotation !== 0 && nodeRotation === rotation) {
                this.rectToParent = {
                    x: this.rectToScene.x - origin[0],
                    y: this.rectToScene.y - origin[1],
                    width: this.rectToScene.width,
                    height: this.rectToScene.height,
                };
            } else if (nodeRotation !== 0 && nodeRotation !== rotation) {
                const rect = { x: 0, y: 0, width: drawRect.width, height: drawRect.height };
                const rotatedRect = rotateRect(rect, nodeRotation, center);
                this.rectToParent = {
                    x: nodeTrans[0] + rotatedRect.x,
                    y: nodeTrans[1] + rotatedRect.y,
                    width: rotatedRect.width,
                    height: rotatedRect.height,
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
                const rect = rotateRect({ x: 0, y: 0, width, height }, angle, center);
                x += rect.x;
                y += rect.y;
                width = rect.width;
                height = rect.height;
            }
            this.parent.rectToParent = unionRect(this.parent.rectToParent, { x, y, width, height });
            x += origin[0] - parentTrans[0];
            y += origin[1] - parentTrans[1];
            this.parent.rectToScene = unionRect(this.parent.rectToScene, { x, y, width, height });
        }
    }

    handleKey(key: string, press: boolean) {
        // override in derived classes
        return false;
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
        this.isDirty = false;
    }
}
