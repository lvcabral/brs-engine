import { FieldKind, FieldModel } from "./Field";
import { Group } from "./Group";
import { Font } from "./Font";
import { AAMember, BrsBoolean, BrsString, BrsType, Int32, ValueKind } from "..";
import { Interpreter } from "../../interpreter";
import { IfDraw2D } from "../interfaces/IfDraw2D";
import { rotateTranslation } from "../../scenegraph/SGUtil";

export class Label extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "text", type: "string", value: "" },
        { name: "color", type: "color", value: "0xddddddff" },
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

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (index.kind !== ValueKind.String) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const resetFields = ["text", "font", "width", "height", "numlines", "maxlines", "wrap"];
        if (resetFields.includes(index.value.toLowerCase())) {
            // Reset the flag if any relevant field changed and the label is not re-measured yet
            this.setEllipsized(false);
        }
        return super.set(index, value, alwaysNotify, kind);
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = angle !== 0 ? rotateTranslation(nodeTrans, angle) : nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const size = this.getDimensions();
        const rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };
        const rotation = angle + this.getRotation();
        const font = this.getFieldValue("font") as Font;
        const color = this.getFieldValue("color") as Int32;
        const textField = this.getFieldValue("text") as BrsString;
        const horizAlign = this.getFieldValue("horizAlign")?.toString() || "left";
        const vertAlign = this.getFieldValue("vertAlign")?.toString() || "top";
        const ellipsis = this.getFieldValue("ellipsisText")?.toString() || "...";
        const measured = this.drawText(
            textField.value,
            font,
            color.getValue(),
            rect,
            horizAlign,
            vertAlign,
            rotation,
            draw2D,
            ellipsis
        );
        this.setEllipsized(measured.ellipsized);
        rect.width = Math.max(measured.width, size.width);
        rect.height = Math.max(measured.height, size.height);
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, draw2D);
        this.updateParentRects(origin, angle);
    }

    protected setEllipsized(ellipsized: boolean) {
        this.fields.get("istextellipsized")?.setValue(BrsBoolean.from(ellipsized));
    }
}
