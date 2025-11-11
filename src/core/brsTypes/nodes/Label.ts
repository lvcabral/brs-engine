import { AAMember, BrsBoolean, BrsType, Float, isBrsString, sgRoot, Group, Font } from "..";
import { FieldKind, FieldModel } from "./Field";
import { Interpreter } from "../../interpreter";
import { IfDraw2D, MeasuredText, Rect } from "../interfaces/IfDraw2D";
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
        { name: "lineSpacing", type: "float", value: "0" },
        { name: "displayPartialLines", type: "boolean", value: "false" },
        { name: "ellipsizeOnBoundary", type: "boolean", value: "false" },
        { name: "truncateOnDelimiter", type: "string" },
        { name: "wordBreakChars", type: "string" },
        { name: "ellipsisText", type: "string" },
        { name: "isTextEllipsized", type: "boolean", value: "false" },
    ];
    protected measured?: MeasuredText;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Label") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        if (sgRoot.scene?.ui.resolution === "FHD") {
            this.setFieldValue("lineSpacing", new Float(12));
        } else {
            this.setFieldValue("lineSpacing", new Float(8));
        }
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }
        const fieldName = index.getValue().toLowerCase();
        const resetFields = ["text", "font", "width", "height", "numlines", "maxlines", "wrap", "linespacing"];
        if (resetFields.includes(fieldName)) {
            // Reset the flag if any relevant field changed and the label is not re-measured yet
            this.setEllipsized(false);
            this.measured = undefined;
        }
        let setDirty = true;
        if (!this.isDirty && fieldName === "text" && this.getFieldValueJS("text") === value.toString()) {
            setDirty = false;
        }
        const retValue = super.set(index, value, alwaysNotify, kind);
        this.isDirty = setDirty;
        return retValue;
    }

    getMeasured() {
        if (this.measured === undefined) {
            const size = this.getDimensions();
            this.measured = this.renderLabel({ x: 0, y: 0, ...size }, 0, 1);
        }
        return this.measured;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
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
        opacity = opacity * this.getOpacity();
        this.measured = this.renderLabel(rect, rotation, opacity, draw2D);
        rect.width = Math.max(this.measured.width, size.width);
        rect.height = Math.max(this.measured.height, size.height);
        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateParentRects(origin, angle);
        this.isDirty = false;
    }

    protected renderLabel(rect: Rect, rotation: number, opacity: number, draw2D?: IfDraw2D) {
        const font = this.getFieldValue("font") as Font;
        const color = this.getFieldValueJS("color") as number;
        const textField = this.getFieldValueJS("text") as string;
        const horizAlign = this.getFieldValueJS("horizAlign") || "left";
        const vertAlign = this.getFieldValueJS("vertAlign") || "top";
        const ellipsis = this.getFieldValueJS("ellipsisText") || "...";
        const wrap = this.getFieldValueJS("wrap") as boolean;
        const numLines = this.getFieldValueJS("numLines") as number;
        const maxLines = this.getFieldValueJS("maxLines") as number;
        const displayPartialLines = this.getFieldValueJS("displayPartialLines") as boolean;
        const lineSpacing = this.getFieldValueJS("lineSpacing") as number;

        let measured;
        if (wrap) {
            if (rect.width > 0) {
                measured = this.drawTextWrap(
                    textField,
                    font,
                    color,
                    opacity,
                    rect,
                    horizAlign,
                    vertAlign,
                    rotation,
                    ellipsis,
                    numLines,
                    maxLines,
                    lineSpacing,
                    displayPartialLines,
                    draw2D
                );
            } else {
                measured = { text: "", width: 0, height: 0, ellipsized: false };
            }
        } else {
            measured = this.drawText(
                textField,
                font,
                color,
                opacity,
                rect,
                horizAlign,
                vertAlign,
                rotation,
                draw2D,
                ellipsis
            );
        }
        this.setEllipsized(measured.ellipsized);
        return measured;
    }

    protected setEllipsized(ellipsized: boolean) {
        this.fields.get("istextellipsized")?.setValue(BrsBoolean.from(ellipsized));
    }
}
