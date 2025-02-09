import { FieldModel } from "../components/RoSGNode";
import { AAMember } from "../components/RoAssociativeArray";
import { Group } from "./Group";
import { Font } from "./Font";
import { BrsString, Float } from "..";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { rotateTranslation } from "../../scenegraph/SGUtil";

export class Label extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "text", type: "string", value: "" },
        { name: "color", type: "string", value: "0xddddddff" },
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
        const nodeTrans = this.getTranslation();
        const drawTrans = angle !== 0 ? rotateTranslation(nodeTrans, angle) : nodeTrans.slice();

        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rotation = angle + this.getRotation();
        const font = this.fields.get("font")?.getValue();
        if (font instanceof Font) {
            const color = this.getColorFieldValue("color");
            const horizAlign = this.fields.get("horizalign")?.getValue()?.toString() ?? "left";
            const vertAlign = this.fields.get("vertalign")?.getValue()?.toString() ?? "top";
            // Calculate the text position based on the alignment
            const drawFont = font.createDrawFont(interpreter);
            const textWidth = drawFont
                .measureTextWidth(text, new Float(size.width || 1280))
                .getValue();
            const textHeight = drawFont.measureTextHeight().getValue();
            if (horizAlign === "center") {
                drawTrans[0] += (size.width - textWidth) / 2;
            } else if (horizAlign === "right") {
                drawTrans[0] += size.width - textWidth;
            }
            if (vertAlign === "center") {
                drawTrans[1] += (size.height - textHeight) / 2;
            } else if (vertAlign === "bottom") {
                drawTrans[1] += size.height - textHeight;
            }
            if (rotation !== 0) {
                draw2D?.doDrawRotatedText(
                    text.value,
                    drawTrans[0],
                    drawTrans[1],
                    color,
                    drawFont,
                    rotation
                );
            } else {
                draw2D?.doDrawText(text.value, drawTrans[0], drawTrans[1], color, drawFont);
            }
            size.width = textWidth;
            size.height = textHeight;
        }
        const rect = {
            x: drawTrans[0],
            y: drawTrans[1],
            width: size.width,
            height: size.height,
        };
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, draw2D);
        this.updateParentRects(origin, angle);
    }
}
