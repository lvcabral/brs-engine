import { FieldModel } from "../components/RoSGNode";
import { Group } from "./Group";
import { AAMember } from "../components/RoAssociativeArray";
import { Interpreter } from "../../interpreter";
import { RoFontRegistry } from "../components/RoFontRegistry";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { BrsInvalid, BrsString, RoBitmap } from "..";
import { download } from "../../interpreter/Network";

export class Scene extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "backgroundURI", type: "uri" },
        { name: "backgroundColor", type: "string", value: "0x2F3140FF" },
        { name: "backExitsScene", type: "boolean", value: "true" },
        { name: "dialog", type: "node" },
        { name: "currentDesignResolution", type: "assocarray" },
    ];
    width = 1280;
    height = 720;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Scene") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    protected getBoundingRect() {
        const translation = this.getTranslation();
        this.rect.x = translation[0];
        this.rect.y = translation[1];
        this.rect.width = this.width;
        this.rect.height = this.height;
        return this.rect;
    }

    renderNode(interpreter: Interpreter, draw2D: IfDraw2D, _: RoFontRegistry): void {
        if (!this.isVisible()) {
            return;
        }
        const backColor = this.getColorFieldValue("backgroundcolor");
        draw2D.doClearCanvas(backColor);
        const backURI = this.fields.get("backgrounduri")?.getValue();
        if (backURI instanceof BrsString && backURI.value.trim() !== "") {
            let imageFile: BrsString | ArrayBuffer = backURI;
            if (backURI.value.startsWith("http")) {
                imageFile = download(backURI.value, "arraybuffer") ?? backURI;
            }
            try {
                const bitmap = new RoBitmap(interpreter, imageFile);
                const scaleX = this.width / bitmap.width;
                const scaleY = this.height / bitmap.height;
                draw2D.doDrawScaledObject(0, 0, scaleX, scaleY, bitmap, BrsInvalid.Instance);
            } catch (err: any) {
                interpreter.stderr.write(
                    `error,Error loading bitmap:${backURI.value} - ${err.message}`
                );
            }
        }
    }
}
