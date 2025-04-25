import { FieldModel } from "./Field";
import { Group } from "./Group";
import { AAMember } from "../components/RoAssociativeArray";
import { Interpreter } from "../..";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { getTextureManager, RoBitmap, TextEditBox } from "..";

export class Keyboard extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "text", type: "string", value: "" },
        { name: "keyColor", type: "color", value: "0x000000FF" },
        { name: "focusable", type: "boolean", value: "true" },
        { name: "focusedKeyColor", type: "color", value: "0x000000FF" },
        { name: "keyboardBitmapUri", type: "uri", value: "" },
        { name: "focusBitmapUri", type: "uri", value: "" },
        { name: "textEditBox", type: "node" },
        { name: "showTextEditBox", type: "boolean", value: "true" },
    ];

    private bitmap?: RoBitmap;
    private readonly backUriHD = "common:/images/keyboard_full_HD.png";
    private readonly backUriFHD = "common:/images/keyboard_full_FHD.png";

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Keyboard") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        if (this.resolution === "FHD") {
            this.bitmap = getTextureManager().loadTexture(this.backUriFHD);
        } else {
            this.bitmap = getTextureManager().loadTexture(this.backUriHD);
        }
        this.setFieldValue("textEditBox", new TextEditBox());
    }
    renderNode(
        interpreter: Interpreter,
        origin: number[],
        angle: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        if (!this.isVisible()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        if (this.bitmap?.isValid()) {
            this.drawImage(this.bitmap, rect, 0, opacity, draw2D);
        }
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateParentRects(origin, angle);
    }
}
