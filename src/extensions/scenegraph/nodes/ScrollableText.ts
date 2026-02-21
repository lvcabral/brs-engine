import {
    AAMember,
    Interpreter,
    BrsBoolean,
    BrsInvalid,
    BrsString,
    BrsType,
    Float,
    IfDraw2D,
    RoBitmap,
    RoFont,
    Rect,
} from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Group } from "./Group";
import type { Font } from "./Font";
import { rotateTranslation } from "../SGUtil";

// Width reserved for the scrollbar (right side of the node)
const SCROLLBAR_WIDTH_HD = 36;
const SCROLLBAR_WIDTH_FHD = 54;

export class ScrollableText extends Group {
    readonly defaultFields: FieldModel[] = [
        { name: "text", type: "string", value: "" },
        { name: "color", type: "color", value: "0xddddddff" },
        { name: "font", type: "font" },
        { name: "width", type: "float", value: "0" },
        { name: "height", type: "float", value: "0" },
        { name: "lineSpacing", type: "float", value: "8" },
        { name: "horizAlign", type: "string", value: "left" },
        { name: "vertAlign", type: "string", value: "top" },
        { name: "scrollbarTrackBitmapUri", type: "uri", value: "" },
        { name: "scrollbarThumbBitmapUri", type: "uri", value: "" },
    ];

    private readonly scrollbarWidth: number;

    // Cached bitmaps for scrollbar assets
    private trackBitmap: RoBitmap | undefined;
    private thumbOnBitmap: RoBitmap | undefined;
    private thumbOffBitmap: RoBitmap | undefined;
    private customTrackBitmap: RoBitmap | undefined;
    private customThumbBitmap: RoBitmap | undefined;

    // Scroll state
    private scrollTopLine: number = 0;
    private allLines: { text: string; width: number; height: number; ellipsized: boolean }[] = [];
    private lineHeight: number = 0;
    private totalLines: number = 0;
    private visibleLines: number = 0;
    private needsScroll: boolean = false;

    // Focus tracking
    private focused: boolean = false;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.ScrollableText) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Group);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        this.scrollbarWidth = this.resolution === "FHD" ? SCROLLBAR_WIDTH_FHD : SCROLLBAR_WIDTH_HD;

        if (this.resolution === "FHD") {
            this.setValueSilent("lineSpacing", new Float(12));
        } else {
            this.setValueSilent("lineSpacing", new Float(8));
        }

        // Make this node focusable
        this.setValueSilent("focusable", BrsBoolean.True);

        // Pre-load default scrollbar assets
        this.trackBitmap = this.loadBitmap(`common:/images/${this.resolution}/scrollBarTrack.9.png`);
        this.thumbOnBitmap = this.loadBitmap(`common:/images/${this.resolution}/scrollBarHandle_on.9.png`);
        this.thumbOffBitmap = this.loadBitmap(`common:/images/${this.resolution}/scrollBarHandle_off.9.png`);
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind, sync?: boolean) {
        const fieldName = index.toLowerCase();

        if (fieldName === "focusedchild") {
            // Track focus state: focusedChild is set to `this` when focused, BrsInvalid when unfocused
            this.focused = !(value instanceof BrsInvalid) && value !== null && value !== undefined;
            super.setValue(index, value, alwaysNotify, kind, sync);
            return;
        }

        if (fieldName === "scrollbartrackbitmapuri") {
            super.setValue(index, value, alwaysNotify, kind, sync);
            const uri = value instanceof BrsString ? value.getValue() : "";
            this.customTrackBitmap = uri ? this.loadBitmap(uri) : undefined;
            return;
        }

        if (fieldName === "scrollbarthumbbitmapuri") {
            super.setValue(index, value, alwaysNotify, kind, sync);
            const uri = value instanceof BrsString ? value.getValue() : "";
            this.customThumbBitmap = uri ? this.loadBitmap(uri) : undefined;
            return;
        }

        super.setValue(index, value, alwaysNotify, kind, sync);

        // Invalidate cached line layout when any relevant field changes
        const textFields = ["text", "font", "width", "height", "linespacing"];
        if (textFields.includes(fieldName)) {
            this.scrollTopLine = 0;
            this.allLines = [];
        }
    }

    handleKey(key: string, press: boolean): boolean {
        if (!press) {
            return this.needsScroll;
        }
        if (!this.needsScroll) {
            return false;
        }
        const maxScroll = this.totalLines - this.visibleLines;
        // Page size: last line of current page becomes first line of next page
        const pageSize = Math.max(1, this.visibleLines - 1);
        if (key === "up") {
            if (this.scrollTopLine > 0) {
                this.scrollTopLine--;
                this.isDirty = true;
                return true;
            }
            return false;
        }
        if (key === "down") {
            if (this.scrollTopLine < maxScroll) {
                this.scrollTopLine++;
                this.isDirty = true;
                return true;
            }
            return false;
        }
        if (key === "rewind") {
            if (this.scrollTopLine > 0) {
                this.scrollTopLine = Math.max(0, this.scrollTopLine - pageSize);
                this.isDirty = true;
                return true;
            }
            return false;
        }
        if (key === "fastforward") {
            if (this.scrollTopLine < maxScroll) {
                this.scrollTopLine = Math.min(maxScroll, this.scrollTopLine + pageSize);
                this.isDirty = true;
                return true;
            }
            return false;
        }
        return false;
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
        const rotation = angle + this.getRotation();
        opacity = opacity * this.getOpacity();

        const size = this.getDimensions();
        const rect: Rect = { x: drawTrans[0], y: drawTrans[1], width: size.width, height: size.height };

        if (draw2D && size.width > 0 && size.height > 0) {
            this.renderContent(draw2D, rect, rotation, opacity);
        }

        this.updateBoundingRects(rect, origin, rotation);
        this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
        this.nodeRenderingDone(origin, angle, opacity, draw2D);
    }

    private renderContent(draw2D: IfDraw2D, rect: Rect, rotation: number, opacity: number) {
        const font = this.getValue("font") as Font;
        const drawFont = font?.createDrawFont();
        if (!(drawFont instanceof RoFont)) {
            return;
        }

        const text = (this.getValueJS("text") as string) ?? "";
        const color = (this.getValueJS("color") as number) ?? 0xddddddff;
        const lineSpacing = (this.getValueJS("lineSpacing") as number) ?? 8;
        const horizAlign = (this.getValueJS("horizAlign") as string) ?? "left";
        const vertAlign = (this.getValueJS("vertAlign") as string) ?? "top";
        const nodeWidth = rect.width;
        const nodeHeight = rect.height;

        // Calculate layout dimensions
        this.lineHeight = drawFont.measureTextHeight();
        const effectiveLine = this.lineHeight + lineSpacing;

        // Determine max visible lines and whether we need a scrollbar
        const maxVisible = effectiveLine > 0 ? Math.floor((nodeHeight + lineSpacing) / effectiveLine) : 0;

        // Pre-compute all lines using the full width first, then decide scrollbar
        const textAreaWidth = nodeWidth - this.scrollbarWidth;
        const textLines = this.computeLines(text, drawFont, textAreaWidth);
        const totalCount = textLines.length;

        const showScrollbar = totalCount > maxVisible;
        const textWidth = showScrollbar ? textAreaWidth : nodeWidth;

        // Recompute lines if width changed (no scrollbar case)
        const finalLines = showScrollbar ? textLines : this.computeLines(text, drawFont, textWidth);

        this.allLines = finalLines;
        this.totalLines = finalLines.length;
        this.visibleLines = Math.min(maxVisible, this.totalLines);
        this.needsScroll = showScrollbar;

        // Clamp scroll position
        const maxScroll = Math.max(0, this.totalLines - this.visibleLines);
        if (this.scrollTopLine > maxScroll) {
            this.scrollTopLine = maxScroll;
        }

        // Calculate vertical start position based on vertAlign
        let startY = rect.y;
        const renderedHeight = this.visibleLines * this.lineHeight + Math.max(0, this.visibleLines - 1) * lineSpacing;
        if (vertAlign === "center") {
            startY += (nodeHeight - renderedHeight) / 2;
        } else if (vertAlign === "bottom") {
            startY += nodeHeight - renderedHeight;
        }

        // Draw visible lines with clipping to prevent overflow
        const clipWidth = showScrollbar ? nodeWidth - this.scrollbarWidth : nodeWidth;
        const clipRect: Rect = { x: rect.x, y: rect.y, width: clipWidth, height: nodeHeight };
        draw2D.pushClip(clipRect);
        const endLine = Math.min(this.scrollTopLine + this.visibleLines, this.totalLines);
        let y = startY;
        for (let i = this.scrollTopLine; i < endLine; i++) {
            const line = finalLines[i];
            let x = rect.x;
            if (horizAlign === "center" && textWidth > line.width) {
                x += (textWidth - line.width) / 2;
            } else if (horizAlign === "right" && textWidth > line.width) {
                x += textWidth - line.width;
            }
            draw2D.doDrawRotatedText(line.text, x, y, color, opacity, drawFont, rotation);
            y += this.lineHeight + lineSpacing;
        }
        draw2D.popClip();

        // Draw scrollbar if needed
        if (showScrollbar) {
            this.renderScrollbar(draw2D, rect, nodeWidth, nodeHeight, rotation, opacity, maxScroll);
        }
    }

    private computeLines(text: string, drawFont: RoFont, width: number) {
        if (!text || width <= 0) {
            return [];
        }
        // Split on newlines first (paragraph breaks), then wrap each paragraph
        const paragraphs = text.split("\n");
        const allLines: { text: string; width: number; height: number; ellipsized: boolean }[] = [];
        for (const paragraph of paragraphs) {
            if (paragraph === "") {
                // Empty paragraph = blank line
                allLines.push({ text: "", width: 0, height: this.lineHeight, ellipsized: false });
                continue;
            }
            const paraLines = this.breakTextIntoLines(paragraph, drawFont, width);
            for (const line of paraLines) {
                allLines.push(line);
            }
        }
        return allLines;
    }

    private renderScrollbar(
        draw2D: IfDraw2D,
        rect: Rect,
        nodeWidth: number,
        nodeHeight: number,
        rotation: number,
        opacity: number,
        maxScroll: number
    ) {
        const sbX = rect.x + nodeWidth - this.scrollbarWidth;
        const sbY = rect.y;

        // Draw track
        const trackBmp = this.customTrackBitmap ?? this.trackBitmap;
        if (trackBmp?.isValid()) {
            const trackRect: Rect = { x: sbX, y: sbY, width: this.scrollbarWidth, height: nodeHeight };
            this.drawImage(trackBmp, trackRect, rotation, opacity, draw2D);
        } else {
            // Fallback: draw a semi-transparent rectangle as track
            draw2D.doDrawRotatedRect(
                { x: sbX, y: sbY, width: this.scrollbarWidth, height: nodeHeight },
                0x333333aa,
                rotation,
                undefined,
                opacity
            );
        }

        // Draw thumb
        const thumbBmp = this.customThumbBitmap ?? (this.focused ? this.thumbOnBitmap : this.thumbOffBitmap);
        if (thumbBmp?.isValid()) {
            // Minimum height preserves the image's natural aspect ratio at the scrollbar width
            const naturalHeight =
                thumbBmp.width > 0
                    ? Math.round(thumbBmp.height * (this.scrollbarWidth / thumbBmp.width))
                    : this.scrollbarWidth;
            const thumbHeight = Math.max(naturalHeight, Math.round(nodeHeight * (this.visibleLines / this.totalLines)));
            const thumbTrackRange = nodeHeight - thumbHeight;
            const thumbY = maxScroll > 0 ? sbY + Math.round((this.scrollTopLine / maxScroll) * thumbTrackRange) : sbY;
            const thumbRect: Rect = { x: sbX, y: thumbY, width: this.scrollbarWidth, height: thumbHeight };
            this.drawImage(thumbBmp, thumbRect, rotation, opacity, draw2D);
        }
    }
}
