import { FieldModel } from "../components/RoSGNode";
import { AAMember } from "../components/RoAssociativeArray";
import { Group } from "./Group";
import { Font } from "./Font";
import { BrsBoolean, BrsString, Float, Int32, RoArray, RoFont, RoFontRegistry } from "..";
import { Interpreter } from "../../interpreter";

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
    getRenderData(interpreter: Interpreter, fontRegistry: RoFontRegistry) {
        const text = this.fields.get("text")?.getValue();
        if (!(text instanceof BrsString) || text.value.trim() === "") {
            return;
        }
        const translation = this.fields.get("translation")?.getValue();
        const pos = [0, 0];
        if (translation instanceof RoArray && translation.elements.length === 2) {
            translation.elements.map((element, index) => {
                if (element instanceof Int32 || element instanceof Float) {
                    pos[index] = element.getValue();
                }
            });
        }
        const color = Number(this.fields.get("color")?.getValue()?.toString());
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
        const width = this.fields.get("width")?.getValue();
        const height = this.fields.get("height")?.getValue();
        if (
            drawFont instanceof RoFont &&
            (width instanceof Int32 || width instanceof Float) &&
            (height instanceof Int32 || height instanceof Float)
        ) {
            // Calculate the text position based on the alignment
            const textWidth = drawFont.measureTextWidth(text as BrsString, width);
            const textHeight = drawFont.measureTextHeight();
            if (horizAlign === "center") {
                pos[0] += (width.getValue() - textWidth.getValue()) / 2;
            } else if (horizAlign === "right") {
                pos[0] += width.getValue() - textWidth.getValue();
            }
            if (vertAlign === "center") {
                pos[1] += (height.getValue() - textHeight.getValue()) / 2;
            } else if (vertAlign === "bottom") {
                pos[1] += height.getValue() - textHeight.getValue();
            }
            return {
                text: text.value,
                x: pos[0],
                y: pos[1],
                color,
                font: drawFont,
            };
        }
        return {};
    }
}
