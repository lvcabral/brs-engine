import { FieldKind, FieldModel } from "./Field";
import { Group } from "./Group";
import { AAMember } from "../components/RoAssociativeArray";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { BrsString, getTextureManager, Int32, RoBitmap, toAssociativeArray } from "..";

export class Scene extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "backgroundURI", type: "uri" },
        { name: "backgroundColor", type: FieldKind.Color, value: "0x2F3140FF" },
        { name: "backExitsScene", type: FieldKind.Boolean, value: "true" },
        { name: "dialog", type: FieldKind.Node },
        { name: "currentDesignResolution", type: FieldKind.AssocArray },
    ];
    readonly ui = { width: 1280, height: 720, resolution: "HD" };

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Scene") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.setDesignResolution("HD");
    }

    protected getDimensions() {
        return { width: this.ui.width, height: this.ui.height };
    }

    setDesignResolution(resolution: string) {
        if (!["SD", "HD", "FHD"].includes(resolution.toUpperCase())) {
            // invalid resolution
            return;
        }
        this.ui.resolution = resolution.toUpperCase();
        if (this.ui.resolution === "FHD") {
            this.ui.width = 1920;
            this.ui.height = 1080;
        } else if (this.ui.resolution === "HD") {
            this.ui.width = 1280;
            this.ui.height = 720;
        } else if (this.ui.resolution === "SD") {
            this.ui.width = 720;
            this.ui.height = 480;
        }
        this.rectLocal = { x: 0, y: 0, width: this.ui.width, height: this.ui.height };
        this.rectToParent = { x: 0, y: 0, width: this.ui.width, height: this.ui.height };
        this.rectToScene = { x: 0, y: 0, width: this.ui.width, height: this.ui.height };
        this.fields.get("currentdesignresolution")?.setValue(toAssociativeArray(this.ui));
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
            const textureManager = getTextureManager();
            const bitmap = textureManager.loadTexture(backURI.value);
            if (bitmap instanceof RoBitmap && bitmap.isValid()) {
                const scaleX = this.ui.width / bitmap.width;
                const scaleY = this.ui.height / bitmap.height;
                draw2D.doDrawScaledObject(0, 0, scaleX, scaleY, bitmap);
            }
        }
        this.renderChildren(interpreter, origin, rotation, draw2D);
    }
}
