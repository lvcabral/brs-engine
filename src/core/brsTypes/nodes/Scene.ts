import { FieldModel } from "../components/RoSGNode";
import { Group } from "./Group";
import { AAMember } from "../components/RoAssociativeArray";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { BrsString, getTextureManager, Int32, RoBitmap } from "..";

export class Scene extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "backgroundURI", type: "uri" },
        { name: "backgroundColor", type: "color", value: "0x2F3140FF" },
        { name: "backExitsScene", type: "boolean", value: "true" },
        { name: "dialog", type: "node" },
        { name: "currentDesignResolution", type: "assocarray" },
    ];
    private width = 1280;
    private height = 720;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Scene") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    protected getDimensions() {
        return { width: this.width, height: this.height };
    }

    setDimensions(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.rectLocal = { x: 0, y: 0, width: this.width, height: this.height };
        this.rectToParent = { x: 0, y: 0, width: this.width, height: this.height };
        this.rectToScene = { x: 0, y: 0, width: this.width, height: this.height };
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const rotation = angle + this.getRotation();
        const backColor = this.getFieldValue("backgroundColor") as Int32;
        draw2D?.doClearCanvas(backColor.getValue());
        const backURI = this.getFieldValue("backgroundUri");
        if (draw2D && backURI instanceof BrsString && backURI.value.trim() !== "") {
            const textureManager = getTextureManager(interpreter);
            const bitmap = textureManager.loadTexture(backURI.value);
            if (bitmap instanceof RoBitmap && bitmap.isValid()) {
                const scaleX = this.width / bitmap.width;
                const scaleY = this.height / bitmap.height;
                draw2D.doDrawScaledObject(0, 0, scaleX, scaleY, bitmap);
            }
        }
        this.renderChildren(interpreter, origin, rotation, draw2D);
    }
}
