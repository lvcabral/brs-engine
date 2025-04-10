import { rootObjects, RoSGNode } from "../components/RoSGNode";
import { FieldKind, FieldModel } from "./Field";
import {
    Int32,
    Float,
    RoArray,
    AAMember,
    BrsType,
    BrsString,
    Font,
    BrsInvalid,
    RoBitmap,
    RoFont,
    Label,
    Poster,
    jsValueOf,
    isBrsString,
    BrsBoolean,
} from "..";
import { Interpreter } from "../../interpreter";
import { IfDraw2D, MeasuredText, Rect } from "../interfaces/IfDraw2D";
import { convertHexColor, rotateRect, unionRect } from "../../scenegraph/SGUtil";

export class Group extends RoSGNode {
    readonly defaultFields: FieldModel[] = [
        { name: "visible", type: "boolean", value: "true" },
        { name: "opacity", type: "float", value: "1.0" },
        { name: "translation", type: "array", value: "[0.0,0.0]" },
        { name: "rotation", type: "float", value: "0.0" },
        { name: "scale", type: "array", value: "[1.0,1.0]" },
        { name: "scaleRotateCenter", type: "array", value: "[0.0,0.0]" },
        { name: "childRenderOrder", type: "string", value: "renderLast" },
        { name: "inheritParentTransform", type: "boolean", value: "true" },
        { name: "inheritParentOpacity", type: "boolean", value: "true" },
        { name: "clippingRect", type: "array", value: "[0.0,0.0,0.0,0.0]" },
        { name: "renderPass", type: "integer", value: "0" },
        { name: "muteAudioGuide", type: "boolean", value: "false" },
        { name: "enableRenderTracking", type: "boolean", value: "false" },
        { name: "renderTracking", type: "string", value: "disabled" },
    ];
    protected readonly resolution: string;
    protected isDirty: boolean;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Group") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.resolution = rootObjects.rootScene?.ui.resolution ?? "HD";
        this.isDirty = true;
    }

    set(index: BrsType, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        if (!isBrsString(index)) {
            throw new Error("RoSGNode indexes must be strings");
        }

        const mapKey = index.getValue().toLowerCase();
        const field = this.fields.get(mapKey);

        if (field?.getType() === FieldKind.Font && isBrsString(value)) {
            const strFont = value.getValue();
            const font = new Font();
            if (strFont.startsWith("font:") && font.setSystemFont(strFont.slice(5).toLowerCase())) {
                value = font;
            } else {
                value = BrsInvalid.Instance;
            }
        } else if (field?.getType() === FieldKind.Color && isBrsString(value)) {
            let strColor = value.getValue();
            if (strColor.length) {
                value = new Int32(convertHexColor(strColor));
            } else {
                return BrsInvalid.Instance;
            }
        }
        this.isDirty = true;
        return super.set(index, value, alwaysNotify, kind);
    }

    setFieldValue(fieldName: string, value: BrsType, alwaysNotify?: boolean): void {
        this.isDirty = true;
        super.setFieldValue(fieldName, value, alwaysNotify);
    }

    getDimensions() {
        return {
            width: (this.getFieldValueJS("width") as number) ?? 0,
            height: (this.getFieldValueJS("height") as number) ?? 0,
        };
    }

    isVisible() {
        return (this.getFieldValueJS("visible") as boolean) ?? true;
    }

    protected addPoster(uri: string, translation: number[], width?: number, height?: number) {
        const poster = new Poster();
        if (uri) {
            poster.set(new BrsString("uri"), new BrsString(uri));
        }
        poster.set(
            new BrsString("translation"),
            new RoArray([new Float(translation[0]), new Float(translation[1])])
        );
        if (width !== undefined) {
            poster.set(new BrsString("width"), new Float(width));
        }
        if (height !== undefined) {
            poster.set(new BrsString("height"), new Float(height));
        }
        this.appendChildToParent(poster);
        return poster;
    }

    protected addLabel(
        colorField: string,
        translation: number[],
        width?: number,
        height?: number,
        fontSize?: number,
        vertAlign?: string,
        horizAlign?: string,
        wrap?: boolean
    ) {
        const label = new Label();
        this.copyField(label, "color", colorField);
        if (fontSize) {
            const labelFields = label.getNodeFields();
            const labelFont = labelFields.get("font")?.getValue();
            if (labelFont instanceof Font) {
                labelFont.setSize(fontSize);
            }
        }
        if (width !== undefined) {
            label.set(new BrsString("width"), new Float(width));
        }
        if (height !== undefined) {
            label.set(new BrsString("height"), new Float(height));
        }
        label.set(
            new BrsString("translation"),
            new RoArray([new Float(translation[0]), new Float(translation[1])])
        );
        if (vertAlign) {
            label.set(new BrsString("vertalign"), new BrsString(vertAlign));
        }
        if (horizAlign) {
            label.set(new BrsString("horizalign"), new BrsString(horizAlign));
        }
        if (wrap !== undefined) {
            label.set(new BrsString("wrap"), BrsBoolean.from(wrap));
        }
        this.appendChildToParent(label);
        return label;
    }

    protected getTranslation() {
        const transField = this.getFieldValue("translation");
        const translation = [0, 0];
        if (transField instanceof RoArray && transField.elements.length === 2) {
            translation[0] = jsValueOf(transField.elements[0]) as number;
            translation[1] = jsValueOf(transField.elements[1]) as number;
        }
        // Adjust translation based on scale and rotation center
        const scale = this.getFieldValueJS("scale") as number[];
        const scaleRotateCenter = this.getScaleRotateCenter();
        const scaleDiffX = scaleRotateCenter[0] * (scale[0] - 1);
        const scaleDiffY = scaleRotateCenter[1] * (scale[1] - 1);
        translation[0] -= scaleDiffX;
        translation[1] -= scaleDiffY;
        return translation;
    }

    protected getRotation() {
        const rotation = this.getFieldValueJS("rotation") as number;
        return rotation ?? 0;
    }

    protected getScaleRotateCenter() {
        const scaleRotateCenter = this.getFieldValue("scaleRotateCenter");
        const center = [0, 0];
        if (scaleRotateCenter instanceof RoArray && scaleRotateCenter.elements.length === 2) {
            center[0] = jsValueOf(scaleRotateCenter.elements[0]) as number;
            center[1] = jsValueOf(scaleRotateCenter.elements[1]) as number;
        }
        return center;
    }

    protected drawText(
        fullText: string,
        font: Font,
        color: number,
        rect: Rect,
        horizAlign: string,
        vertAlign: string,
        rotation: number,
        draw2D?: IfDraw2D,
        ellipsis: string = "..."
    ) {
        const drawFont = font.createDrawFont();
        let measured = drawFont.measureText(fullText, rect.width, ellipsis);
        let text = measured.text;
        if (rect.width === 0) {
            const newlineIndex = fullText.indexOf("\n");
            if (newlineIndex !== -1) {
                text = fullText.substring(0, newlineIndex);
                measured = drawFont.measureText(text);
            }
        }

        let textX = rect.x;
        let textY = rect.y;

        if (rect.width > measured.width) {
            if (horizAlign === "center") {
                textX += (rect.width - measured.width) / 2;
            } else if (horizAlign === "right") {
                textX += rect.width - measured.width;
            }
        }
        if (rect.height > measured.height) {
            if (vertAlign === "center") {
                textY += (rect.height - measured.height) / 2;
            } else if (vertAlign === "bottom") {
                textY += rect.height - measured.height;
            }
        }
        if (draw2D) {
            draw2D.doDrawRotatedText(text, textX, textY, color, drawFont, rotation);
        }

        return measured;
    }

    protected drawTextWrap(
        text: string,
        font: Font,
        color: number,
        rect: Rect,
        horizAlign: string,
        vertAlign: string,
        rotation: number,
        ellipsis: string = "...",
        numLines: number = 0,
        maxLines: number = 0,
        lineSpacing: number = 0,
        displayPartialLines: boolean = false,
        draw2D?: IfDraw2D
    ): MeasuredText {
        const drawFont = font.createDrawFont();
        const lines = this.breakTextIntoLines(text, drawFont, rect.width);
        let renderedLines = lines;
        let ellipsized = false;
        let lineHeight = drawFont.measureText("M").height;
        let totalHeight = lines.length * lineHeight;

        if (rect.height > 0) {
            const maxRenderedLines = Math.floor(
                (rect.height + lineSpacing) / (lineHeight + lineSpacing)
            );
            if (lines.length > maxRenderedLines) {
                renderedLines = lines.slice(0, maxRenderedLines);
                ellipsized = true;
            }
            if (!displayPartialLines && renderedLines.length < lines.length) {
                totalHeight =
                    renderedLines.length * lineHeight +
                    (renderedLines.length > 1 ? (renderedLines.length - 1) * lineSpacing : 0);
            } else {
                totalHeight = Math.min(totalHeight, rect.height);
            }
        } else if (numLines > 0) {
            if (lines.length > numLines) {
                renderedLines = lines.slice(0, numLines);
                ellipsized = true;
            }
            totalHeight = Math.min(
                totalHeight,
                numLines * lineHeight + (numLines > 1 ? (numLines - 1) * lineSpacing : 0)
            );
        } else if (maxLines > 0) {
            if (lines.length > maxLines) {
                renderedLines = lines.slice(0, maxLines);
                ellipsized = true;
            }
            totalHeight = Math.min(
                totalHeight,
                maxLines * lineHeight + (maxLines > 1 ? (maxLines - 1) * lineSpacing : 0)
            );
        }

        let y = rect.y;
        if (vertAlign === "center") {
            y += (rect.height - totalHeight) / 2;
        } else if (vertAlign === "bottom") {
            y += rect.height - totalHeight;
        }

        for (let i = 0; i < renderedLines.length; i++) {
            let line = renderedLines[i];
            if (ellipsized && i === renderedLines.length - 1) {
                line = this.ellipsizeLine(line, drawFont, rect.width, ellipsis);
            }
            const lineWidth = drawFont.measureText(line).width;
            let x = rect.x;
            if (horizAlign === "center") {
                x += (rect.width - lineWidth) / 2;
            } else if (horizAlign === "right") {
                x += rect.width - lineWidth;
            }
            if (draw2D) {
                draw2D.doDrawRotatedText(line, x, y, color, drawFont, rotation);
            }
            y += lineHeight + lineSpacing;
        }

        return { text, width: rect.width, height: totalHeight, ellipsized: ellipsized };
    }

    protected breakTextIntoLines(text: string, font: RoFont, width: number): string[] {
        const lines: string[] = [];
        if (width <= 0) {
            return lines;
        }
        const words = text.split(/(\s|-)/);
        let currentLine = "";
        for (const word of words) {
            if (word === "\n") {
                lines.push(currentLine);
                currentLine = "";
            } else {
                const testLine = currentLine + word;
                if (font.measureText(testLine).width <= width) {
                    currentLine = testLine;
                } else if (font.measureText(word).width > width) {
                    // Word is too long, break it
                    const brokenWords = this.breakLongWord(word, font, width);
                    for (const brokenWord of brokenWords) {
                        if (font.measureText(currentLine + brokenWord).width <= width) {
                            currentLine += brokenWord;
                        } else {
                            lines.push(currentLine);
                            currentLine = brokenWord;
                        }
                    }
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
        }
        lines.push(currentLine);
        return lines;
    }

    protected breakLongWord(word: string, font: RoFont, width: number): string[] {
        const brokenWords: string[] = [];
        let currentWord = "";
        for (const char of word) {
            if (font.measureText(currentWord + char).width <= width) {
                currentWord += char;
            } else {
                brokenWords.push(currentWord);
                currentWord = char;
            }
        }
        brokenWords.push(currentWord);
        return brokenWords;
    }

    protected ellipsizeLine(line: string, font: RoFont, width: number, ellipsis: string): string {
        if (font.measureText(line).width <= width) {
            return line;
        }
        let ellipsizedLine = "";
        for (const char of line) {
            if (font.measureText(ellipsizedLine + char + ellipsis).width <= width) {
                ellipsizedLine += char;
            } else {
                return ellipsizedLine + ellipsis;
            }
        }
        return ellipsizedLine + ellipsis;
    }

    protected drawImage(
        bitmap: RoBitmap,
        rect: Rect,
        rotation: number,
        draw2D?: IfDraw2D,
        rgba?: number
    ) {
        if (bitmap.isValid()) {
            bitmap.scaleMode = 1;
            if (typeof rgba !== "number" || rgba === 0xffffffff || rgba === -1) {
                rgba = undefined;
            }
            if (bitmap.ninePatch) {
                draw2D?.drawNinePatch(bitmap, rect, rgba);
                // TODO: Handle 9-patch rotation, scaling
                return rect;
            }
            const scale = this.getFieldValueJS("scale") as number[];
            let scaleX = rect.width !== 0 ? rect.width / bitmap.width : 1;
            let scaleY = rect.height !== 0 ? rect.height / bitmap.height : 1;
            scaleX *= scale[0];
            scaleY *= scale[1];
            rect.width = scaleX * bitmap.width;
            rect.height = scaleY * bitmap.height;
            if (rotation !== 0 || scale[0] !== 1 || scale[1] !== 1) {
                const center = this.getScaleRotateCenter();
                draw2D?.doDrawRotatedBitmap(
                    rect.x,
                    rect.y,
                    scaleX,
                    scaleY,
                    rotation,
                    bitmap,
                    center[0],
                    center[1],
                    rgba
                );
            } else {
                draw2D?.doDrawScaledObject(rect.x, rect.y, scaleX, scaleY, bitmap, rgba);
            }
        }
        return rect;
    }

    protected updateBoundingRects(drawRect: Rect, origin: number[], rotation: number) {
        const nodeTrans = this.getTranslation();
        this.rectLocal = { x: 0, y: 0, width: drawRect.width, height: drawRect.height };
        if (rotation !== 0) {
            const center = this.getScaleRotateCenter();
            this.rectToScene = rotateRect(drawRect, rotation, center);
            const nodeRotation = this.getRotation();
            if (nodeRotation !== 0 && nodeRotation === rotation) {
                this.rectToParent = {
                    x: this.rectToScene.x - origin[0],
                    y: this.rectToScene.y - origin[1],
                    width: this.rectToScene.width,
                    height: this.rectToScene.height,
                };
            } else if (nodeRotation !== 0 && nodeRotation !== rotation) {
                const rect = { x: 0, y: 0, width: drawRect.width, height: drawRect.height };
                const rotatedRect = rotateRect(rect, nodeRotation, center);
                this.rectToParent = {
                    x: nodeTrans[0] + rotatedRect.x,
                    y: nodeTrans[1] + rotatedRect.y,
                    width: rotatedRect.width,
                    height: rotatedRect.height,
                };
            } else {
                this.rectToParent = {
                    x: nodeTrans[0],
                    y: nodeTrans[1],
                    width: drawRect.width,
                    height: drawRect.height,
                };
            }
        } else {
            this.rectToScene = drawRect;
            this.rectToParent = {
                x: nodeTrans[0],
                y: nodeTrans[1],
                width: drawRect.width,
                height: drawRect.height,
            };
        }
    }

    protected updateParentRects(origin: number[], angle: number) {
        if (this.parent instanceof Group) {
            this.parent.rectLocal = unionRect(this.parent.rectLocal, this.rectToParent);
            const parentTrans = this.parent.getTranslation();
            let x = parentTrans[0] + this.parent.rectLocal.x;
            let y = parentTrans[1] + this.parent.rectLocal.y;
            let width = this.parent.rectLocal.width;
            let height = this.parent.rectLocal.height;
            if (angle !== 0) {
                const center = this.parent.getScaleRotateCenter();
                const rect = rotateRect({ x: 0, y: 0, width, height }, angle, center);
                x += rect.x;
                y += rect.y;
                width = rect.width;
                height = rect.height;
            }
            this.parent.rectToParent = unionRect(this.parent.rectToParent, { x, y, width, height });
            x += origin[0] - parentTrans[0];
            y += origin[1] - parentTrans[1];
            this.parent.rectToScene = unionRect(this.parent.rectToScene, { x, y, width, height });
        }
    }

    handleKey(key: string, press: boolean) {
        // override in derived classes
        return false;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const rotation = angle + this.getRotation();
        this.rectToScene = {
            x: drawTrans[0],
            y: drawTrans[1],
            width: 0,
            height: 0,
        };
        this.rectToParent = {
            x: nodeTrans[0],
            y: nodeTrans[1],
            width: 0,
            height: 0,
        };
        this.renderChildren(interpreter, drawTrans, rotation, draw2D);
        this.updateParentRects(origin, angle);
        this.isDirty = false;
    }
}
