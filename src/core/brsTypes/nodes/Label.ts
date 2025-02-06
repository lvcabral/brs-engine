import { FieldModel } from "../components/RoSGNode";
import { AAMember } from "../components/RoAssociativeArray";
import { Group } from "./Group";
import { Font } from "./Font";
import { BrsBoolean, BrsString, Float, getFontRegistry, Int32, RoFont } from "..";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { rotatedRect } from "../../scenegraph/SGUtil";

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

    renderNode(interpreter: Interpreter, origin: number[], angle: number, draw2D?: IfDraw2D) {
        const text = this.fields.get("text")?.getValue();
        // TODO: Check if the label is visible but no text if the space should be considered for bounding rect.
        if (!this.isVisible() || !(text instanceof BrsString) || text.value.trim() === "") {
            return;
        }
        const translation = this.getTranslation();
        const transScene = translation.slice();

        transScene[0] += origin[0];
        transScene[1] += origin[1];

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
        const fontRegistry = getFontRegistry(interpreter);
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
                transScene[0] += (dimensions.width - textWidth.getValue()) / 2;
            } else if (horizAlign === "right") {
                transScene[0] += dimensions.width - textWidth.getValue();
            }
            if (vertAlign === "center") {
                transScene[1] += (dimensions.height - textHeight.getValue()) / 2;
            } else if (vertAlign === "bottom") {
                transScene[1] += dimensions.height - textHeight.getValue();
            }
            this.rectLocal = { x: 0, y: 0, width: dimensions.width, height: dimensions.height };
            if (rotation !== 0) {
                draw2D?.doDrawRotatedText(
                    text.value,
                    transScene[0],
                    transScene[1],
                    color,
                    drawFont,
                    rotation
                );
                this.rectToScene = rotatedRect(
                    transScene[0],
                    transScene[1],
                    dimensions.width,
                    dimensions.height,
                    rotation
                );
                this.rectToParent = {
                    x: this.rectToScene.x - origin[0],
                    y: this.rectToScene.y - origin[1],
                    width: this.rectToScene.width,
                    height: this.rectToScene.height,
                };
            } else {
                draw2D?.doDrawText(text.value, transScene[0], transScene[1], color, drawFont);
                this.rectToScene = {
                    x: transScene[0],
                    y: transScene[1],
                    width: dimensions.width,
                    height: dimensions.height,
                };
                this.rectToParent = {
                    x: translation[0],
                    y: translation[1],
                    width: dimensions.width,
                    height: dimensions.height,
                };
            }
        }
        this.renderChildren(interpreter, transScene, rotation, draw2D);
        this.updateParentRects();
    }
}
