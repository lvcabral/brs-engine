import { RoSGNode, FieldModel } from "../components/RoSGNode";
import { Int32, Float, RoArray, AAMember, BrsBoolean } from "..";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { unionRect } from "../../scenegraph/SGUtil";

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

    protected updateParentRects() {
        if (this.parent instanceof RoSGNode) {
            this.parent.rectLocal = unionRect(this.parent.rectLocal, this.rectToParent);
            this.parent.rectToParent = unionRect(this.parent.rectToParent, {
                x: this.parent.rectToParent.x + this.rectToParent.x,
                y: this.parent.rectToParent.y + this.rectToParent.y,
                width: this.rectToParent.width,
                height: this.rectToParent.height,
            });
            this.parent.rectToScene = unionRect(this.parent.rectToScene, this.rectToScene);
        }
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const translation = this.getTranslation();
        const transScene = translation.slice();
        transScene[0] += origin[0];
        transScene[1] += origin[1];
        const rotation = angle + this.getRotation();
        this.rectToScene = {
            x: transScene[0],
            y: transScene[1],
            width: 0,
            height: 0,
        };
        this.rectToParent = {
            x: translation[0],
            y: translation[1],
            width: 0,
            height: 0,
        };
        this.renderChildren(interpreter, transScene, rotation, draw2D);
        this.updateParentRects();
    }
}
