import { AAMember, Interpreter, BrsBoolean, BrsType, Float, IfDraw2D, MeasuredText, Rect } from "brs-engine";
import { Group } from "./Group";
import type { Font } from "./Font";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { rotateTranslation } from "../SGUtil";

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

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.Label) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        if (this.resolution === "FHD") {
            this.setValueSilent("lineSpacing", new Float(12));
        } else {
            this.setValueSilent("lineSpacing", new Float(8));
        }
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        const resetFields = ["text", "font", "width", "height", "numlines", "maxlines", "wrap", "linespacing"];
        let setDirty = true;
        if (!this.isDirty && fieldName === "text" && this.getValueJS("text") === value.toString()) {
            setDirty = false;
        }
        super.setValue(index, value, alwaysNotify, kind);
        if (resetFields.includes(fieldName)) {
            // Reset the flag if any relevant field changed and the label is not re-measured yet
            this.setEllipsized(false);
            this.measured = undefined;
            this.getMeasured(); // force re-measure
        }
        this.isDirty = setDirty;
    }

    getMeasured() {
        if (this.measured === undefined) {
            const size = this.getDimensions();
            const rect: Rect = { x: 0, y: 0, ...size };
            this.measured = this.renderLabel(rect, 0, 1);
            rect.width = Math.max(this.measured.width, size.width);
            rect.height = Math.max(this.measured.height, size.height);
            this.rectLocal = { x: 0, y: 0, width: rect.width, height: rect.height };
        }
        return this.measured;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            this.updateRenderTracking(true);
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = angle === 0 ? nodeTrans.slice() : rotateTranslation(nodeTrans, angle);
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
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }

    protected renderLabel(rect: Rect, rotation: number, opacity: number, draw2D?: IfDraw2D) {
        const font = this.getValue("font") as Font;
        const color = this.getValueJS("color") as number;
        const textField = this.getValueJS("text") as string;
        const horizAlign = this.getValueJS("horizAlign") || "left";
        const vertAlign = this.getValueJS("vertAlign") || "top";
        const ellipsis = this.getValueJS("ellipsisText") || "...";
        const wrap = this.getValueJS("wrap") as boolean;
        const numLines = this.getValueJS("numLines") as number;
        const maxLines = this.getValueJS("maxLines") as number;
        const displayPartialLines = this.getValueJS("displayPartialLines") as boolean;
        const lineSpacing = this.getValueJS("lineSpacing") as number;

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
