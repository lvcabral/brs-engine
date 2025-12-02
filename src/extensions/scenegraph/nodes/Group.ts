import {
    AAMember,
    BrsBoolean,
    BrsInvalid,
    BrsString,
    BrsType,
    Float,
    Int32,
    isBrsString,
    RoArray,
    RoBitmap,
    RoFont,
    ValueKind,
} from "brs-engine";
import { sgRoot } from "../SGRoot";
import type { Font } from "./Font";
import type { Label } from "./Label";
import type { Poster } from "./Poster";
import type { Rectangle } from "./Rectangle";
import type { ScrollingLabel } from "./ScrollingLabel";
import { Node } from "./Node";
import { FieldKind, FieldModel } from "../SGTypes";
import { Interpreter } from "brs-engine";
import { IfDraw2D, MeasuredText, Rect } from "brs-engine";
import { convertHexColor, rotateRect, unionRect } from "../SGUtil";
import { createNodeByType } from "../factory/SGNodeFactory";
import { jsValueOf } from "../factory/serialization";

export class Group extends Node {
    readonly defaultFields: FieldModel[] = [
        { name: "visible", type: "boolean", value: "true" },
        { name: "opacity", type: "float", value: "1.0" },
        { name: "translation", type: "vector2d", value: "[0.0,0.0]" },
        { name: "rotation", type: "float", value: "0.0" },
        { name: "scale", type: "vector2d", value: "[1.0,1.0]" },
        { name: "scaleRotateCenter", type: "vector2d", value: "[0.0,0.0]" },
        { name: "childRenderOrder", type: "string", value: "renderLast" },
        { name: "inheritParentTransform", type: "boolean", value: "true" },
        { name: "inheritParentOpacity", type: "boolean", value: "true" },
        { name: "clippingRect", type: "rect2d", value: "[0.0,0.0,0.0,0.0]" },
        { name: "renderPass", type: "integer", value: "0" },
        { name: "muteAudioGuide", type: "boolean", value: "false" },
        { name: "enableRenderTracking", type: "boolean", value: "false" },
        { name: "renderTracking", type: "string", value: "disabled" },
    ];
    protected readonly sceneRect: Rect;
    protected resolution: string;
    private cachedLines: MeasuredText[] = [];
    private cachedHeight: number = 0;
    isDirty: boolean;

    constructor(initializedFields: AAMember[] = [], readonly name: string = "Group") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        const sceneUI = sgRoot.scene?.ui;
        if (sceneUI) {
            this.resolution = sceneUI.resolution;
            this.sceneRect = { x: 0, y: 0, width: sceneUI.width, height: sceneUI.height };
        } else {
            this.resolution = "HD";
            this.sceneRect = { x: 0, y: 0, width: 1280, height: 720 };
        }
        this.isDirty = true;
    }

    setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
        const mapKey = index.toLowerCase();
        const field = this.fields.get(mapKey);

        if (field?.getType() === FieldKind.Font && isBrsString(value)) {
            const strFont = value.getValue();
            const font = createNodeByType(new BrsString("Font")) as Font;
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
                return;
            }
        }
        this.isDirty = true;
        super.setValue(index, value, alwaysNotify, kind);
    }

    setValueSilent(fieldName: string, value: BrsType): void {
        this.isDirty = true;
        super.setValueSilent(fieldName, value);
    }

    getDimensions() {
        return {
            width: (this.getValueJS("width") as number) ?? 0,
            height: (this.getValueJS("height") as number) ?? 0,
        };
    }

    isVisible() {
        return (this.getValueJS("visible") as boolean) ?? true;
    }

    protected addPoster(uri: string, translation: number[], width?: number, height?: number) {
        const poster = createNodeByType(new BrsString("Poster")) as Poster;
        if (uri) {
            poster.setValue("uri", new BrsString(uri));
        }
        poster.setTranslation(translation);
        if (width !== undefined) {
            poster.setValueSilent("width", new Float(width));
        }
        if (height !== undefined) {
            poster.setValueSilent("height", new Float(height));
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
        const label = createNodeByType(new BrsString("Label")) as Label;
        if (colorField) {
            this.copyField(label, "color", colorField);
        }
        if (fontSize) {
            const labelFields = label.getNodeFields();
            const labelFont = labelFields.get("font")?.getValue();
            // Check if labelFont is a Font node (it should be)
            if (labelFont && labelFont.kind === ValueKind.Object && "setSystemFont" in labelFont) {
                (labelFont as unknown as Font).setSize(fontSize);
            }
        }
        if (width !== undefined) {
            label.setValueSilent("width", new Float(width));
        }
        if (height !== undefined) {
            label.setValueSilent("height", new Float(height));
        }
        label.setTranslation(translation);
        if (vertAlign) {
            label.setValueSilent("vertalign", new BrsString(vertAlign));
        }
        if (horizAlign) {
            label.setValueSilent("horizalign", new BrsString(horizAlign));
        }
        if (wrap !== undefined) {
            label.setValueSilent("wrap", BrsBoolean.from(wrap));
        }
        this.appendChildToParent(label);
        return label;
    }

    protected addScrollingLabel(
        colorField: string,
        translation: number[],
        maxWidth?: number,
        height?: number,
        systemFont?: string,
        vertAlign?: string,
        horizAlign?: string,
        speed?: number,
        repeat?: number
    ) {
        const label = createNodeByType(new BrsString("ScrollingLabel")) as ScrollingLabel;
        if (colorField) {
            this.copyField(label, "color", colorField);
        }
        if (systemFont) {
            const font = label.getValue("font");
            if (font && font.kind === ValueKind.Object && "setSystemFont" in font) {
                (font as unknown as Font).setSystemFont(systemFont);
            }
        }
        if (maxWidth !== undefined) {
            label.setValueSilent("maxWidth", new Float(maxWidth));
        }
        if (height !== undefined) {
            label.setValueSilent("height", new Float(height));
        }
        label.setTranslation(translation);
        if (vertAlign) {
            label.setValueSilent("vertalign", new BrsString(vertAlign));
        }
        if (horizAlign) {
            label.setValueSilent("horizalign", new BrsString(horizAlign));
        }
        if (speed !== undefined) {
            label.setValueSilent("scrollSpeed", new Int32(speed));
        }
        if (repeat !== undefined) {
            label.setValueSilent("repeatCount", new Int32(repeat));
        }
        this.appendChildToParent(label);
        return label;
    }

    protected addRectangle(colorField: string, translation: number[], width?: number, height?: number) {
        const rectangle = createNodeByType(new BrsString("Rectangle")) as Rectangle;
        this.copyField(rectangle, "color", colorField);
        if (width !== undefined) {
            rectangle.setValueSilent("width", new Float(width));
        }
        if (height !== undefined) {
            rectangle.setValueSilent("height", new Float(height));
        }
        rectangle.setTranslation(translation);
        this.appendChildToParent(rectangle);
        return rectangle;
    }

    protected getTranslation() {
        const translation = this.getValueJS("translation") as number[];
        // Adjust translation based on scale and rotation center
        const scale = this.getValueJS("scale") as number[];
        const scaleRotateCenter = this.getScaleRotateCenter();
        const scaleDiffX = scaleRotateCenter[0] * (scale[0] - 1);
        const scaleDiffY = scaleRotateCenter[1] * (scale[1] - 1);
        translation[0] -= scaleDiffX;
        translation[1] -= scaleDiffY;
        return translation;
    }

    setTranslation(translation: number[]) {
        if (translation.length === 2) {
            const newTrans = [new Float(translation[0]), new Float(translation[1])];
            this.setValue("translation", new RoArray(newTrans));
        }
    }

    setTranslationOffset(x: number = 0, y: number = 0) {
        const translation = this.getValueJS("translation") as number[];
        translation[0] += x;
        translation[1] += y;
        this.setTranslation(translation);
    }

    setTranslationX(x: number) {
        const translation = this.getValueJS("translation") as number[];
        translation[0] = x;
        this.setTranslation(translation);
    }

    setTranslationY(y: number) {
        const translation = this.getValueJS("translation") as number[];
        translation[1] = y;
        this.setTranslation(translation);
    }

    protected getRotation() {
        const rotation = this.getValueJS("rotation") as number;
        return rotation ?? 0;
    }

    protected getScaleRotateCenter() {
        const scaleRotateCenter = this.getValue("scaleRotateCenter");
        const center = [0, 0];
        if (scaleRotateCenter instanceof RoArray && scaleRotateCenter.elements.length === 2) {
            center[0] = jsValueOf(scaleRotateCenter.elements[0]) as number;
            center[1] = jsValueOf(scaleRotateCenter.elements[1]) as number;
        }
        return center;
    }

    protected getOpacity() {
        const opacity = this.getValueJS("opacity") as number;
        return opacity ?? 1;
    }

    protected drawText(
        fullText: string,
        font: Font,
        color: number,
        opacity: number,
        rect: Rect,
        horizAlign: string,
        vertAlign: string,
        rotation: number,
        draw2D?: IfDraw2D,
        ellipsis: string = "...",
        index: number = 0
    ) {
        const drawFont = font.createDrawFont();
        let text: string;
        let measured: MeasuredText;

        if (this.isDirty || this.cachedLines[index] === undefined) {
            if (rect.width === 0) {
                const newlineIndex = fullText.indexOf("\n");
                if (newlineIndex !== -1) {
                    text = fullText.substring(0, newlineIndex);
                } else {
                    text = fullText;
                }
                measured = drawFont.measureText(text);
            } else {
                measured = drawFont.measureText(fullText, rect.width, ellipsis);
                text = measured.text;
            }
            this.cachedLines[index] = measured;
        } else {
            measured = this.cachedLines[index];
            text = measured.text;
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
        draw2D?.doDrawRotatedText(text, textX, textY, color, opacity, drawFont, rotation);
        return measured;
    }

    protected drawTextWrap(
        text: string,
        font: Font,
        color: number,
        opacity: number,
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
        if (this.changed) {
            this.refreshLines(text, drawFont, rect, ellipsis, numLines, maxLines, lineSpacing, displayPartialLines);
        }
        let y = rect.y;
        if (vertAlign === "center") {
            y += (rect.height - this.cachedHeight) / 2;
        } else if (vertAlign === "bottom") {
            y += rect.height - this.cachedHeight;
        }
        let ellipsized = false;
        for (const line of this.cachedLines) {
            let x = rect.x;
            if (horizAlign === "center") {
                x += (rect.width - line.width) / 2;
            } else if (horizAlign === "right") {
                x += rect.width - line.width;
            }
            draw2D?.doDrawRotatedText(line.text, x, y, color, opacity, drawFont, rotation);
            y += line.height + lineSpacing;
            ellipsized = line.ellipsized;
        }

        return {
            text,
            width: rect.width,
            height: this.cachedHeight,
            ellipsized: ellipsized,
        };
    }

    private refreshLines(
        text: string,
        drawFont: RoFont,
        rect: Rect,
        ellipsis: string,
        numLines: number,
        maxLines: number,
        lineSpacing: number,
        displayPartialLines: boolean
    ) {
        const lines = this.breakTextIntoLines(text, drawFont, rect.width);
        const lineHeight = drawFont.measureTextHeight();
        let renderedLines = lines;
        let totalHeight = lines.length * lineHeight;

        if (rect.height > 0) {
            const maxRenderedLines = Math.floor((rect.height + lineSpacing) / (lineHeight + lineSpacing));
            renderedLines = this.checkEllipsis(lines, maxRenderedLines, drawFont, rect.width, ellipsis);
            if (!displayPartialLines && renderedLines.length < lines.length) {
                totalHeight =
                    renderedLines.length * lineHeight +
                    (renderedLines.length > 1 ? (renderedLines.length - 1) * lineSpacing : 0);
            } else {
                totalHeight = Math.min(totalHeight, rect.height);
            }
        } else if (numLines > 0 || maxLines > 0) {
            const limit = numLines > 0 ? numLines : maxLines;
            renderedLines = this.checkEllipsis(lines, limit, drawFont, rect.width, ellipsis);
            totalHeight = Math.min(totalHeight, limit * lineHeight + (limit > 1 ? (limit - 1) * lineSpacing : 0));
        }
        this.cachedHeight = totalHeight;
        this.cachedLines = renderedLines;
    }

    private checkEllipsis(lines: MeasuredText[], maxLines: number, drawFont: RoFont, width: number, ellipsis: string) {
        if (lines.length > maxLines) {
            const renderedLines = lines.slice(0, maxLines);
            if (renderedLines.length > 0) {
                const line = renderedLines[renderedLines.length - 1];
                line.text = this.ellipsizeLine(line.text, drawFont, width, ellipsis);
                line.ellipsized = true;
            }
            return renderedLines;
        }
        return lines;
    }

    protected breakTextIntoLines(text: string, font: RoFont, width: number): MeasuredText[] {
        const lines: MeasuredText[] = [];
        if (text.length === 0 || width <= 0) {
            return lines;
        }
        const words = text.split(/(\s|-)/);
        let currentMeasure = font.measureText(text);
        if (currentMeasure.width <= width) {
            return [currentMeasure];
        }
        currentMeasure = { text: "", width: 0, height: 0, ellipsized: false };
        for (const word of words) {
            if (word === "\n") {
                lines.push(currentMeasure);
                currentMeasure = { text: "", width: 0, height: 0, ellipsized: false };
            } else {
                const testLine = currentMeasure.text + word;
                const measure = font.measureText(testLine);
                if (measure.width <= width) {
                    currentMeasure = measure;
                } else if (font.measureText(word).width > width) {
                    // Word is too long, break it
                    const brokenWords = this.breakLongWord(word, font, width);
                    for (const brokenWord of brokenWords) {
                        const brokenMeasure = font.measureText(currentMeasure.text + brokenWord);
                        if (brokenMeasure.width <= width) {
                            currentMeasure = brokenMeasure;
                        } else {
                            lines.push(currentMeasure);
                            currentMeasure = font.measureText(brokenWord);
                        }
                    }
                } else {
                    lines.push(currentMeasure);
                    currentMeasure = font.measureText(word);
                }
            }
        }
        lines.push(currentMeasure);
        return lines;
    }

    protected breakLongWord(word: string, font: RoFont, width: number): string[] {
        const brokenWords: string[] = [];
        let currentWord = "";
        for (const char of word) {
            if (font.measureTextWidth(currentWord + char).width <= width) {
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
        if (font.measureTextWidth(line + ellipsis).width <= width) {
            return line + ellipsis;
        }
        let ellipsizedLine = "";
        for (const char of line) {
            if (font.measureTextWidth(ellipsizedLine + char + ellipsis).width <= width) {
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
        opacity: number,
        draw2D?: IfDraw2D,
        rgba?: number
    ) {
        if (bitmap.isValid()) {
            bitmap.scaleMode = 1;
            if (typeof rgba !== "number" || rgba === 0xffffffff || rgba === -1) {
                rgba = undefined;
            }
            if (opacity < 0 || opacity > 1) {
                opacity = 1;
            }
            if (bitmap.ninePatch) {
                draw2D?.drawNinePatch(bitmap, rect, rgba, opacity);
                // TODO: Handle 9-patch rotation, scaling
                return rect;
            }
            const scale = this.getValueJS("scale") as number[];
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
                    rgba,
                    opacity
                );
            } else {
                draw2D?.doDrawScaledObject(rect.x, rect.y, scaleX, scaleY, bitmap, rgba, opacity);
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
            const parent = this.parent;
            parent.rectLocal = unionRect(parent.rectLocal, this.rectToParent);
            const parentTrans = parent.getTranslation();
            let x = parentTrans[0] + parent.rectLocal.x;
            let y = parentTrans[1] + parent.rectLocal.y;
            let width = parent.rectLocal.width;
            let height = parent.rectLocal.height;
            if (angle !== 0) {
                const center = parent.getScaleRotateCenter();
                const rect = rotateRect({ x: 0, y: 0, width, height }, angle, center);
                x += rect.x;
                y += rect.y;
                width = rect.width;
                height = rect.height;
            }
            parent.rectToParent = unionRect(parent.rectToParent, { x, y, width, height });
            x += origin[0] - parentTrans[0];
            y += origin[1] - parentTrans[1];
            parent.rectToScene = unionRect(parent.rectToScene, { x, y, width, height });
        }
    }

    handleKey(key: string, press: boolean) {
        // override in derived classes
        return false;
    }

    renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
        if (!this.isVisible()) {
            return;
        }
        const nodeTrans = this.getTranslation();
        const drawTrans = nodeTrans.slice();
        drawTrans[0] += origin[0];
        drawTrans[1] += origin[1];
        const rotation = angle + this.getRotation();
        this.rectLocal = {
            x: Number.POSITIVE_INFINITY,
            y: Number.POSITIVE_INFINITY,
            width: Number.POSITIVE_INFINITY,
            height: Number.POSITIVE_INFINITY,
        };
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
        opacity = opacity * this.getOpacity();
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.updateContainerBounds(nodeTrans, drawTrans);
        this.updateParentRects(origin, angle);
        this.isDirty = false;
    }

    private updateContainerBounds(nodeTrans: number[], drawTrans: number[]) {
        if (!Number.isFinite(this.rectLocal.x)) {
            return;
        }
        const rectLocal = this.rectLocal;
        this.rectToParent = {
            x: nodeTrans[0] + rectLocal.x,
            y: nodeTrans[1] + rectLocal.y,
            width: rectLocal.width,
            height: rectLocal.height,
        };
        this.rectToScene = {
            x: drawTrans[0] + rectLocal.x,
            y: drawTrans[1] + rectLocal.y,
            width: rectLocal.width,
            height: rectLocal.height,
        };
    }
}
