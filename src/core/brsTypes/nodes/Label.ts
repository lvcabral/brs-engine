import { FieldModel } from "../components/RoSGNode";
import { AAMember } from "../components/RoAssociativeArray";
import { Group } from "./Group";
import { Font } from "./Font";
import { BrsBoolean, BrsString, Float, Int32, RoFont, RoFontRegistry } from "..";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";

export class Label extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "text", type: "string", value: "" },
        { name: "color", type: "string", value: "0xddddddff" },
        // TODO: Add support for using a Font node as field value. For now, it will be Invalid.
        { name: "font", type: "font" },
        { name: "horizAlign", type: "string", value: "left" },
        { name: "vertAlign", type: "string", value: "top" },
        { name: "width", type: "float", value: "0" },
        { name: "height", type: "float", value: "0" },
        { name: "numLines", type: "integer", value: "0" },
        { name: "maxLines", type: "integer", value: "0" },
        { name: "wrap", type: "boolean", value: "false" },
        { name: "lineSpacing", type: "float" },
        { name: "displayPartialLines", type: "boolean", value: "false" },
        { name: "ellipsizeOnBoundary", type: "boolean", value: "false" },
        { name: "truncateOnDelimiter", type: "string" },
        { name: "wordBreakChars", type: "string" },
        { name: "ellipsisText", type: "string" },
        { name: "isTextEllipsized", type: "boolean", value: "false" },
    ];

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Label") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
    }

    protected getBoundingRect() {
        const translation = this.getTranslation();
        const dimensions = this.getDimensions();
        this.rect.x = translation[0];
        this.rect.y = translation[1];
        this.rect.width = dimensions.width;
        this.rect.height = dimensions.height;
        return this.rect;
    }

    getDimensions() {
        const width = this.fields.get("width")?.getValue();
        const height = this.fields.get("height")?.getValue();
        return {
            width: width instanceof Int32 || width instanceof Float ? width.getValue() : 0,
            height: height instanceof Int32 || height instanceof Float ? height.getValue() : 0,
        };
    }

    renderNode(
        interpreter: Interpreter,
        draw2D: IfDraw2D,
        fontRegistry: RoFontRegistry,
        origin: number[],
        angle: number
    ) {
        const text = this.fields.get("text")?.getValue();
        if (!this.isVisible() || !(text instanceof BrsString) || text.value.trim() === "") {
            return;
        }
        const trans = this.getTranslation();
        trans[0] += origin[0];
        trans[1] += origin[1];

        const color = this.getColorFieldValue("color");
        const font = this.fields.get("font")?.getValue();
        let fontSize = 24;
        if (font instanceof Font) {
            const value = font.getNodeFields().get("size")?.getValue();
            if (value instanceof Int32 || value instanceof Float) {
                fontSize = value.getValue();
            }
        }
        const defaultFontFamily = interpreter.deviceInfo.get("defaultFont");
        const drawFont = fontRegistry.createFont(
            new BrsString(defaultFontFamily),
            new Int32(fontSize),
            BrsBoolean.False,
            BrsBoolean.False
        );
        const horizAlign = this.fields.get("horizalign")?.getValue()?.toString() ?? "left";
        const vertAlign = this.fields.get("vertalign")?.getValue()?.toString() ?? "top";
        const dimensions = this.getDimensions();
        const rotation = angle + this.getRotation();
        if (drawFont instanceof RoFont) {
            // Calculate the text position based on the alignment
            const textWidth = drawFont.measureTextWidth(text, new Float(dimensions.width));
            const textHeight = drawFont.measureTextHeight();
            if (horizAlign === "center") {
                trans[0] += (dimensions.width - textWidth.getValue()) / 2;
            } else if (horizAlign === "right") {
                trans[0] += dimensions.width - textWidth.getValue();
            }
            if (vertAlign === "center") {
                trans[1] += (dimensions.height - textHeight.getValue()) / 2;
            } else if (vertAlign === "bottom") {
                trans[1] += dimensions.height - textHeight.getValue();
            }
            if (rotation !== 0) {
                draw2D.doDrawRotatedText(text.value, trans[0], trans[1], color, drawFont, rotation);
            } else {
                draw2D.doDrawText(text.value, trans[0], trans[1], color, drawFont);
            }
        }
        this.children.forEach((node) => {
            node.renderNode(interpreter, draw2D, fontRegistry, trans, rotation);
        });
    }
}
